import { ReturnIntentManager, validateReturnIntent } from './returnIntent';

describe('return intents', () => {
  it('accepts only allowlisted destinations and bounded job slugs', () => {
    expect(validateReturnIntent({ kind: 'navigate', destination: 'account' })).toEqual({
      kind: 'navigate',
      destination: 'account',
    });
    expect(validateReturnIntent({ kind: 'navigate', destination: 'https://evil.test' })).toBeNull();
    expect(validateReturnIntent({ kind: 'saveJob', jobSlug: '../account', fallbackDestination: 'job' })).toBeNull();
    expect(validateReturnIntent({ kind: 'saveJob', jobSlug: 'senior-go-engineer', fallbackDestination: 'job' })).toEqual({
      kind: 'saveJob',
      jobSlug: 'senior-go-engineer',
      fallbackDestination: 'job',
    });
  });

  it('claims synchronously and executes at most once per in-process intent', async () => {
    const manager = new ReturnIntentManager();
    manager.record({ kind: 'navigate', destination: 'account' });
    const executor = jest.fn(async () => undefined);
    const [first, second] = await Promise.all([manager.execute(executor), manager.execute(executor)]);
    expect([first, second].sort()).toEqual(['completed', 'none']);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(manager.getSnapshot()).toEqual({ status: 'completed' });
  });

  it('retains failed work for an explicit retry and clears on dismissal', async () => {
    const manager = new ReturnIntentManager();
    manager.record({ kind: 'saveJob', jobSlug: 'go-dev', fallbackDestination: 'job' });
    await expect(manager.execute(async () => Promise.reject(new Error('offline')))).resolves.toBe('failed');
    await expect(manager.execute(async () => undefined)).resolves.toBe('completed');
    manager.clear();
    expect(manager.getSnapshot()).toEqual({ status: 'empty' });
  });

  it('does not resurrect an intent cleared during a slow executor', async () => {
    const manager = new ReturnIntentManager();
    let finish!: () => void;
    const slow = new Promise<void>((resolve) => {
      finish = resolve;
    });
    manager.record({ kind: 'navigate', destination: 'account' });
    const execution = manager.execute(() => slow);
    manager.clear();
    finish();
    await expect(execution).resolves.toBe('none');
    expect(manager.getSnapshot()).toEqual({ status: 'empty' });
  });
});
