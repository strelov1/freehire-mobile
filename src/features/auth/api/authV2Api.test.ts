import { authV2Api } from './authV2Api';
import * as transport from '@/lib/transport';

jest.mock('@/lib/transport', () => {
  const original = jest.requireActual('@/lib/transport');
  return {
    ...original,
    request: jest.fn(),
  };
});

const mockedRequest = transport.request as jest.MockedFunction<typeof transport.request>;

describe('authV2Api', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('providers', () => {
    it('calls GET /api/v2/auth/providers and returns providers payload', async () => {
      const mockPayload = {
        data: {
          schema_version: 2,
          providers: [
            { id: 'google', flow: 'browser_oauth', platforms: ['ios', 'android'], available: true },
            { id: 'apple', flow: 'native_apple', platforms: ['ios'], available: true },
          ],
        },
      };
      mockedRequest.mockResolvedValueOnce(mockPayload);

      const result = await authV2Api.providers();
      expect(mockedRequest).toHaveBeenCalledWith('/api/v2/auth/providers', expect.objectContaining({
        method: 'GET',
        authMode: 'public',
        expectsBody: true,
      }));
      expect(result).toEqual(mockPayload.data);
    });
  });

  describe('oauthStartUrl', () => {
    it('formats PKCE start URL with query parameters', () => {
      const urlString = authV2Api.oauthStartUrl('google', {
        provider: 'google',
        platform: 'ios',
        callbackTarget: 'freehiremobile://oauth-callback',
        purpose: 'sign_in',
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });

      const parsed = new URL(urlString);
      expect(parsed.pathname).toBe('/api/v2/auth/oauth/google/start');
      expect(parsed.searchParams.get('platform')).toBe('ios');
      expect(parsed.searchParams.get('callback_target')).toBe('freehiremobile://oauth-callback');
      expect(parsed.searchParams.get('purpose')).toBe('sign_in');
      expect(parsed.searchParams.get('code_challenge')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });
  });

  describe('oauthExchange', () => {
    it('calls POST /api/v2/auth/oauth/exchange with code and verifier', async () => {
      const mockUser = { id: 1, email: 'user@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: true, created_at: null };
      mockedRequest.mockResolvedValueOnce({ data: mockUser });

      const result = await authV2Api.oauthExchange('otc_123', 'verifier_456');
      expect(mockedRequest).toHaveBeenCalledWith('/api/v2/auth/oauth/exchange', expect.objectContaining({
        method: 'POST',
        authMode: 'public',
        body: { code: 'otc_123', code_verifier: 'verifier_456' },
      }));
      expect(result).toEqual(mockUser);
    });
  });

  describe('appleAttempt', () => {
    it('calls POST /api/v2/auth/apple/attempt with purpose and nonce_challenge', async () => {
      const mockAttempt = { attempt_id: 'att_123', expires_at: '2026-08-13T19:00:00Z' };
      mockedRequest.mockResolvedValueOnce({ data: mockAttempt });

      const result = await authV2Api.appleAttempt('sign_in', 'challenge_hex');
      expect(mockedRequest).toHaveBeenCalledWith('/api/v2/auth/apple/attempt', expect.objectContaining({
        method: 'POST',
        authMode: 'public',
        body: { purpose: 'sign_in', nonce_challenge: 'challenge_hex' },
      }));
      expect(result).toEqual(mockAttempt);
    });
  });

  describe('appleExchange', () => {
    it('calls POST /api/v2/auth/apple/exchange with params', async () => {
      const mockParams = {
        attempt_id: 'att_123',
        identity_token: 'id_token_xyz',
        authorization_code: 'auth_code_xyz',
        raw_nonce: 'raw_nonce_hex',
      };
      const mockUser = { id: 2, email: 'apple@example.com', role: 'user', beta_tester: false, email_verified: true, has_password: false, created_at: null };
      mockedRequest.mockResolvedValueOnce({ data: mockUser });

      const result = await authV2Api.appleExchange(mockParams);
      expect(mockedRequest).toHaveBeenCalledWith('/api/v2/auth/apple/exchange', expect.objectContaining({
        method: 'POST',
        authMode: 'public',
        body: mockParams,
      }));
      expect(result).toEqual(mockUser);
    });
  });

  describe('passwordReauth', () => {
    it('calls POST /api/v2/auth/reauth/password with password and sessionEpoch', async () => {
      const mockProof = { recent_auth_expires_at: '2026-08-13T19:05:00Z' };
      mockedRequest.mockResolvedValueOnce({ data: mockProof });

      const result = await authV2Api.passwordReauth('secret123', 5);
      expect(mockedRequest).toHaveBeenCalledWith('/api/v2/auth/reauth/password', expect.objectContaining({
        method: 'POST',
        authMode: 'required',
        body: { password: 'secret123' },
        sessionEpoch: 5,
      }));
      expect(result).toEqual(mockProof);
    });
  });

  describe('identities', () => {
    it('calls GET /api/v2/auth/identities and returns identity list', async () => {
      const mockIdentities = [
        { provider: 'google', provider_email: 'g@example.com', linked_at: '2026-01-01T00:00:00Z', status: 'active' },
      ];
      mockedRequest.mockResolvedValueOnce({ data: mockIdentities });

      const result = await authV2Api.identities(3);
      expect(mockedRequest).toHaveBeenCalledWith('/api/v2/auth/identities', expect.objectContaining({
        method: 'GET',
        authMode: 'required',
        sessionEpoch: 3,
      }));
      expect(result).toEqual(mockIdentities);
    });
  });

  describe('unlinkIdentity', () => {
    it('calls DELETE /api/v2/auth/identities/:provider and handles 204 bodyless undefined', async () => {
      mockedRequest.mockResolvedValueOnce(undefined);

      const result = await authV2Api.unlinkIdentity('google', 2);
      expect(mockedRequest).toHaveBeenCalledWith('/api/v2/auth/identities/google', expect.objectContaining({
        method: 'DELETE',
        authMode: 'required',
        sessionEpoch: 2,
      }));
      expect(result).toEqual({ status: 'unlinked' });
    });

    it('handles revocation_pending status from backend', async () => {
      mockedRequest.mockResolvedValueOnce({ data: { status: 'revocation_pending' } });

      const result = await authV2Api.unlinkIdentity('apple', 2);
      expect(result).toEqual({ status: 'revocation_pending' });
    });
  });

  describe('deleteAccount', () => {
    it('calls DELETE /api/v1/me with email in body and sessionEpoch', async () => {
      mockedRequest.mockResolvedValueOnce(undefined);

      await authV2Api.deleteAccount('user@example.com', 4);
      expect(mockedRequest).toHaveBeenCalledWith('/api/v1/me', expect.objectContaining({
        method: 'DELETE',
        authMode: 'required',
        body: { email: 'user@example.com' },
        sessionEpoch: 4,
      }));
    });
  });
});
