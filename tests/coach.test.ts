import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { parseCoachTask, parseCoachReview, studyContext } from '../src/lib/coach';
import { actions, getAppState, isAppState } from '../src/lib/store';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) } });
const initial = { version: 1, settings: { startDate: '2026-11-18', targetBand: 6.5, theme: 'light', mentorLanguage: 'vi' }, logs: [], errors: [], vocabulary: [] };
beforeEach(() => actions.importData(JSON.stringify(initial)));

test('coaching tasks reject invalid tool inputs and preserve previous answers', () => {
  assert.throws(() => parseCoachTask({ title: 'Task', prompt: 'Question', skill: 'shell' }));
  assert.throws(() => parseCoachTask({ title: 'Task', prompt: ' '.repeat(3), skill: 'speaking' }));
  const first = actions.createCoachTask({ title: 'Work', prompt: 'Describe your work.', skill: 'speaking' });
  actions.updateCoachResponse(first.id, 'I build software.');
  const next = actions.createCoachTask({ title: 'Studies', prompt: 'Describe your studies.', skill: 'speaking' });
  assert.equal(getAppState().coachTasks?.find(task => task.id === first.id)?.response, 'I build software.');
  assert.equal(getAppState().activeCoachTaskId, next.id);
});
test('feedback is tied to an exact response revision and cannot grade an empty answer', () => {
  const task = actions.createCoachTask({ title: 'Work', prompt: 'Describe your work.', skill: 'speaking' });
  assert.throws(() => actions.saveCoachReview({ taskId: task.id, revision: 0, reply: 'Feedback' }), /response/);
  actions.updateCoachResponse(task.id, 'I build software.');
  actions.saveCoachReview({ taskId: task.id, revision: 1, reply: 'Add one example.' });
  actions.updateCoachResponse(task.id, 'I build software for language learners.');
  assert.throws(() => actions.saveCoachReview({ taskId: task.id, revision: 1, reply: 'Old assessment' }), /changed/);
  assert.equal(getAppState().coachTasks?.[0].review?.reply, 'Add one example.');
  assert.equal(studyContext(getAppState(), 'coach').activeTask?.reviewIsCurrent, false);
});
test('coaching answers, conversation and feedback round-trip through progress backups', () => {
  const task = actions.createCoachTask({ title: 'Work', prompt: 'Describe your work.', skill: 'speaking' });
  actions.updateCoachResponse(task.id, 'I develop software.');
  actions.appendCoachTurn(task.id, 'user', 'I develop software.');
  actions.saveCoachReview({ taskId: task.id, revision: 1, reply: 'Good start. Give an example.', feedback: { criteria: [], summary: 'Thêm một ví dụ cụ thể.' } });
  const backup = actions.exportData();
  actions.importData(JSON.stringify(initial));
  actions.importData(backup);
  assert.equal(getAppState().coachTasks?.[0].response, 'I develop software.');
  assert.equal(getAppState().coachTasks?.[0].turns.length, 1);
  assert.equal(getAppState().coachTasks?.[0].review?.feedback?.summary, 'Thêm một ví dụ cụ thể.');
  assert.equal(isAppState({ ...getAppState(), coachTasks: [{ ...getAppState().coachTasks![0], revision: -1 }] }), false);
});
test('provisional rubric scores accept half-bands only', () => {
  const base = { taskId: 'test', revision: 1, reply: 'Feedback', feedback: { criteria: [{ name: 'Lexical Resource', feedback: 'Use more precise words.', score: 6.2 }] } };
  assert.throws(() => parseCoachReview(base), /half-band/);
  assert.equal(parseCoachReview({ ...base, feedback: { criteria: [{ ...base.feedback.criteria[0], score: 6.5 }] } }).feedback?.criteria[0].score, 6.5);
});
