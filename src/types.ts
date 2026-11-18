export type Skill = 'foundations' | 'reading' | 'listening' | 'writing' | 'speaking';
export type Page = 'dashboard' | 'planner' | 'practice' | 'vocabulary' | 'errors' | 'settings';
export interface StudyLog { id: string; date: string; minutes: number; skill: Skill; title: string }
export interface ErrorEntry { id: string; date: string; skill: Skill; question: string; answer: string; correct: string; explanation: string; resolved: boolean }
export interface VocabCard { id: string; word: string; meaning: string; example: string; due: string; interval: number }
export interface Settings { startDate: string; targetBand: number; theme: 'light' | 'dark'; mentorLanguage: 'vi' | 'en' }
export interface AppState { version: 1; settings: Settings; logs: StudyLog[]; errors: ErrorEntry[]; vocabulary: VocabCard[] }
export interface MentorMessage { role: 'user' | 'assistant'; content: string }
export interface AIFeedback { criteria: { name: string; score?: number; feedback: string }[]; corrections?: { original: string; improved: string; reason: string }[]; summary?: string }
export interface MentorResponse { reply: string; feedback?: AIFeedback }
export interface ChatGPTStatus {
  connected: boolean;
  activeId?: string;
  accounts: { id: string; label: string }[];
}
export interface SessionStatus {
  authenticated: boolean;
  authEnabled: boolean;
  aiConfigured: boolean;
  chatgpt?: ChatGPTStatus;
}
