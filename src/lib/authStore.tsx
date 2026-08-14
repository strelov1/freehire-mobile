import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { authApi } from '@/features/auth/api/authApi';
import type { AuthCompletion, SessionOwner, SessionState } from '@/features/auth/model/authTypes';
import type { RecentAuthProof } from '@/features/auth/model/authV2Types';
import {
  ReturnIntentManager,
  type ReturnIntent,
  type ReturnIntentSnapshot,
} from '@/features/auth/model/returnIntent';
import { SessionCoordinator } from '@/features/auth/session/sessionCoordinator';

import { codeFromCallbackUrl } from './oauth';
import { unregisterThisDevice } from './push';
import { PrivateMutationRegistry, clearPrivateUserData, privateKeys, publicKeys } from './queryKeys';
import { saveJob } from './api';
import { subscribeUnauthorized } from './transport';
import type { User } from './types';

const OAUTH_CALLBACK = 'freehiremobile://auth-callback';

type AuthContextValue = {
  state: SessionState;
  user: User | null;
  loading: boolean;
  sessionEpoch: number;
  returnIntent: ReturnIntentSnapshot;
  signIn: (email: string, password: string) => Promise<AuthCompletion>;
  signUp: (email: string, password: string) => Promise<AuthCompletion>;
  signInWithProvider: (provider: string) => Promise<AuthCompletion>;
  signInWithProviderV2: (provider: string, purpose?: 'sign_in' | 'reauth') => Promise<AuthCompletion | RecentAuthProof>;
  signInWithApple: (purpose?: 'sign_in' | 'reauth') => Promise<AuthCompletion | RecentAuthProof>;
  passwordReauth: (password: string) => Promise<RecentAuthProof>;
  appleReauth: () => Promise<RecentAuthProof>;
  oauthReauth: (provider: string) => Promise<RecentAuthProof>;
  deleteAccount: (email?: string) => Promise<void>;
  signOut: () => Promise<void>;
  logoutAll: () => Promise<void>;
  retryBootstrap: () => Promise<void>;
  revalidate: () => Promise<void>;
  recordReturnIntent: (intent: ReturnIntent) => boolean;
  clearReturnIntent: () => void;
  retryReturnIntent: () => Promise<'none' | 'completed' | 'failed'>;
  isOwnerCurrent: (owner: SessionOwner) => boolean;
  createPrivateMutation: (owner: SessionOwner) => { signal: AbortSignal; release: () => void };
};

const AuthContext = createContext<AuthContextValue | null>(null);

