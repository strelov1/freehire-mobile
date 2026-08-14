export type V2ProviderFlow = 'browser_oauth' | 'native_apple';

export type V2Provider = {
  id: string;
  flow: V2ProviderFlow;
  platforms: string[];
  available: boolean;
};

export type V2ProviderList = {
  schema_version: number;
  providers: V2Provider[];
};

export type OAuthStartParams = {
  provider: string;
  platform: 'ios' | 'android';
  callbackTarget: string;
  purpose: 'sign_in' | 'reauth';
  codeChallenge: string;
};

export type AppleAttemptResult = {
  attempt_id: string;
  expires_at: string;
};

export type AppleExchangeParams = {
  attempt_id: string;
  identity_token: string;
  authorization_code: string;
  raw_nonce: string;
};

export type RecentAuthProof = {
  recent_auth_expires_at: string;
};

export type Identity = {
  provider: string;
  provider_email?: string;
  linked_at: string;
  status: 'active' | 'revocation_pending' | string;
  can_unlink?: boolean;
};

export type IdentitiesResponse = {
  has_password: boolean;
  identities: Identity[];
};

export type UnlinkResult = {
  status: 'unlinked' | 'revocation_pending';
};
