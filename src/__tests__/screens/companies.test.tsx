import React from 'react';
import { useColorScheme } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { renderedText } from '@/__tests__/renderedText';
import CompaniesScreen from '@/app/(tabs)/companies';
import type { CompanyListItem, Page } from '@/lib/types';
import { useCompanySearch } from '@/lib/useCompanySearch';

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}));

jest.mock('@/lib/useCompanySearch', () => ({
  useCompanySearch: jest.fn(),
}));

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

const mockedUseCompanySearch = useCompanySearch as jest.MockedFunction<typeof useCompanySearch>;
const mockedUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

const company = (slug: string, name: string): CompanyListItem => ({
  slug,
  name,
  job_count: 3,
  tagline: null,
  industries: null,
  hq_country: null,
  collections: [],
  feedback_count: 0,
  feedback_rating_avg: null,
});

const page = (items: CompanyListItem[], total: number): Page<CompanyListItem> => ({
  data: items,
  meta: { limit: 20, offset: 0, total },
});

const refetch = jest.fn();
const fetchNextPage = jest.fn();

/** The hook's result, defaulted to "loaded, two companies" and overridable
 *  per test — the screen only reads these fields. */
function hookResult(over: Record<string, unknown> = {}) {
  return {
    data: { pages: [page([company('stripe', 'Stripe'), company('vercel', 'Vercel')], 2)] },
    isLoading: false,
    isError: false,
    error: null,
    refetch,
    isRefetching: false,
    fetchNextPage,
    hasNextPage: false,
    isFetchingNextPage: false,
    ...over,
  } as unknown as ReturnType<typeof useCompanySearch>;
}

let mounted: ReactTestRenderer.ReactTestRenderer | null = null;

function render() {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(<CompaniesScreen />);
  });
  mounted = renderer;
  return renderer;
}

/** The query the screen last asked the data layer for. */
function lastQuery(): string {
  const calls = mockedUseCompanySearch.mock.calls;
  return calls[calls.length - 1]![0];
}

describe('CompaniesScreen (src/app/(tabs)/companies.tsx)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedUseColorScheme.mockReturnValue('light');
    mockedUseCompanySearch.mockReturnValue(hookResult());
  });

  // FlashList measures itself asynchronously and lands a state update after the
  // test body returns; unmounting stops that update from arriving into a torn
  // down test and logging an unwrapped-act warning.
  afterEach(() => {
    act(() => {
      mounted?.unmount();
    });
    mounted = null;
  });

  it('lists the loaded companies with the total count', () => {
    const shown = renderedText(render());
    expect(shown).toContain('Stripe');
    expect(shown).toContain('Vercel');
    expect(shown).toContain('2 companies');
  });

  it('asks for the unfiltered catalog on first render', () => {
    render();
    expect(lastQuery()).toBe('');
  });

  it('shows a retry that refetches when the request failed', () => {
    mockedUseCompanySearch.mockReturnValue(
      hookResult({ isError: true, error: new Error('offline'), data: undefined }),
    );
    const renderer = render();
    expect(renderedText(renderer).join(' ')).toContain('Couldn’t load companies.');
    act(() => {
      renderer.root.findByProps({ accessibilityLabel: 'Retry' }).props.onPress();
    });
    expect(refetch).toHaveBeenCalled();
  });

  it('offers to clear the search when a search matched nothing', () => {
    jest.useFakeTimers();
    try {
      mockedUseCompanySearch.mockReturnValue(hookResult({ data: { pages: [page([], 0)] } }));
      const renderer = render();
      act(() => {
        renderer.root
          .findByProps({ placeholder: 'Search companies…' })
          .props.onChangeText('nothingmatchesthis');
      });
      // The empty state follows the SETTLED search, so it only calls this a
      // failed search once that search has actually been made.
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(renderedText(renderer)).toContain('No companies match your search.');
      act(() => {
        renderer.root
          .findByProps({ accessibilityLabel: 'Clear search and show all companies' })
          .props.onPress();
      });
      // Separate act: the debounce timer for the cleared value is only scheduled
      // once the state update has committed, so advancing inside the same block
      // would fire the OLD timer and leave the new one pending.
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(renderedText(renderer)).not.toContain('No companies match your search.');
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not offer to clear a search when the catalog itself is empty', () => {
    mockedUseCompanySearch.mockReturnValue(hookResult({ data: { pages: [page([], 0)] } }));
    const renderer = render();
    expect(renderedText(renderer)).toContain('No companies yet.');
    expect(
      renderer.root.findAllByProps({ accessibilityLabel: 'Clear search and show all companies' }),
    ).toHaveLength(0);
  });

  it('keeps the search field usable while the first page is loading', () => {
    mockedUseCompanySearch.mockReturnValue(hookResult({ isLoading: true, data: undefined }));
    const renderer = render();
    expect(renderer.root.findByProps({ placeholder: 'Search companies…' })).toBeTruthy();
    expect(renderedText(renderer)).not.toContain('No companies yet.');
  });

  it('loads the next page when the list end comes into view', () => {
    mockedUseCompanySearch.mockReturnValue(hookResult({ hasNextPage: true }));
    const renderer = render();
    // FlashList fires onEndReached itself once on mount (the short list is
    // already at its end), so count only the deliberate one.
    fetchNextPage.mockClear();
    act(() => {
      renderer.root.findByProps({ onEndReachedThreshold: 0.6 }).props.onEndReached();
    });
    expect(fetchNextPage).toHaveBeenCalledTimes(1);
  });

  it('does not stack a second next-page request on top of one in flight', () => {
    mockedUseCompanySearch.mockReturnValue(
      hookResult({ hasNextPage: true, isFetchingNextPage: true }),
    );
    const renderer = render();
    act(() => {
      renderer.root.findByProps({ onEndReachedThreshold: 0.6 }).props.onEndReached();
    });
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('does not ask for a page past the end of the catalog', () => {
    const renderer = render();
    act(() => {
      renderer.root.findByProps({ onEndReachedThreshold: 0.6 }).props.onEndReached();
    });
    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it('refetches on pull to refresh', () => {
    const renderer = render();
    act(() => {
      renderer.root.findByProps({ onEndReachedThreshold: 0.6 }).props.refreshControl.props.onRefresh();
    });
    expect(refetch).toHaveBeenCalled();
  });

  it('debounces typing: the data layer only sees the settled text', () => {
    jest.useFakeTimers();
    try {
      const renderer = render();
      act(() => {
        renderer.root.findByProps({ placeholder: 'Search companies…' }).props.onChangeText('str');
      });
      expect(lastQuery()).toBe('');
      act(() => {
        renderer.root.findByProps({ placeholder: 'Search companies…' }).props.onChangeText('stripe');
      });
      expect(lastQuery()).toBe('');
      act(() => {
        jest.advanceTimersByTime(300);
      });
      expect(lastQuery()).toBe('stripe');
    } finally {
      jest.useRealTimers();
    }
  });
});
