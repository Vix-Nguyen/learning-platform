import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, localDate, weekDates, studyStreak, totalMinutes } from '../src/lib/progress';
import { actions, isAppState } from '../src/lib/store';
import type { StudyLog } from '../src/types';

test('calendar addition handles month/year boundaries without UTC drift', () => {
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2028-02-28', 1), '2028-02-29');
});
test('study dates use the learner local calendar', () => {
  assert.equal(localDate(new Date(2026, 10, 18, 0, 5)), '2026-11-18');
});
const log = (date: string, minutes = 30): StudyLog => ({ id: date, date, minutes, skill: 'reading', title: 'Reading' });
test('weekday streak survives optional weekends and breaks on missed weekdays', () => {
  assert.equal(studyStreak([log('2026-11-13'), log('2026-11-16')], '2026-11-16'), 2);
  assert.equal(studyStreak([log('2026-11-13')], '2026-11-17'), 0);
  assert.equal(studyStreak([log('2026-11-13')], '2026-11-15'), 1);
  assert.equal(studyStreak([], '2026-11-18'), 0);
});
test('weekly quotas use Monday through Sunday and exact logged minutes', () => {
  const dates = weekDates('2026-11-22');
  assert.equal(dates[0], '2026-11-16');
  assert.equal(dates[6], '2026-11-22');
  assert.equal(totalMinutes([log('2026-11-16'), log('2026-11-15'), log('2026-11-17', 45)], dates, ['reading']), 75);
});
test('backup validation rejects corrupt entries, impossible dates and unsafe quotas', () => {
  const state = { version: 1, settings: { startDate: '2026-11-18', targetBand: 6.5, theme: 'light', mentorLanguage: 'vi' }, logs: [], errors: [], vocabulary: [] };
  assert.equal(isAppState(state), true);
  const backup = actions.exportData();
  try {
    actions.importData(JSON.stringify(state));
    assert.deepEqual(JSON.parse(actions.exportData()).settings, state.settings);
    for (const coachVoiceProvider of ['browser', 'elevenlabs']) {
      for (const readCoachReplies of [true, false]) {
        const settings = { ...state.settings, coachVoiceProvider, readCoachReplies };
        actions.importData(JSON.stringify({ ...state, settings }));
        assert.deepEqual(JSON.parse(actions.exportData()).settings, settings);
      }
    }
  } finally { actions.importData(backup); }
  assert.equal(isAppState({ ...state, settings: { ...state.settings, coachVoiceProvider: 'invalid' } }), false);
  assert.equal(isAppState({ ...state, settings: { ...state.settings, readCoachReplies: 'true' } }), false);
  assert.equal(isAppState({ ...state, logs: [null] }), false);
  assert.equal(isAppState({ ...state, logs: [log('2026-02-30')] }), false);
  assert.equal(isAppState({ ...state, logs: [log('2026-11-18', -30)] }), false);
});
