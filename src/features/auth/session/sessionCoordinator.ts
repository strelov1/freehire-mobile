import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { generateVerifier, computeChallenge } from '@/lib/pkce';
import { generateNonce, sha256Hex } from '@/lib/nonce';
import type { User } from '@/lib/types';
import { ApiError } from '@/lib/transport';

import { authV2Api } from '../api/authV2Api';
import type { RecentAuthProof } from '../model/authV2Types';
import type { ReturnIntent, ReturnIntentManager } from '../model/returnIntent';
import type { AuthCompletion, AuthOperation, AvailabilityKind, GuestReason, SessionState } from '../model/authTypes';
import { sessionReducer, type SessionAction } from './sessionReducer';

type SessionApi = {
  me(signal?: AbortSignal): Promise<User>;
  login(email: string, password: string, signal?: AbortSignal): Promise<User>;
  register(email: string, password: string, signal?: AbortSignal): Promise<User>;
  exchangeOAuth(code: string, signal?: AbortSignal): Promise<User>;
  logout(signal?: AbortSignal): Promise<void>;
  logoutAll(sessionEpoch: number, signal?: AbortSignal): Promise<void>;
};

type CoordinatorDependencies = {
  api: SessionApi;
  returnIntents: ReturnIntentManager;
  onStateChange: (state: SessionState) => void;
  transitionIdentity: (previousUserId: number | undefined, nextUserId: number | undefined, nextEpoch: number) => Promise<void>;
  executeReturnIntent: (intent: ReturnIntent, user: User, sessionEpoch: number) => Promise<void>;
  openOAuth: (provider: string) => Promise<{ code?: string; cancelled: boolean }>;
  openOAuthV2?: (url: string) => Promise<{ code?: string; cancelled: boolean }>;
};

type Operation = { generation: number; epoch: number; controller: AbortController };

function availabilityKind(error: unknown): AvailabilityKind {
  if (error instanceof ApiError) {
    if (error.kind === 'offline') return 'offline';
    if (error.kind === 'timeout') return 'timeout';
    if (error.kind === 'server') return 'server';
  }
  return 'protocol';
}

/**
 * Sole owner of session generations and identity epochs. Async completions must
 * pass both fences before they can publish state or touch private ownership.
 */
export class SessionCoordinator {
  private state: SessionState = { status: 'bootstrapping' };
  private committedUser?: User;
  private generation = 0;
  private sessionEpoch = 0;
  private active?: AbortController;

  constructor(private readonly dependencies: CoordinatorDependencies) {}

  getState() {
    return this.state;
  }

  getUser() {
    return this.committedUser;
  }

  getSessionEpoch() {
    return this.sessionEpoch;
  }

  isOwnerCurrent(userId: number, epoch: number) {
    return this.committedUser?.id === userId && this.sessionEpoch === epoch;
  }

  cancelCurrent() {
    this.generation += 1;
    this.active?.abort();
    this.active = undefined;
    if (
      this.state.status === 'signingOut' ||
      this.state.status === 'authenticating' ||
      this.state.status === 'refreshing'
    ) {
      if (this.committedUser) {
        this.publish({ type: 'AUTHENTICATED', user: this.committedUser });
      } else {
        this.publish({ type: 'GUEST', reason: 'no_session' });
      }
    }
  }

  async bootstrap() {
    const operation = this.begin({ type: 'BOOTSTRAP' });
    try {
      const user = await this.dependencies.api.me(operation.controller.signal);
      if (!this.isCurrent(operation)) return;
      await this.commitUser(user, operation);
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return;
      if (error instanceof ApiError && error.status === 401) {
        await this.commitGuest('no_session', operation);
      } else {
        this.publish({ type: 'UNAVAILABLE', kind: availabilityKind(error) });
      }
    }
  }

  retryBootstrap() {
    return this.bootstrap();
  }

  async revalidate(_reason: 'foreground' | 'explicit') {
    const confirmed = this.committedUser;
    if (!confirmed) return;
    const operation = this.begin({ type: 'REFRESHING', user: confirmed });
    try {
      const user = await this.dependencies.api.me(operation.controller.signal);
      if (!this.isCurrent(operation)) return;
      if (user.id !== confirmed.id) {
        await this.commitUser(user, operation);
      } else {
        this.committedUser = user;
        this.publish({ type: 'AUTHENTICATED', user });
      }
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return;
      if (error instanceof ApiError && error.status === 401) {
        await this.commitGuest('expired', operation);
      } else {
        this.publish({ type: 'REFRESHING', user: confirmed, issue: availabilityKind(error) });
      }
    }
  }

  login(email: string, password: string) {
    return this.authenticate('login', (signal) => this.dependencies.api.login(email, password, signal));
  }

  register(email: string, password: string) {
    return this.authenticate('register', (signal) => this.dependencies.api.register(email, password, signal));
  }

  completeOAuth(code: string) {
    return this.authenticate('oauth', (signal) => this.dependencies.api.exchangeOAuth(code, signal));
  }