function visibleUser(state: SessionState): User | null {
  if (state.status === 'authenticated' || state.status === 'refreshing' || state.status === 'signingOut') {
    return state.user;
  }
  return null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<SessionState>({ status: 'bootstrapping' });
  const [sessionEpoch, setSessionEpoch] = useState(0);
  const [returnIntent, setReturnIntent] = useState<ReturnIntentSnapshot>({ status: 'empty' });
  const [returnIntents] = useState(() => new ReturnIntentManager());
  const [mutationRegistry] = useState(() => new PrivateMutationRegistry());

  const openOAuthV2 = useCallback(async (url: string) => {
    const result = await WebBrowser.openAuthSessionAsync(url, OAUTH_CALLBACK);
    if (result.type !== 'success') return { cancelled: true };
    const callback = codeFromCallbackUrl(result.url);
    if (callback.error) throw new Error('oauth');
    return { code: callback.code, cancelled: !callback.code };
  }, []);

  const [coordinator] = useState(() => {
    let instance!: SessionCoordinator;
    instance = new SessionCoordinator({
      api: authApi,
      returnIntents,
      onStateChange: (nextState) => {
        setState(nextState);
        setSessionEpoch(instance.getSessionEpoch());
      },
      transitionIdentity: async (previousUserId) => {
        if (previousUserId === undefined) return;
        await clearPrivateUserData(queryClient, mutationRegistry, previousUserId);
      },
      executeReturnIntent: async (intent, user, epoch) => {
        if (intent.kind === 'navigate') {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/profile');
          }
          return;
        }
        const transport = mutationRegistry.create(user.id, epoch);
        try {
          await saveJob(intent.jobSlug, epoch, transport.signal);
          if (!instance.isOwnerCurrent(user.id, epoch)) return;
          queryClient.setQueryData<string[]>(privateKeys.savedJobs(user.id), (previous = []) =>
            previous.includes(intent.jobSlug) ? previous : [...previous, intent.jobSlug],
          );
          if (router.canGoBack()) {
            router.back();
          } else if (intent.fallbackDestination === 'job') {
            router.replace({ pathname: '/jobs/[slug]', params: { slug: intent.jobSlug } });
          } else {
            router.replace('/');
          }
        } finally {
          transport.release();
        }
      },
      openOAuth: async (provider) => {
        const result = await WebBrowser.openAuthSessionAsync(authApi.oauthStartUrl(provider), OAUTH_CALLBACK);
        if (result.type !== 'success') return { cancelled: true };
        const callback = codeFromCallbackUrl(result.url);
        if (callback.error) throw new Error('oauth');
        return { code: callback.code, cancelled: !callback.code };
      },
      openOAuthV2: (url) => openOAuthV2(url),
    });
    return instance;
  });

  useEffect(() => returnIntents.subscribe(setReturnIntent), [returnIntents]);

  useEffect(() => {
    const unsubscribe = subscribeUnauthorized((event) => void coordinator.handleUnauthorized(event));
    void coordinator.bootstrap();
    return () => {
      unsubscribe();
      coordinator.cancelCurrent();
    };
  }, [coordinator]);

  useEffect(() => {
    let previous = AppState.currentState;
    let lastRefresh = 0;
    const subscription = AppState.addEventListener('change', (next) => {
      const becameActive = previous !== 'active' && next === 'active';
      previous = next;
      const status = coordinator.getState().status;
      if (becameActive && (status === 'authenticated' || status === 'refreshing') && Date.now() - lastRefresh > 1_000) {
        lastRefresh = Date.now();
        void coordinator.revalidate('foreground');
      }
    });
    return () => subscription.remove();
  }, [coordinator]);

  const signIn = useCallback((email: string, password: string) => coordinator.login(email, password), [coordinator]);
  const signUp = useCallback((email: string, password: string) => coordinator.register(email, password), [coordinator]);
  const signInWithProvider = useCallback((provider: string) => coordinator.oauth(provider), [coordinator]);
  const signInWithProviderV2 = useCallback(
    (provider: string, purpose?: 'sign_in' | 'reauth') => coordinator.oauthV2(provider, purpose),
    [coordinator],
  );
  const signInWithApple = useCallback(
    (purpose?: 'sign_in' | 'reauth') => coordinator.appleSignIn(purpose),
    [coordinator],
  );
  const passwordReauth = useCallback(
    (password: string) => coordinator.passwordReauth(password),
    [coordinator],
  );
  const appleReauth = useCallback(() => coordinator.appleReauth(), [coordinator]);
  const oauthReauth = useCallback(
    (provider: string) => coordinator.oauthReauth(provider),
    [coordinator],
  );
  const deleteAccount = useCallback(
    async (email?: string) => {
      try {
        await unregisterThisDevice();
      } catch {
        // quiet fallback
      }
      await coordinator.deleteAccount(email);
    },
    [coordinator],
  );
  const signOut = useCallback(async () => {
    try {
      await unregisterThisDevice();
    } catch {
      // quiet fallback
    }
    await coordinator.logout();
  }, [coordinator]);
  const logoutAll = useCallback(async () => {
    try {
      await unregisterThisDevice();
    } catch {
      // quiet fallback
    }
    await coordinator.logoutAll();
  }, [coordinator]);

  const retryBootstrap = useCallback(() => coordinator.retryBootstrap(), [coordinator]);
  const revalidate = useCallback(() => coordinator.revalidate('explicit'), [coordinator]);
  const recordReturnIntent = useCallback((intent: ReturnIntent) => coordinator.recordReturnIntent(intent), [coordinator]);
  const clearReturnIntent = useCallback(() => coordinator.clearReturnIntent(), [coordinator]);
  const retryReturnIntent = useCallback(() => coordinator.retryReturnIntent(), [coordinator]);
  const isOwnerCurrent = useCallback(
    (owner: SessionOwner) => coordinator.isOwnerCurrent(owner.userId, owner.sessionEpoch),
    [coordinator],
  );
  const createPrivateMutation = useCallback(
    (owner: SessionOwner) => mutationRegistry.create(owner.userId, owner.sessionEpoch),
    [mutationRegistry],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      user: visibleUser(state),
      loading: state.status === 'bootstrapping',
      sessionEpoch,
      returnIntent,
      signIn,
      signUp,
      signInWithProvider,
      signInWithProviderV2,
      signInWithApple,
      passwordReauth,
      appleReauth,
      oauthReauth,
      deleteAccount,
      signOut,
      logoutAll,
      retryBootstrap,
      revalidate,
      recordReturnIntent,
      clearReturnIntent,
      retryReturnIntent,
      isOwnerCurrent,
      createPrivateMutation,
    }),
    [
      state,
      sessionEpoch,
      returnIntent,
      signIn,
      signUp,
      signInWithProvider,
      signInWithProviderV2,
      signInWithApple,
      passwordReauth,
      appleReauth,
      oauthReauth,
      deleteAccount,
      signOut,
      logoutAll,
      retryBootstrap,
      revalidate,
      recordReturnIntent,
      clearReturnIntent,
      retryReturnIntent,
      isOwnerCurrent,
      createPrivateMutation,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export function useOAuthProviders(): string[] {
  const { data } = useQuery({
    queryKey: publicKeys.oauthProviders,
    queryFn: ({ signal }) => authApi.oauthProviders(signal),
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data ?? [];
}
