import type { ChatGPTStatus, MentorMessage, MentorResponse, SessionStatus, VoiceStatus } from '../types';

const localApi = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;
const apiBase = import.meta.env.MODE === 'chatgpt-local' ? localApi : import.meta.env.VITE_API_BASE_URL || localApi;
export async function mentorRequest(input: { mode: 'chat' | 'writing' | 'speaking' | 'practice' | 'coach'; messages?: MentorMessage[]; text?: string; task?: string; language: 'vi' | 'en' }, signal?: AbortSignal): Promise<MentorResponse> {
  const response = await fetch(`${apiBase}/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(input), signal });
  const data = await response.json().catch(() => ({ error: 'The optional AI server is not connected. Start npm run dev, or configure VITE_API_BASE_URL.' }));
  if (!response.ok || typeof data.reply !== 'string') throw new Error(data.error || 'The mentor is unavailable. Please try again.');
  return data;
}
export async function sessionStatus(): Promise<SessionStatus> {
  try { const r = await fetch(`${apiBase}/session`, { cache: 'no-store' }); if (!r.ok) throw new Error(); return await r.json(); }
  catch { return { authenticated: true, authEnabled: false, aiConfigured: false }; }
}
export async function login(username: string, password: string): Promise<void> {
  const r = await fetch(`${apiBase}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!r.ok) { const data = await r.json().catch(() => ({})); throw new Error(data.error || 'Could not sign in.'); }
}
export async function logout(): Promise<void> { await fetch(`${apiBase}/logout`, { method: 'POST' }); }

export async function voiceStatus(): Promise<VoiceStatus> {
  try { const r = await fetch(`${apiBase}/voice/status`); if (!r.ok) throw new Error(); return await r.json(); }
  catch { return { elevenLabsConfigured: false }; }
}
export async function voiceAudio(text: string, language: 'en' | 'vi', signal?: AbortSignal): Promise<Blob> {
  const r = await fetch(`${apiBase}/voice/speak`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, language }), signal });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Voice output is unavailable.');
  return r.blob();
}
export async function transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
  const r = await fetch(`${apiBase}/voice/transcribe`, { method: 'POST', headers: { 'Content-Type': audio.type || 'audio/webm' }, body: audio, signal });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || typeof data.text !== 'string') throw new Error(data.error || 'Transcription is unavailable.');
  return data.text;
}

async function chatGPTSettings(action: 'connect' | 'disconnect', id?: string) {
  const response = await fetch(`${localApi}/chatgpt/${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data) throw new Error(data?.error || 'Không thể cập nhật kết nối ChatGPT.');
  return data;
}

export async function connectChatGPT(id?: string) {
  const data = await chatGPTSettings('connect', id);
  const target = new URL(data.url);
  if (target.origin !== 'https://auth.openai.com' || target.pathname !== '/api/accounts/authorize') {
    throw new Error('Địa chỉ đăng nhập ChatGPT không hợp lệ.');
  }
  window.location.assign(target.href);
}

export function disconnectChatGPT(id: string): Promise<ChatGPTStatus & { revoked: boolean }> {
  return chatGPTSettings('disconnect', id);
}