  async oauth(provider: string): Promise<AuthCompletion> {
    const previousState = this.state;
    const operation = this.begin({ type: 'AUTHENTICATING', operation: 'oauth' });
    try {
      const browser = await this.dependencies.openOAuth(provider);
      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };
      if (browser.cancelled || !browser.code) {
        this.restoreAfterAuthFailure(previousState);
        return { status: 'cancelled', intent: 'none' };
      }
      const user = await this.dependencies.api.exchangeOAuth(browser.code, operation.controller.signal);
      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };
      return this.finishAuthentication(user, operation);
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return { status: 'cancelled', intent: 'none' };
      this.restoreAfterAuthFailure(previousState);
      throw error;
    }
  }

  async oauthV2(
    provider: string,
    purpose: 'sign_in' | 'reauth' = 'sign_in',
  ): Promise<AuthCompletion | RecentAuthProof> {
    const previousState = this.state;
    const operation = this.begin({ type: 'AUTHENTICATING', operation: 'oauth' });
    try {
      const verifier = generateVerifier();
      const codeChallenge = await computeChallenge(verifier);
      const callbackTarget = 'freehiremobile://auth-callback';
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const url = authV2Api.oauthStartUrl(provider, {
        provider,
        platform,
        callbackTarget,
        purpose,
        codeChallenge,
      });

      const opener = this.dependencies.openOAuthV2;
      const browser = opener ? await opener(url) : await this.dependencies.openOAuth(provider);
      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };
      if (browser.cancelled || !browser.code) {
        this.restoreAfterAuthFailure(previousState);
        return { status: 'cancelled', intent: 'none' };
      }

      const res = await authV2Api.oauthExchange(browser.code, verifier, operation.controller.signal);
      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };

      if ('recent_auth_expires_at' in res) {
        this.restoreAfterAuthFailure(previousState);
        return res;
      } else {
        return this.finishAuthentication(res, operation);
      }
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return { status: 'cancelled', intent: 'none' };
      this.restoreAfterAuthFailure(previousState);
      throw error;
    }
  }

  async appleSignIn(
    purpose: 'sign_in' | 'reauth' = 'sign_in',
  ): Promise<AuthCompletion | RecentAuthProof> {
    const previousState = this.state;
    const operation = this.begin({ type: 'AUTHENTICATING', operation: 'oauth' });
    try {
      const rawNonce = generateNonce();
      const nonceChallenge = await sha256Hex(rawNonce);
      const attempt = await authV2Api.appleAttempt(purpose, nonceChallenge, operation.controller.signal);
      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };

      let credential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: nonceChallenge,
        });
      } catch (err: unknown) {
        const errorWithCode = err as { code?: string; message?: string };
        if (
          errorWithCode &&
          (errorWithCode.code === 'ERR_REQUEST_CANCELED' ||
            errorWithCode.code === 'ERR_CANCELED' ||
            errorWithCode.code === '1001' ||
            (typeof errorWithCode.message === 'string' && errorWithCode.message.toLowerCase().includes('cancel')))
        ) {
          if (this.isCurrent(operation)) {
            this.restoreAfterAuthFailure(previousState);
          }
          return { status: 'cancelled', intent: 'none' };
        }
        throw err;
      }

      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };

      const res = await authV2Api.appleExchange(
        {
          attempt_id: attempt.attempt_id,
          identity_token: credential.identityToken ?? '',
          authorization_code: credential.authorizationCode ?? '',
          raw_nonce: rawNonce,
        },
        operation.controller.signal,
      );

      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };

      if ('recent_auth_expires_at' in res) {
        this.restoreAfterAuthFailure(previousState);
        return res;
      } else {
        return this.finishAuthentication(res, operation);
      }
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return { status: 'cancelled', intent: 'none' };
      this.restoreAfterAuthFailure(previousState);
      throw error;
    }
  }

  async passwordReauth(password: string): Promise<RecentAuthProof> {
    const user = this.committedUser;
    if (!user) {
      throw new Error('User must be authenticated to perform reauthentication');
    }
    const previousState = this.state;
    const operation = this.begin({ type: 'AUTHENTICATING', operation: 'login' });
    try {
      const proof = await authV2Api.passwordReauth(password, operation.epoch, operation.controller.signal);
      if (!this.isCurrent(operation)) {
        throw new Error('Reauthentication cancelled by newer operation');
      }
      this.publish({ type: 'AUTHENTICATED', user });
      return proof;
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) throw error;
      this.restoreAfterAuthFailure(previousState);
      throw error;
    }
  }

  async appleReauth(): Promise<RecentAuthProof> {
    const res = await this.appleSignIn('reauth');
    if ('recent_auth_expires_at' in res) {
      return res;
    }
    throw new Error('Expected recent auth proof from Apple reauthentication');
  }

  async oauthReauth(provider: string): Promise<RecentAuthProof> {
    const res = await this.oauthV2(provider, 'reauth');
    if ('recent_auth_expires_at' in res) {
      return res;
    }
    throw new Error('Expected recent auth proof from OAuth reauthentication');
  }

  async deleteAccount(email?: string): Promise<void> {
    const user = this.committedUser;
    if (!user) return;
    const targetEmail = email ?? user.email;
    const operation = this.begin({ type: 'SIGNING_OUT', user });
    try {
      await authV2Api.deleteAccount(targetEmail, operation.epoch, operation.controller.signal);
      if (!this.isCurrent(operation)) return;
      await this.commitGuest('deleted', operation);
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return;
      this.publish({ type: 'AUTHENTICATED', user });
      throw error;
    }
  }

  async logout() {
    const user = this.committedUser;
    if (!user) return;
    const operation = this.begin({ type: 'SIGNING_OUT', user });
    try {
      await this.dependencies.api.logout(operation.controller.signal);
      if (!this.isCurrent(operation)) return;
      await this.commitGuest('signed_out', operation);
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return;
      this.publish({ type: 'AUTHENTICATED', user });
      throw error;
    }
  }

  async logoutAll() {
    const user = this.committedUser;
    if (!user) return;
    const operation = this.begin({ type: 'SIGNING_OUT', user });
    try {
      await this.dependencies.api.logoutAll(operation.epoch, operation.controller.signal);
      if (!this.isCurrent(operation)) return;
      await this.commitGuest('signed_out_everywhere', operation);
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return;
      this.publish({ type: 'AUTHENTICATED', user });
      throw error;
    }
  }

  /** FE-7 calls this only after the server has confirmed deletion. */
  async completeDeletion() {
    const operation = this.begin();
    await this.commitGuest('deleted', operation);
  }

  async handleUnauthorized(event: { sessionEpoch: number }) {
    if (event.sessionEpoch !== this.sessionEpoch || !this.committedUser) return;
    const operation = this.begin();
    await this.commitGuest('expired', operation);
  }

  recordReturnIntent(intent: unknown) {
    return this.dependencies.returnIntents.record(intent);
  }

  clearReturnIntent() {
    this.dependencies.returnIntents.clear();
  }

  async retryReturnIntent(): Promise<'none' | 'completed' | 'failed'> {
    const user = this.committedUser;
    if (!user) return 'none';
    return this.dependencies.returnIntents.execute((intent) =>
      this.dependencies.executeReturnIntent(intent, user, this.sessionEpoch),
    );
  }

  private async authenticate(operationName: AuthOperation, run: (signal: AbortSignal) => Promise<User>): Promise<AuthCompletion> {
    const previousState = this.state;
    const operation = this.begin({ type: 'AUTHENTICATING', operation: operationName });
    try {
      const user = await run(operation.controller.signal);
      if (!this.isCurrent(operation)) return { status: 'cancelled', intent: 'none' };
      return this.finishAuthentication(user, operation);
    } catch (error) {
      if (!this.isCurrent(operation) || this.isAbort(error)) return { status: 'cancelled', intent: 'none' };
      this.restoreAfterAuthFailure(previousState);
      throw error;
    }
  }

  private async finishAuthentication(user: User, operation: Operation): Promise<AuthCompletion> {
    const committed = await this.commitUser(user, operation);
    if (!committed) return { status: 'cancelled', intent: 'none' };
    const intent = await this.dependencies.returnIntents.execute((pending) =>
      this.dependencies.executeReturnIntent(pending, user, this.sessionEpoch),
    );
    return { status: 'success', intent };
  }

  private restoreAfterAuthFailure(previousState: SessionState) {
    if (this.committedUser) this.publish({ type: 'AUTHENTICATED', user: this.committedUser });
    else if (previousState.status === 'unavailable') this.publish({ type: 'UNAVAILABLE', kind: previousState.kind });
    else this.publish({ type: 'GUEST', reason: previousState.status === 'guest' ? previousState.reason : 'no_session' });
  }

  private begin(action?: SessionAction): Operation {
    this.active?.abort();
    const controller = new AbortController();
    this.active = controller;
    const operation = { generation: ++this.generation, epoch: this.sessionEpoch, controller };
    if (action) this.publish(action);
    return operation;
  }

  private isCurrent(operation: Operation) {
    return operation.generation === this.generation;
  }

  private async commitUser(user: User, operation: Operation): Promise<boolean> {
    const previousUserId = this.committedUser?.id;
    const nextEpoch = ++this.sessionEpoch;
    this.active?.abort();
    await this.dependencies.transitionIdentity(previousUserId, user.id, nextEpoch);
    if (!this.isCurrent(operation)) return false;
    this.committedUser = user;
    this.publish({ type: 'AUTHENTICATED', user });
    return true;
  }

  private async commitGuest(reason: GuestReason, operation: Operation) {
    const previousUserId = this.committedUser?.id;
    const nextEpoch = ++this.sessionEpoch;
    this.active?.abort();
    await this.dependencies.transitionIdentity(previousUserId, undefined, nextEpoch);
    if (!this.isCurrent(operation)) return;
    this.committedUser = undefined;
    this.dependencies.returnIntents.clear();
    this.publish({ type: 'GUEST', reason });
  }

  private publish(action: SessionAction) {
    this.state = sessionReducer(this.state, action);
    this.dependencies.onStateChange(this.state);
  }

  private isAbort(error: unknown) {
    return error instanceof ApiError && error.kind === 'aborted';
  }
}
