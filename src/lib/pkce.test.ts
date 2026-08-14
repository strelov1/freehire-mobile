import { generateVerifier, computeChallenge, base64ToBase64Url, bytesToBase64Url } from './pkce';

describe('PKCE Utilities (src/lib/pkce.ts)', () => {
  describe('base64ToBase64Url', () => {
    it('converts standard base64 to base64url format', () => {
      expect(base64ToBase64Url('abc+def/ghi==')).toBe('abc-def_ghi');
      expect(base64ToBase64Url('A+B/C=')).toBe('A-B_C');
    });
  });

  describe('bytesToBase64Url', () => {
    it('converts Uint8Array to base64url format without padding', () => {
      const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result = bytesToBase64Url(bytes);
      expect(result).toBe('SGVsbG8');
      expect(result).not.toContain('=');
      expect(result).not.toContain('+');
      expect(result).not.toContain('/');
    });
  });

  describe('generateVerifier', () => {
    it('generates a 43-character base64url string', () => {
      const verifier = generateVerifier();
      expect(verifier).toHaveLength(43);
      expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('generates unique verifiers across calls', () => {
      const v1 = generateVerifier();
      const v2 = generateVerifier();
      expect(v1).not.toBe(v2);
    });
  });

  describe('computeChallenge', () => {
    it('computes S256 challenge matching RFC 7636 Appendix B test vector', async () => {
      const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
      const challenge = await computeChallenge(verifier);
      expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
      expect(challenge).toHaveLength(43);
      expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    });

    it('throws TypeError for empty or non-string verifier', async () => {
      await expect(computeChallenge('')).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(computeChallenge(null)).rejects.toThrow(TypeError);
    });

    it('throws Error for verifiers containing invalid characters', async () => {
      await expect(computeChallenge('invalid verifier with spaces!')).rejects.toThrow();
    });
  });
});
