import { apiBase } from '@/lib/config';
import { request, type AuthMode } from '@/lib/transport';
import type { User } from '@/lib/types';
import type {
  V2ProviderList,
  OAuthStartParams,
  AppleAttemptResult,
  AppleExchangeParams,
  RecentAuthProof,
  Identity,
  UnlinkResult,
} from '../model/authV2Types';

import { authEndpoints, v2UnlinkIdentityEndpoint } from './authEndpoints';

type Data<T> = { data: T };

function call<T>(
  endpoint: { path: string; method: string; authMode: AuthMode; expectsBody?: boolean },
  body?: unknown,
  signal?: AbortSignal,
  sessionEpoch?: number
): Promise<T> {
  return request<T>(endpoint.path, {
    method: endpoint.method,
    authMode: endpoint.authMode,
    expectsBody: endpoint.expectsBody,
    body,
    signal,
    sessionEpoch,
    cache: 'no-store',
  });
}

export const authV2Api = {
  /** Fetch available v2 auth providers */
  async providers(signal?: AbortSignal): Promise<V2ProviderList> {
    const res = await call<Data<V2ProviderList>>(authEndpoints.v2Providers, undefined, signal);
    return res.data;
  },

  /** Construct PKCE OAuth start URL with query parameters */
  oauthStartUrl(provider: string, params: OAuthStartParams): string {
    const url = new URL(`${apiBase}/api/v2/auth/oauth/${encodeURIComponent(provider)}/start`);
    url.searchParams.set('platform', params.platform);
    url.searchParams.set('callback_target', params.callbackTarget);
    url.searchParams.set('purpose', params.purpose);
    url.searchParams.set('code_challenge', params.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  },

  /** Exchange OAuth OTC code + verifier for User session or RecentAuthProof */
  async oauthExchange(code: string, codeVerifier: string, signal?: AbortSignal): Promise<User | RecentAuthProof> {
    const res = await call<Data<User | RecentAuthProof>>(
      authEndpoints.v2OAuthExchange,
      { code, code_verifier: codeVerifier },
      signal
    );
    return res.data;
  },

  /** Create Apple sign-in attempt */
  async appleAttempt(purpose: 'sign_in' | 'reauth', nonceChallenge: string, signal?: AbortSignal): Promise<AppleAttemptResult> {
    const res = await call<Data<AppleAttemptResult>>(
      authEndpoints.v2AppleAttempt,
      { purpose, nonce_challenge: nonceChallenge },
      signal
    );
    return res.data;
  },

  /** Exchange Apple credentials for User session or RecentAuthProof */
  async appleExchange(params: AppleExchangeParams, signal?: AbortSignal): Promise<User | RecentAuthProof> {
    const res = await call<Data<User | RecentAuthProof>>(
      authEndpoints.v2AppleExchange,
      params,
      signal
    );
    return res.data;
  },

  /** Reauthenticate with password to acquire recent-auth proof */
  async passwordReauth(password: string, sessionEpoch?: number, signal?: AbortSignal): Promise<RecentAuthProof> {
    const res = await call<Data<RecentAuthProof>>(
      authEndpoints.v2PasswordReauth,
      { password },
      signal,
      sessionEpoch
    );
    return res.data;
  },

  /** Get list of linked identities */
  async identities(sessionEpoch?: number, signal?: AbortSignal): Promise<Identity[]> {
    const res = await call<Data<Identity[] | { identities?: Identity[]; has_password?: boolean }>>(
      authEndpoints.v2Identities,
      undefined,
      signal,
      sessionEpoch
    );
    if (!res?.data) return [];
    if (Array.isArray(res.data)) return res.data;
    if (Array.isArray((res.data as { identities?: Identity[] }).identities)) {
      return (res.data as { identities: Identity[] }).identities;
    }
    return [];
  },

  /** Unlink connected identity */
  async unlinkIdentity(provider: string, sessionEpoch?: number, signal?: AbortSignal): Promise<UnlinkResult> {
    const endpoint = v2UnlinkIdentityEndpoint(provider);
    const res = await call<Data<UnlinkResult> | undefined>(
      endpoint,
      undefined,
      signal,
      sessionEpoch
    );
    return res?.data ?? { status: 'unlinked' };
  },

  /** Delete account via DELETE /api/v1/me (recent-auth gated) */
  async deleteAccount(email: string, sessionEpoch?: number, signal?: AbortSignal): Promise<void> {
    await call<void>(
      authEndpoints.deleteAccount,
      { email },
      signal,
      sessionEpoch
    );
  },
};
