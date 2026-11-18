import type { MentorMessage, MentorResponse } from '../types';

const apiBase = import.meta.env.VITE_API_BASE_URL || `${import.meta.env.BASE_URL.replace(/\/$/, '')}/api`;
export async function mentorRequest(input: { mode: 'chat' | 'writing' | 'speaking' | 'practice'; messages?: MentorMessage[]; text?: string; task?: string; language: 'vi' | 'en' }, signal?: AbortSignal): Promise<MentorResponse> {
  const response = await fetch(`${apiBase}/mentor`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(input), signal });
  const data = await response.json().catch(() => ({ error: 'The optional AI server is not connected. Start npm run dev, or configure VITE_API_BASE_URL.' }));
  if (!response.ok || typeof data.reply !== 'string') throw new Error(data.error || 'The mentor is unavailable. Please try again.');
  return data;
}
export async function sessionStatus(): Promise<{ authenticated: boolean; authEnabled: boolean; aiConfigured: boolean }> {
  try { const r = await fetch(`${apiBase}/session`); if (!r.ok) throw new Error(); return await r.json(); }
  catch { return { authenticated: true, authEnabled: false, aiConfigured: false }; }
}
export async function login(username: string, password: string): Promise<void> {
  const r = await fetch(`${apiBase}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  if (!r.ok) { const data = await r.json().catch(() => ({})); throw new Error(data.error || 'Could not sign in.'); }
}
export async function logout(): Promise<void> { await fetch(`${apiBase}/logout`, { method: 'POST' }); }
