import { ApiError } from '@/lib/transport';
import { initChat, reduceTurnEvent, type ChatState } from './chat';
import { StreamInterrupted } from './stream';
import { eventsFromTranscript, type SessionSummary, type StoredMessage, type TurnEvent } from './wire';

export interface ConversationApi {
  get: (signal: AbortSignal) => Promise<{ session: SessionSummary; messages: StoredMessage[] }>;
  send: (text: string, onEvent: (event: TurnEvent) => void, signal: AbortSignal) => Promise<void>;
  cancel: (signal: AbortSignal) => Promise<void>;
}
interface Snapshot {
  chat: ChatState;
  draft: string;
  label: string;
  phase: 'loading' | 'ready' | 'sending' | 'recovering' | 'error';
  error: string | null;
  unavailable: boolean;
  stopRequested: boolean;
}
export function assistantError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 404) return 'This conversation is no longer available.';
    if (error.serverError) return error.serverError;
    if (error.kind === 'offline') return 'You appear to be offline. Check your connection and try again.';
    if (error.status === 402) return 'You have reached your assistant limit. Check your plan to continue.';
    return 'Could not reach the assistant. Please try again.';
  }
  return error instanceof Error ? error.message : 'Could not reach the assistant. Please try again.';
}

/** Owns one account's conversation. Detaching a reader never cancels server work. */
export class Conversation {
  private snapshot: Snapshot = { chat: initChat(), draft: '', label: 'Assistant', phase: 'loading', error: null, unavailable: false, stopRequested: false };
  private listeners = new Set<() => void>();
  private operation?: AbortController;
  private generation = 0;
  private stopController?: AbortController;
  private interrupted = false;
  constructor(private api: ConversationApi, private recovery?: { initial: boolean; changed: (value: boolean) => void }) {
    this.interrupted = recovery?.initial ?? false;
  }
  private setInterrupted(value: boolean) {
    this.interrupted = value;
    this.recovery?.changed(value);
  }
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(change: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...change };
    for (const listener of this.listeners) listener();
  }
  setDraft = (draft: string) => this.update({ draft });
  detach = () => {
    if (this.snapshot.phase === 'sending') this.setInterrupted(true);
    this.generation++;
    this.operation?.abort();
    this.stopController?.abort();
    this.update({ chat: reduceTurnEvent(this.snapshot.chat, { type: 'result' }), phase: this.interrupted ? 'recovering' : this.snapshot.phase });
  };
  load = async () => {
    if (this.snapshot.phase === 'sending') return;
    this.operation?.abort();
    const controller = new AbortController();
    this.operation = controller;
    const generation = ++this.generation;
    this.update({ phase: 'loading', error: null });
    try {
      const transcript = await this.api.get(controller.signal);
      if (generation !== this.generation) return;
      if (transcript.session.preset === 'tailor' || transcript.session.preset === 'browse') {
        this.update({ phase: 'error', unavailable: true, error: 'Open this conversation in its web workspace.' });
        return;
      }
      this.update({
        chat: eventsFromTranscript(transcript.messages ?? []).reduce(reduceTurnEvent, initChat()),
        label: transcript.session.label || 'Assistant',
        phase: this.interrupted ? 'recovering' : 'ready', unavailable: false,
      });
    } catch (error) {
      if (generation !== this.generation) return;
      this.update({ phase: 'error', error: assistantError(error), unavailable: error instanceof ApiError && error.status === 404 });
    }
  };
  send = async () => {
    const text = this.snapshot.draft.trim();
    if (!text || !['ready', 'recovering'].includes(this.snapshot.phase) || this.snapshot.unavailable) return;
    this.operation?.abort();
    const controller = new AbortController();
    this.operation = controller;
    const generation = ++this.generation;
    const wasInterrupted = this.interrupted;
    let accepted = false;
    this.update({ phase: 'sending', error: null, draft: '', stopRequested: false });
    try {
      await this.api.send(text, (event) => {
        if (generation !== this.generation) return;
        if (event.type === 'user_prompt') {
          accepted = true;
          this.setInterrupted(false);
        }
        this.update({ chat: reduceTurnEvent(this.snapshot.chat, event) });
      }, controller.signal);
      if (generation !== this.generation) return;
      this.update({ phase: this.interrupted ? 'recovering' : 'ready', stopRequested: false, draft: accepted ? '' : text });
    } catch (error) {
      if (generation !== this.generation) return;
      // A network loss after submission is ambiguous: recover, never offer an automatic resend.
      const interrupted = error instanceof StreamInterrupted || (error instanceof ApiError && ['offline', 'timeout'].includes(error.kind));
      this.setInterrupted(interrupted || (!accepted && wasInterrupted));
      this.update({
        phase: this.interrupted ? 'recovering' : 'ready', error: assistantError(error), stopRequested: false,
        draft: !accepted && !interrupted ? text : '',
        chat: reduceTurnEvent(this.snapshot.chat, { type: 'result' }),
      });
    } finally {
      controller.abort();
    }
  };
  stop = async () => {
    // Keep reading until the terminal event; offline must not pretend the server stopped.
    if (this.stopController && !this.stopController.signal.aborted) return;
    const controller = new AbortController();
    this.stopController = controller;
    const generation = this.generation;
    const attachedAtStop = this.snapshot.phase === 'sending';
    this.update({ stopRequested: true, error: null });
    try {
      await this.api.cancel(controller.signal);
      if (generation !== this.generation) return;
      // A 204 acknowledges the request; only the terminal SSE frame confirms completion.
      if (this.snapshot.phase === 'sending' || (attachedAtStop && this.snapshot.phase === 'ready')) return;
      this.setInterrupted(true);
      this.update({ phase: 'recovering', error: null, stopRequested: true });
      await this.load();
    } catch (error) {
      if (generation === this.generation) this.update({ stopRequested: false, error: `Could not stop the assistant. ${assistantError(error)}` });
    } finally {
      if (this.stopController === controller) this.stopController = undefined;
    }
  };
}
