import type { AIFeedback, AppState, CoachTask, MentorResponse, Page } from '../types';
import { localDate, studyStreak, totalMinutes, weekDates } from './progress';

export const starterTask = {
  title: 'A short introduction', skill: 'speaking' as const,
  prompt: 'What do you enjoy about your work or studies? Give a reason and one example.',
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object.');
  return value as Record<string, unknown>;
}
export function boundedText(value: unknown, name: string, maximum: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) throw new Error(`${name} must contain 1–${maximum} characters.`);
  return value.trim();
}
export function parseCoachTask(value: unknown): Pick<CoachTask, 'title' | 'prompt' | 'skill'> {
  const input = record(value);
  if (!['speaking', 'writing', 'foundations'].includes(String(input.skill))) throw new Error('Choose speaking, writing, or foundations.');
  return { title: boundedText(input.title, 'Title', 120), prompt: boundedText(input.prompt, 'Prompt', 6000), skill: input.skill as CoachTask['skill'] };
}
export function validFeedback(value: unknown): value is AIFeedback {
  if (!value || typeof value !== 'object') return false;
  const f = value as AIFeedback;
  return Array.isArray(f.criteria) && f.criteria.length <= 8 && f.criteria.every(c => c && typeof c.name === 'string' && c.name.length <= 160 && typeof c.feedback === 'string' && c.feedback.length <= 6000 && (c.score === undefined || (Number.isFinite(c.score) && c.score >= 0 && c.score <= 9 && c.score * 2 === Math.round(c.score * 2))))
    && (f.summary === undefined || typeof f.summary === 'string' && f.summary.length <= 6000)
    && (f.corrections === undefined || Array.isArray(f.corrections) && f.corrections.length <= 20 && f.corrections.every(c => c && ['original', 'improved', 'reason'].every(key => typeof c[key as keyof typeof c] === 'string' && c[key as keyof typeof c].length <= 6000)));
}
export function parseCoachReview(value: unknown): MentorResponse & { taskId: string; revision: number } {
  const input = record(value);
  if (!Number.isInteger(input.revision) || Number(input.revision) < 0) throw new Error('Use the response revision returned by get_study_context.');
  if (input.feedback !== undefined && !validFeedback(input.feedback)) throw new Error('Feedback needs valid criteria, corrections and half-band scores.');
  return { taskId: boundedText(input.taskId, 'Task ID', 100), revision: Number(input.revision), reply: boundedText(input.reply, 'Feedback', 12000), ...(input.feedback ? { feedback: input.feedback as AIFeedback } : {}) };
}
export function isCoachTask(value: unknown): value is CoachTask {
  try {
    const t = record(value);
    parseCoachTask(t);
    return typeof t.id === 'string' && typeof t.createdAt === 'string' && typeof t.response === 'string' && t.response.length <= 12000
      && Number.isInteger(t.revision) && Number(t.revision) >= 0 && Array.isArray(t.turns) && t.turns.length <= 2000
      && t.turns.every(turn => turn && ['user', 'assistant'].includes(turn.role) && typeof turn.content === 'string' && turn.content.length <= 12000 && typeof turn.createdAt === 'string')
      && (t.review === undefined || (() => { const r = record(t.review); parseCoachReview({ ...r, taskId: t.id }); return typeof r.createdAt === 'string'; })());
  } catch { return false; }
}
export function studyContext(state: AppState, page: Page) {
  const date = localDate();
  const task = state.coachTasks?.find(t => t.id === state.activeCoachTaskId);
  return {
    date, page, targetBand: state.settings.targetBand, explanationLanguage: state.settings.mentorLanguage,
    todayMinutes: totalMinutes(state.logs, [date]), weeklyMinutes: totalMinutes(state.logs, weekDates()), weekdayStreak: studyStreak(state.logs),
    dueVocabulary: state.vocabulary.filter(v => v.due <= date).slice(0, 12),
    recentMistakes: state.errors.filter(e => !e.resolved).slice(-8),
    activeTask: task ? { ...task, turns: task.turns.slice(-12), reviewIsCurrent: task.review?.revision === task.revision } : null,
    savedTasks: (state.coachTasks || []).slice(-8).map(t => ({ id: t.id, title: t.title, skill: t.skill })),
  };
}
