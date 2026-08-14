import { generateVerifier, computeChallenge, base64ToBase64Url, bytesToBase64Url } from './pkce';
import { generateNonce, sha256Hex, bytesToHex } from './nonce';
import { codeFromCallbackUrl } from './oauth';
import { authV2Api } from '../features/auth/api/authV2Api';
import crypto from 'crypto';

describe('Empirical Challenge - Milestone 1 Utilities', () => {
  describe('PKCE Verifier & Challenge Empirical Stress Tests', () => {
    it('generates 10,000 verifiers with exact 43 char length, base64url charset, and 100% uniqueness', () => {
      const COUNT = 10000;
      const set = new Set<string>();
      const charCounts: Record<string, number> = {};

      for (let i = 0; i < COUNT; i++) {
        const v = generateVerifier();
        expect(v).toHaveLength(43);
        expect(v).toMatch(/^[A-Za-z0-9_-]{43}$/);
        set.add(v);

        for (let j = 0; j < v.length; j++) {
          const ch = v[j]!;
          charCounts[ch] = (charCounts[ch] || 0) + 1;
        }
      }

      // Check collision / uniqueness
      expect(set.size).toBe(COUNT);

      // Verify character diversity: all 64 base64url characters should appear across 430,000 total chars
      const keys = Object.keys(charCounts);
      expect(keys.length).toBe(64);
    });

    it('matches RFC 7636 Appendix B test vector exactly', async () => {
      // RFC 7636 Appendix B test vector:
      // Code verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
      // Code challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const expectedChallenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';

      const challenge = await computeChallenge(verifier);

      expect(challenge).toBe(expectedChallenge);
      expect(challenge).toHaveLength(43);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);

      // Verify independently using Node crypto oracle
      const oracleHash = crypto.createHash('sha256').update(verifier, 'utf8').digest();
      const oracleB64Url = oracleHash
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');

      expect(challenge).toBe(oracleB64Url);
    });

    it('handles PKCE edge cases and invalid inputs correctly', async () => {
      // Empty string
      await expect(computeChallenge('')).rejects.toThrow(TypeError);

      // Null / undefined / non-string
      // @ts-ignore
      await expect(computeChallenge(null)).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(computeChallenge(undefined)).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(computeChallenge(12345)).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(computeChallenge({})).rejects.toThrow(TypeError);

      // Invalid characters outside RFC 7636 unreserved set [A-Za-z0-9._~-]
      await expect(computeChallenge('verifier with spaces')).rejects.toThrow(Error);
      await expect(computeChallenge('verifier!with#symbols$')).rejects.toThrow(Error);
      await expect(computeChallenge('verifier+with/slashes=')).rejects.toThrow(Error);
      await expect(computeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk🔥')).rejects.toThrow(Error);

      // Valid RFC 7636 unreserved characters (. and ~ and - and _) should pass
      const validUnreserved = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~';
      const validChallenge = await computeChallenge(validUnreserved);
      expect(validChallenge).toHaveLength(43);
      expect(validChallenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('verifies base64ToBase64Url and bytesToBase64Url helper edge cases', () => {
      expect(base64ToBase64Url('')).toBe('');
      expect(base64ToBase64Url('a+b/c=')).toBe('a-b_c');
      expect(base64ToBase64Url('a+b/c==')).toBe('a-b_c');

      expect(bytesToBase64Url(new Uint8Array([]))).toBe('');
      expect(bytesToBase64Url(new Uint8Array([72, 101, 108, 108, 111]))).toBe('SGVsbG8');

      // Test all 256 byte values 0-255 in single array
      const allBytes = new Uint8Array(256);
      for (let i = 0; i < 256; i++) allBytes[i] = i;
      const b64url = bytesToBase64Url(allBytes);
      expect(b64url).not.toContain('+');
      expect(b64url).not.toContain('/');
      expect(b64url).not.toContain('=');
    });
  });

  describe('Nonce Generation & sha256Hex Empirical Stress Tests', () => {
    it('generates 10,000 nonces with 64 char lowercase hex length, and 100% uniqueness', () => {
      const COUNT = 10000;
      const set = new Set<string>();
      const hexCounts: Record<string, number> = {};

      for (let i = 0; i < COUNT; i++) {
        const n = generateNonce();
        expect(n).toHaveLength(64);
        expect(n).toMatch(/^[0-9a-f]{64}$/);
        set.add(n);

        for (let j = 0; j < n.length; j++) {
          const ch = n[j]!;
          hexCounts[ch] = (hexCounts[ch] || 0) + 1;
        }
      }

      // Check uniqueness
      expect(set.size).toBe(COUNT);

      // Verify all 16 hex digits (0-9, a-f) appear
      expect(Object.keys(hexCounts).length).toBe(16);
    });

    it('computes sha256Hex deterministically and matches Node crypto oracle', async () => {
      const testInputs = [
        'hello-world',
        'apple-nonce-challenge-test-12345',
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789',
        '🔥emoji_test_nonce_123',
      ];

      for (const input of testInputs) {
        const digest = await sha256Hex(input);
        const oracleDigest = crypto.createHash('sha256').update(input, 'utf8').digest('hex').toLowerCase();

        expect(digest).toBe(oracleDigest);
        expect(digest).toHaveLength(64);
        expect(digest).toMatch(/^[0-9a-f]{64}$/);
      }
    });

    it('handles Nonce edge cases and invalid inputs correctly', async () => {
      // Empty string
      await expect(sha256Hex('')).rejects.toThrow(TypeError);

      // Null / undefined / non-string
      // @ts-ignore
      await expect(sha256Hex(null)).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(sha256Hex(undefined)).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(sha256Hex(9999)).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(sha256Hex({})).rejects.toThrow(TypeError);

      // bytesToHex edge cases
      expect(bytesToHex(new Uint8Array([]))).toBe('');
      expect(bytesToHex(new Uint8Array([0, 15, 16, 255]))).toBe('000f10ff');
    });
  });

  describe('OAuth & AuthV2Api Integration Utilities Tests', () => {
    it('validates OAuth start URL generation with PKCE challenge', () => {
      const urlStr = authV2Api.oauthStartUrl('google', {
        provider: 'google',
        platform: 'ios',
        callbackTarget: 'app',
        purpose: 'sign_in',
        codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
      });

      const parsed = new URL(urlStr);
      expect(parsed.pathname).toBe('/api/v2/auth/oauth/google/start');
      expect(parsed.searchParams.get('platform')).toBe('ios');
      expect(parsed.searchParams.get('callback_target')).toBe('app');
      expect(parsed.searchParams.get('purpose')).toBe('sign_in');
      expect(parsed.searchParams.get('code_challenge')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
      expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('parses callback URLs robustly under edge cases', () => {
      expect(codeFromCallbackUrl('freehiremobile://auth-callback?code=CODE123&state=xyz')).toEqual({ code: 'CODE123' });
      expect(codeFromCallbackUrl('freehiremobile://auth-callback?auth_error=oauth_denied')).toEqual({ error: 'oauth_denied' });
      expect(codeFromCallbackUrl('freehiremobile://auth-callback#code=FRAG456')).toEqual({ code: 'FRAG456' });
      expect(codeFromCallbackUrl('freehiremobile://auth-callback?unicode_code=%D1%82%D0%B5%D1%81%D1%82')).toEqual({});
      expect(codeFromCallbackUrl('freehiremobile://auth-callback?zipcode=12345')).toEqual({});
    });
  });
});
