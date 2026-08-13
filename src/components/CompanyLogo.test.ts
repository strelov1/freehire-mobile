import { companyLogoUrl } from './CompanyLogo';

describe('companyLogoUrl', () => {
  it('builds a logo.freehire.me URL from the company name', () => {
    expect(companyLogoUrl('Acme')).toBe('https://logo.freehire.me/Acme');
  });

  it('URL-encodes special characters in the name', () => {
    expect(companyLogoUrl('Acme & Co')).toBe('https://logo.freehire.me/Acme%20%26%20Co');
  });

  it('trims surrounding whitespace before building the URL', () => {
    expect(companyLogoUrl('  Acme  ')).toBe('https://logo.freehire.me/Acme');
  });

  it('returns null for an empty name', () => {
    expect(companyLogoUrl('')).toBeNull();
  });

  it('returns null for a whitespace-only name', () => {
    expect(companyLogoUrl('   ')).toBeNull();
  });
});
