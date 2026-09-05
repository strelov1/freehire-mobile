import { allowanceRows } from './allowances';
import type { Plan } from '../api/planApi';

const resets = '2099-01-01T00:00:00Z';

function plan(allowances: Plan['allowances']): Plan {
  return { plan: 'free', resets_at: resets, allowances };
}

function allowance(feature: string, over: Partial<NonNullable<Plan['allowances']>[number]> = {}) {
  return { feature, used: 0, limit: 3, unlimited: false, enforced: true, resets_at: resets, ...over };
}

describe('allowanceRows', () => {
  it('reads a limited feature as a count against its ceiling', () => {
    const [row] = allowanceRows(plan([allowance('match', { used: 1, limit: 3 })]));
    expect(row?.label).toBe('Job match analysis');
    expect(row?.detail).toBe('1 of 3 today');
  });

  it('reads an unlimited feature as unlimited rather than as a number', () => {
    const [row] = allowanceRows(plan([allowance('match', { used: 9, unlimited: true, limit: 0 })]));
    expect(row?.detail).toBe('Unlimited');
  });

  // The ceiling is counted before it is enforced, and the server says which state it is in.
  // Presenting an unenforced ceiling as a limit would promise a refusal that does not happen.
  it('does not present an unenforced ceiling as a limit', () => {
    const [row] = allowanceRows(plan([allowance('match', { used: 4, limit: 3, enforced: false })]));
    expect(row?.detail).toBe('4 used today');
  });

  // The server owns the feature list and will add to it. A feature this build has no label for
  // is shown by its own name rather than dropped, which is how a new one appears without a
  // release.
  it('shows a feature it has no label for rather than hiding it', () => {
    const [row] = allowanceRows(plan([allowance('brand_new_thing')]));
    expect(row?.label).toBe('Brand new thing');
  });

  it('orders the known features before the unfamiliar ones', () => {
    const rows = allowanceRows(
      plan([allowance('zzz_unknown'), allowance('assistant'), allowance('match')]),
    );
    expect(rows.map((r) => r.key)).toEqual(['match', 'assistant', 'zzz_unknown']);
  });

  it('is empty when the plan carries no allowances', () => {
    expect(allowanceRows(plan(undefined))).toEqual([]);
    expect(allowanceRows(plan([]))).toEqual([]);
    expect(allowanceRows(undefined)).toEqual([]);
  });

  // The payload is plain JSON by the time it arrives, so a row missing what the screen needs
  // is possible. Dropping it beats rendering a feature with no numbers beside it.
  it('drops a row it cannot read', () => {
    const rows = allowanceRows(plan([{ feature: '' } as never, allowance('match')]));
    expect(rows).toHaveLength(1);
  });
});
