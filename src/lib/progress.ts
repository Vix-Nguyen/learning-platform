import type { StudyLog, Skill } from '../types';

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return localDate(d);
}
export function weekDates(date = localDate()): string[] {
  const d = new Date(`${date}T12:00:00`); const day = d.getDay();
  const monday = addDays(date, day === 0 ? -6 : 1 - day);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export function totalMinutes(logs: StudyLog[], dates: string[], skills?: Skill[]): number {
  return logs.filter(l => dates.includes(l.date) && (!skills || skills.includes(l.skill))).reduce((sum, l) => sum + l.minutes, 0);
}
export function studyStreak(logs: StudyLog[], today = localDate()): number {
  const studied = new Set(logs.filter(l => l.minutes > 0).map(l => l.date));
  let date = studied.has(today) ? today : addDays(today, -1);
  // Weekends are optional and do not break a weekday study streak.
  let count = 0;
  for (let i = 0; i < 3660; i++, date = addDays(date, -1)) {
    const day = new Date(`${date}T12:00:00`).getDay();
    if (day === 0 || day === 6) continue;
    if (!studied.has(date)) break;
    count++;
  }
  return count;
}
export function formatMinutes(minutes: number): string {
  return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`;
}
