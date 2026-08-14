import { normalizeApiBase } from './app.config';

describe('release API configuration', () => {
  it('normalizes a valid origin', () => {
    expect(normalizeApiBase('https://freehire.me/', false)).toBe('https://freehire.me');
  });

  it('fails a release config before build when the API base is missing', () => {
    expect(() => normalizeApiBase(undefined, false)).toThrow('required');
  });

  it.each([
    'https://user:pass@freehire.me',
    'https://freehire.me/api',
    'https://freehire.me?x=1',
    'https://freehire.me/#fragment',
    'http://freehire.me',
  ])('rejects a non-origin or insecure release value: %s', (value) => {
    expect(() => normalizeApiBase(value, false)).toThrow();
  });

  it('allows explicit localhost and Android emulator host HTTP during development', () => {
    expect(normalizeApiBase('http://localhost:8080/', true)).toBe('http://localhost:8080');
    expect(normalizeApiBase('http://10.0.2.2:8080/', true)).toBe('http://10.0.2.2:8080');
    expect(() => normalizeApiBase('http://example.test', true)).toThrow();
  });
});
