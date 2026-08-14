export type ReturnIntent =
  | { kind: 'navigate'; destination: 'account' }
  | { kind: 'saveJob'; jobSlug: string; fallbackDestination: 'job' };

export type ReturnIntentStatus = 'empty' | 'pending' | 'executing' | 'completed' | 'failed';
export type ReturnIntentSnapshot = { status: ReturnIntentStatus; intent?: ReturnIntent };

const JOB_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

export function validateReturnIntent(value: unknown): ReturnIntent | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'navigate' && candidate.destination === 'account') {
    return { kind: 'navigate', destination: 'account' };
  }
  if (
    candidate.kind === 'saveJob' &&
    candidate.fallbackDestination === 'job' &&
    typeof candidate.jobSlug === 'string' &&
    candidate.jobSlug.length <= 160 &&
    JOB_SLUG.test(candidate.jobSlug)
  ) {
    return { kind: 'saveJob', jobSlug: candidate.jobSlug, fallbackDestination: 'job' };
  }
  return null;
}

export class ReturnIntentManager {
  private snapshot: ReturnIntentSnapshot = { status: 'empty' };
  private listener?: (snapshot: ReturnIntentSnapshot) => void;
  private generation = 0;

  subscribe(listener: (snapshot: ReturnIntentSnapshot) => void): () => void {
    this.listener = listener;
    listener(this.snapshot);
    return () => {
      if (this.listener === listener) this.listener = undefined;
    };
  }

  getSnapshot(): ReturnIntentSnapshot {
    return this.snapshot;
  }

  record(value: unknown): boolean {
    const intent = validateReturnIntent(value);
    if (!intent) return false;
    this.generation += 1;
    this.publish({ status: 'pending', intent });
    return true;
  }

  clear() {
    this.generation += 1;
    this.publish({ status: 'empty' });
  }

  async execute(executor: (intent: ReturnIntent) => Promise<void>): Promise<'none' | 'completed' | 'failed'> {
    if ((this.snapshot.status !== 'pending' && this.snapshot.status !== 'failed') || !this.snapshot.intent) {
      return 'none';
    }
    const intent = validateReturnIntent(this.snapshot.intent);
    if (!intent) {
      this.clear();
      return 'none';
    }
    const generation = this.generation;
    // Claim synchronously before any await so only one caller can own execution.
    this.publish({ status: 'executing', intent });
    try {
      await executor(intent);
      if (generation !== this.generation) return 'none';
      this.publish({ status: 'completed' });
      return 'completed';
    } catch {
      if (generation !== this.generation) return 'none';
      this.publish({ status: 'failed', intent });
      return 'failed';
    }
  }

  private publish(snapshot: ReturnIntentSnapshot) {
    this.snapshot = snapshot;
    this.listener?.(snapshot);
  }
}
