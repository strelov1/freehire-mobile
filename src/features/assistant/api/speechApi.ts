import { File } from 'expo-file-system';
import { request } from '@/lib/transport';

export async function transcribeRecording(uri: string, sessionEpoch: number, signal: AbortSignal) {
  const file = new File(uri);
  if (!file.exists || file.size === 0) throw new Error('No audio was captured. Please try again.');
  if (file.size > 2 * 1024 * 1024) throw new Error('The recording is too large. Please record a shorter message.');
  const form = new FormData();
  form.append('file', file, 'dictation.m4a');
  const body = await request<{ data: { text?: string } }>('/api/v1/speech/transcriptions', {
    authMode: 'required', method: 'POST', sessionEpoch, signal, body: form, timeoutMs: 90_000,
  });
  return body.data?.text ?? '';
}
