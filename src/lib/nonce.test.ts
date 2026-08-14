import { generateNonce, sha256Hex, bytesToHex } from './nonce';

describe('Nonce Utilities (src/lib/nonce.ts)', () => {
  describe('bytesToHex', () => {
    it('converts Uint8Array to lowercase hex string', () => {
      const bytes = new Uint8Array([0, 15, 16, 255]);
      expect(bytesToHex(bytes)).toBe('000f10ff');
    });
  });

  describe('generateNonce', () => {
    it('generates a 64-character lowercase hex string (32 bytes)', () => {
      const nonce = generateNonce();
      expect(nonce).toHaveLength(64);
      expect(nonce).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates distinct nonces', () => {
      const n1 = generateNonce();
      const n2 = generateNonce();
      expect(n1).not.toBe(n2);
    });
  });

  describe('sha256Hex', () => {
    it('computes deterministic sha256 hex digest', async () => {
      const input = 'hello-world';
      const digest = await sha256Hex(input);
      expect(digest).toBe('afa27b44d43b02a9fea41d13cedc2e4016cfcf87c5dbf990e593669aa8ce286d');
      expect(digest).toHaveLength(64);
      expect(digest).toMatch(/^[0-9a-f]{64}$/);
    });

    it('throws TypeError for empty or non-string input', async () => {
      await expect(sha256Hex('')).rejects.toThrow(TypeError);
      // @ts-ignore
      await expect(sha256Hex(null)).rejects.toThrow(TypeError);
    });
  });
});
