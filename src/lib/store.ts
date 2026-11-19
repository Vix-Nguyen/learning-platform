import { useSyncExternalStore } from 'react';
import type { AppState, StudyLog, ErrorEntry, VocabCard, Settings, CoachTask, MentorResponse } from '../types';
import { localDate, addDays } from './progress';
import { isCoachTask, parseCoachTask, parseCoachReview } from './coach';

const KEY = 'fluentpath.v1';
function emptyState(): AppState {
  return { version: 1, settings: { startDate: localDate(), targetBand: 6.5, theme: 'light', mentorLanguage: 'vi' }, logs: [], errors: [], vocabulary: [
    { id: 'starter-1', word: 'trade-off', meaning: 'sự đánh đổi', example: 'There is a trade-off between convenience and privacy.', due: localDate(), interval: 0 },
    { id: 'starter-2', word: 'sustainable', meaning: 'bền vững', example: 'Public transport is a more sustainable way to travel.', due: localDate(), interval: 0 },
    { id: 'starter-3', word: 'whereas', meaning: 'trong khi đó (đối chiếu hai ý)', example: 'Online courses are flexible, whereas classroom lessons offer direct interaction.', due: localDate(), interval: 0 },
  ] };
}
export function isAppState(value: unknown): value is AppState {
  if (!value || typeof value !== 'object') return false;
  const s = value as AppState;
  const skills = ['foundations', 'reading', 'listening', 'writing', 'speaking'];
  const date = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(`${v}T12:00:00`).getDate() === Number(v.slice(-2));
  return s.version === 1 && !!s.settings && date(s.settings.startDate) && Number.isFinite(s.settings.targetBand) && s.settings.targetBand >= 1 && s.settings.targetBand <= 9 && ['light', 'dark'].includes(s.settings.theme) && ['vi', 'en'].includes(s.settings.mentorLanguage)
    && Array.isArray(s.logs) && s.logs.every(l => l && typeof l.id === 'string' && date(l.date) && Number.isFinite(l.minutes) && l.minutes > 0 && l.minutes <= 1440 && skills.includes(l.skill) && typeof l.title === 'string')
    && Array.isArray(s.errors) && s.errors.every(e => e && typeof e.id === 'string' && date(e.date) && skills.includes(e.skill) && ['question', 'answer', 'correct', 'explanation'].every(k => typeof e[k as keyof ErrorEntry] === 'string') && typeof e.resolved === 'boolean')
    && Array.isArray(s.vocabulary) && s.vocabulary.every(v => v && ['id', 'word', 'meaning', 'example'].every(k => typeof v[k as keyof VocabCard] === 'string') && date(v.due) && Number.isFinite(v.interval) && v.interval >= 0)
    && (s.coachTasks === undefined || Array.isArray(s.coachTasks) && s.coachTasks.every(isCoachTask))
    && (s.activeCoachTaskId === undefined || typeof s.activeCoachTaskId === 'string' && !!s.coachTasks?.some(t => t.id === s.activeCoachTaskId));
}
let state = emptyState();
try { const saved: unknown = JSON.parse(localStorage.getItem(KEY) || 'null'); if (isAppState(saved)) state = saved; } catch { /* Keep the usable fresh state. */ }
const listeners = new Set<() => void>();
export let storageError = '';
function save(next: AppState) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageError = ''; } catch { storageError = 'Browser storage is full or unavailable. Export your progress before closing this tab.'; }
  listeners.forEach(fn => fn());
}
export function useAppStore(): AppState { return useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state); }
export function getAppState(): AppState { return state; }
function updateCoachTask(id: string, update: (task: CoachTask) => CoachTask) {
  if (!state.coachTasks?.some(task => task.id === id)) throw new Error('That coaching task is no longer available.');
  save({ ...state, coachTasks: state.coachTasks.map(task => task.id === id ? update(task) : task) });
}
export const actions = {
  createCoachTask(input: unknown) {
    const values = parseCoachTask(input);
    const task: CoachTask = { ...values, id: crypto.randomUUID(), createdAt: new Date().toISOString(), response: '', revision: 0, turns: [] };
    save({ ...state, coachTasks: [...(state.coachTasks || []), task], activeCoachTaskId: task.id });
    return task;
  },
  selectCoachTask(id: string) { if (!state.coachTasks?.some(t => t.id === id)) throw new Error('Task not found.'); save({ ...state, activeCoachTaskId: id }); },
  updateCoachResponse(id: string, response: string) {
    if (response.length > 12000) throw new Error('Keep your response under 12,000 characters.');
    updateCoachTask(id, task => response === task.response ? task : { ...task, response, revision: task.revision + 1 });
  },
  appendCoachTurn(id: string, role: 'user' | 'assistant', content: string) {
    if (!content.trim() || content.length > 12000) throw new Error('The coaching turn is empty or too long.');
    updateCoachTask(id, task => {
      if (task.turns.length >= 2000) throw new Error('Start a new coaching task to continue this conversation.');
      return { ...task, turns: [...task.turns, { role, content, createdAt: new Date().toISOString() }] };
    });
  },
  saveCoachReview(input: MentorResponse & { taskId: string; revision: number }) {
    const review = parseCoachReview(input);
    updateCoachTask(review.taskId, task => {
      if (task.revision !== review.revision) throw new Error('The response changed. Read the current revision before saving feedback.');
      if (!task.response.trim()) throw new Error('Add a response before saving an assessment.');
      return { ...task, review: { reply: review.reply, ...(review.feedback ? { feedback: review.feedback } : {}), revision: review.revision, createdAt: new Date().toISOString() } };
    });
  },
  logStudy(input: Omit<StudyLog, 'id'>) { if (!Number.isFinite(input.minutes) || input.minutes <= 0 || input.minutes > 1440) return; save({ ...state, logs: [...state.logs, { ...input, id: crypto.randomUUID() }] }); },
  removeLog(id: string) { save({ ...state, logs: state.logs.filter(l => l.id !== id) }); },
  addErrors(entries: Omit<ErrorEntry, 'id' | 'resolved'>[]) { save({ ...state, errors: [...state.errors, ...entries.map(e => ({ ...e, id: crypto.randomUUID(), resolved: false }))] }); },
  resolveError(id: string) { save({ ...state, errors: state.errors.map(e => e.id === id ? { ...e, resolved: !e.resolved } : e) }); },
  addVocabulary(input: Pick<VocabCard, 'word' | 'meaning' | 'example'>) { save({ ...state, vocabulary: [...state.vocabulary, { ...input, id: crypto.randomUUID(), due: localDate(), interval: 0 }] }); },
  reviewVocabulary(id: string, known: boolean) { save({ ...state, vocabulary: state.vocabulary.map(v => v.id === id ? { ...v, interval: known ? Math.min(60, Math.max(1, v.interval * 2)) : 0, due: known ? addDays(localDate(), Math.min(60, Math.max(1, v.interval * 2))) : localDate() } : v) }); },
  removeVocabulary(id: string) { save({ ...state, vocabulary: state.vocabulary.filter(v => v.id !== id) }); },
  updateSettings(patch: Partial<Settings>) { save({ ...state, settings: { ...state.settings, ...patch } }); },
  exportData() { return JSON.stringify(state, null, 2); },
  importData(input: string) { const parsed: unknown = JSON.parse(input); if (!isAppState(parsed)) throw new Error('This file is not a valid FluentPath progress backup.'); save(parsed); },
};
