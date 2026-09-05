import { createSerialQueue } from './serialQueue';

/** A profile-shaped value, reduced to the one field these tests care about. */
type Skills = { skills: string[] };

describe('createSerialQueue', () => {
  it('builds each write from the result of the previous one', async () => {
    const queue = createSerialQueue<Skills>();
    const stored: Skills[] = [];
    const base = () => ({ skills: [] as string[] });

    // Both enqueued before either settles — the case that loses a write when
    // each is built from the same snapshot.
    const write = (skill: string) => async (current: Skills) => {
      await new Promise((r) => setTimeout(r, 5));
      const saved = { skills: [...current.skills, skill] };
      stored.push(saved);
      return saved;
    };

    const first = queue.enqueue(base, write('bash'));
    const second = queue.enqueue(base, write('powershell'));

    expect(await first).toEqual({ skills: ['bash'] });
    expect(await second).toEqual({ skills: ['bash', 'powershell'] });
    expect(stored).toEqual([{ skills: ['bash'] }, { skills: ['bash', 'powershell'] }]);
  });

  it('runs writes in order, never overlapping', async () => {
    const queue = createSerialQueue<Skills>();
    const events: string[] = [];
    const base = () => ({ skills: [] as string[] });

    const write = (name: string) => async (current: Skills) => {
      events.push(`start ${name}`);
      await new Promise((r) => setTimeout(r, 5));
      events.push(`end ${name}`);
      return { skills: [...current.skills, name] };
    };

    await Promise.all([queue.enqueue(base, write('a')), queue.enqueue(base, write('b'))]);

    expect(events).toEqual(['start a', 'end a', 'start b', 'end b']);
  });

  it('does not let a failed write poison the queue', async () => {
    const queue = createSerialQueue<Skills>();
    const base = () => ({ skills: ['react'] });

    const failing = queue.enqueue(base, () => Promise.reject(new Error('network')));
    await expect(failing).rejects.toThrow('network');

    // The next write falls back to the caller's current truth rather than
    // inheriting the rejection.
    await expect(
      queue.enqueue(base, (current) => Promise.resolve({ skills: [...current.skills, 'go'] })),
    ).resolves.toEqual({ skills: ['react', 'go'] });
  });

  it('refuses a write it has nothing to build from', async () => {
    const queue = createSerialQueue<Skills>();

    // A whole-row write built from a half-known profile deletes the rest of it.
    await expect(queue.enqueue(() => null, (c) => Promise.resolve(c))).rejects.toThrow(
      'no current value',
    );
  });
});
