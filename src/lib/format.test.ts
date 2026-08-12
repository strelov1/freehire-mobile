import { profileLocationSummary } from './format';
import type { LocationPreferences } from './types';

describe('profileLocationSummary', () => {
  it('returns no lines for null', () => {
    expect(profileLocationSummary(null)).toEqual([]);
  });

  it('summarizes work modes as one line', () => {
    const loc: LocationPreferences = { work_modes: ['remote', 'onsite'], relocation: { open: false } };
    expect(profileLocationSummary(loc)).toEqual(['Open to: Remote, On-site']);
  });

  it('summarizes remote reach, labelling regions and uppercasing countries', () => {
    const loc: LocationPreferences = {
      remote: { regions: ['eu', 'latam'], countries: ['de', 'br'] },
      relocation: { open: false },
    };
    expect(profileLocationSummary(loc)).toEqual(['Remote: Europe, LATAM, DE, BR']);
  });

  it('summarizes the base as country and city together', () => {
    const loc: LocationPreferences = { base: { country: 'de', city: 'Berlin' }, relocation: { open: false } };
    expect(profileLocationSummary(loc)).toEqual(['Based in: Berlin, DE']);
  });

  it('summarizes the base with only a country', () => {
    const loc: LocationPreferences = { base: { country: 'de' }, relocation: { open: false } };
    expect(profileLocationSummary(loc)).toEqual(['Based in: DE']);
  });

  it('summarizes the base with only a city', () => {
    const loc: LocationPreferences = { base: { city: 'Berlin' }, relocation: { open: false } };
    expect(profileLocationSummary(loc)).toEqual(['Based in: Berlin']);
  });

  it('includes relocation targets only when open is true', () => {
    const loc: LocationPreferences = {
      relocation: { open: true, regions: ['uk'], countries: ['us'] },
    };
    expect(profileLocationSummary(loc)).toEqual(['Open to relocation: UK, US']);
  });

  it('omits relocation entirely when open is false, even with targets present', () => {
    const loc: LocationPreferences = {
      relocation: { open: false, regions: ['uk'], countries: ['us'] },
    };
    expect(profileLocationSummary(loc)).toEqual([]);
  });

  it('orders all parts consistently, each independently omitted when empty', () => {
    const loc: LocationPreferences = {
      work_modes: ['hybrid'],
      remote: { regions: ['eu'] },
      base: { country: 'de', city: 'Berlin' },
      relocation: { open: true, countries: ['us'] },
    };
    expect(profileLocationSummary(loc)).toEqual([
      'Open to: Hybrid',
      'Remote: Europe',
      'Based in: Berlin, DE',
      'Open to relocation: US',
    ]);
  });
});
