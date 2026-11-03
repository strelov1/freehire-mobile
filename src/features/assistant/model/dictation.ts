import { ApiError } from '@/lib/transport';
import { assistantError } from './conversation';

const MAX_RECORDING_MS = 5 * 60 * 1000;
export function appendTranscript(draft: string, text: string): string {
  const said = text.trim();
  if (!said) return draft;
  if (!draft) return said;
  return /\s$/.test(draft) ? draft + said : `${draft} ${said}`;
}
export interface DictationDependencies {
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  remove: (uri: string) => void;
  transcribe: (uri: string, signal: AbortSignal) => Promise<string>;
  onTranscript: (text: string) => void;
}
interface Snapshot {
  phase: 'idle' | 'starting' | 'recording' | 'transcribing';
  elapsed: number;
  error: string | null;
  unavailable: boolean;
}

/** A microphone capture belongs to its screen/account; late results are discarded. */
export class Dictation {
  private snapshot: Snapshot = { phase: 'idle', elapsed: 0, error: null, unavailable: false };
  private listeners = new Set<() => void>();
  private generation = 0;
  private starting = false;
  private captured = false;
  private stopping?: Promise<string | null>;
  private controller?: AbortController;
  private ticker?: ReturnType<typeof setInterval>;
  private ceiling?: ReturnType<typeof setTimeout>;
  constructor(private dependencies: DictationDependencies) {}
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(change: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.listeners) listener();
  }
  private clearTimers() { clearInterval(this.ticker); clearTimeout(this.ceiling); }
  private stopCapture() {
    if (this.stopping) return this.stopping;
    if (!this.captured) return Promise.resolve(null);
    this.captured = false;
    const pending = this.dependencies.stop();
    this.stopping = pending;
    void pending.finally(() => { if (this.stopping === pending) this.stopping = undefined; }).catch(() => {});
    return pending;
  }
  start = async () => {
    if (this.starting || this.stopping || this.snapshot.phase !== 'idle' || this.snapshot.unavailable) return;
    const generation = ++this.generation;
    this.starting = true;
    this.update({ phase: 'starting', error: null, elapsed: 0 });
    try {
      await this.dependencies.start();
      this.captured = true;
      if (generation !== this.generation) {
        const uri = await this.stopCapture();
        if (uri) this.dependencies.remove(uri);
        return;
      }
      this.update({ phase: 'recording' });
      const began = Date.now();
      this.ticker = setInterval(() => this.update({ elapsed: Math.floor((Date.now() - began) / 1000) }), 250);
      this.ceiling = setTimeout(() => { void this.finish(); }, MAX_RECORDING_MS);
    } catch (error) {
      if (generation === this.generation) this.update({ phase: 'idle', error: assistantError(error) });
    } finally { this.starting = false; }
  };
  finish = async () => {
    if (this.snapshot.phase !== 'recording') return;
    this.clearTimers();
    const generation = this.generation;
    const controller = new AbortController();
    this.controller = controller;
    this.update({ phase: 'transcribing' });
    let uri: string | null = null;
    try {
      uri = await this.stopCapture();
      if (generation !== this.generation) return;
      if (!uri) throw new Error('No audio was captured. Please try again.');
      const text = await this.dependencies.transcribe(uri, controller.signal);
      if (generation === this.generation) this.dependencies.onTranscript(text);
    } catch (error) {
      if (generation === this.generation) this.update({
        error: assistantError(error), unavailable: error instanceof ApiError && error.status === 501,
      });
    } finally {
      if (uri) this.dependencies.remove(uri);
      if (generation === this.generation) this.update({ phase: 'idle' });
    }
  };
  fail = async (error: Error) => {
    await this.cancel();
    if (this.snapshot.phase === 'idle') this.update({ error: error.message });
  };
  cancel = async () => {
    this.generation++;
    this.controller?.abort();
    this.clearTimers();
    this.update({ phase: 'idle', error: null });
    try {
      const uri = await this.stopCapture();
      if (uri) this.dependencies.remove(uri);
    } catch { /* The native adapter releases the audio session even if stop fails. */ }
  };
}
