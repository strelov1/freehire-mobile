/**
 * A queue that runs writes one after another, each built from the result of the
 * one before it.
 *
 * It exists because `PUT /me/profile` replaces the whole row. Two claims
 * confirmed a second apart would otherwise both be built from the profile as it
 * was before either — the second write would carry a skill list that predates
 * the first, and the first claim would vanish with no error anywhere.
 *
 * A failed write does not poison the queue: the next one falls back to
 * `base()`, the caller's current view of the truth (the query cache), rather
 * than inheriting a rejection.
 */
export type SerialQueue<T> = {
  enqueue(base: () => T | null | undefined, write: (current: T) => Promise<T>): Promise<T>;
};

export function createSerialQueue<T>(): SerialQueue<T> {
  let tail: Promise<T | null> = Promise.resolve(null);

  return {
    enqueue(base, write) {
      const next = tail.then((previous) => {
        const current = previous ?? base();
        if (!current) {
          // Nothing to build a whole-row write from. Refusing is the only safe
          // answer: a write from a half-known profile deletes the rest of it.
          return Promise.reject(new Error('serialQueue: no current value to build a write from'));
        }
        return write(current);
      });

      tail = next.catch(() => null);
      return next;
    },
  };
}
