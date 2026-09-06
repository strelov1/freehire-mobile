import { freshnessBadges } from './reality';
import type { Reality } from './types';

describe('freshnessBadges', () => {
  const fresh: Reality = {
    class: 'fresh',
    age_days: 1,
    repost_count: 1,
    mass_posting_count: 1,
    fake_freshness: false,
  };
  const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();

  it('calls a recent posting new', () => {
    expect(freshnessBadges(iso(1), fresh, 0)).toEqual(['New', 'Be an early applicant']);
  });

  it('drops the early-applicant invitation once the job is not that new', () => {
    expect(freshnessBadges(iso(5), fresh, 0)).toEqual(['New']);
  });

  it('drops it once enough people have said they applied', () => {
    expect(freshnessBadges(iso(1), fresh, 9)).toEqual(['New']);
  });

  it('says nothing about a posting older than a week', () => {
    expect(freshnessBadges(iso(30), fresh, 0)).toEqual([]);
  });

  it('claims nothing without a reality signal', () => {
    // A card that cannot verify freshness would otherwise print "New" on exactly
    // the postings whose source rewrites its date every crawl.
    expect(freshnessBadges(iso(1), null, 0)).toEqual([]);
    expect(freshnessBadges(iso(1), undefined, 0)).toEqual([]);
  });

  it('claims nothing when the signal distrusts the date', () => {
    expect(freshnessBadges(iso(1), { ...fresh, fake_freshness: true }, 0)).toEqual([]);
    expect(freshnessBadges(iso(1), { ...fresh, class: 'stale' }, 0)).toEqual([]);
  });

  it('says nothing about a closed posting, whatever its date', () => {
    expect(freshnessBadges(iso(1), fresh, 0, iso(0))).toEqual([]);
  });

  it('says nothing without a date at all', () => {
    expect(freshnessBadges(null, fresh, 0)).toEqual([]);
    expect(freshnessBadges('not a date', fresh, 0)).toEqual([]);
  });
});
