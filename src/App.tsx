import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownRight, ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Compass, Download, Flame, Headphones, LogOut, Menu, MessageCircle, Moon, MoreHorizontal, Pause, Play, Plus, RotateCcw, Search, Settings2, ShieldCheck, Sparkles, Sun, Target, Trash2, Upload, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import type { AppState, Page, Skill, StudyLog } from './types';
import { actions, storageError, useAppStore } from './lib/store';
import { addDays, formatMinutes, localDate, studyStreak, totalMinutes, weekDates } from './lib/progress';
import { login, logout, sessionStatus } from './lib/api';
import Mentor from './components/Mentor';
import CommandMenu from './components/CommandMenu';
import PracticeHub from './components/PracticeHub';
import { Vocabulary } from './components/Vocabulary';
import { ErrorLog } from './components/ErrorLog';

const nav: { id: Page; label: string; icon: typeof Compass }[] = [
  { id: 'dashboard', label: 'Overview', icon: Compass }, { id: 'planner', label: 'Study plan', icon: CalendarDays },
  { id: 'practice', label: 'Practice hub', icon: BookOpen }, { id: 'vocabulary', label: 'Vocabulary', icon: Sparkles },
  { id: 'errors', label: 'Error log', icon: CircleHelp }, { id: 'settings', label: 'Settings', icon: Settings2 },
];
const groups: { id: string; title: string; sub: string; minutes: number; skill: Skill; icon: typeof BookOpen; color: string }[] = [
  { id: 'foundations', title: 'Foundations', sub: 'Grammar & vocabulary', minutes: 90, skill: 'foundations', icon: BookOpen, color: 'sage' },
  { id: 'input', title: 'Listening & reading', sub: 'Build comprehension', minutes: 120, skill: 'reading', icon: Headphones, color: 'blue' },
  { id: 'output', title: 'Writing & speaking', sub: 'Express your ideas', minutes: 90, skill: 'writing', icon: MessageCircle, color: 'amber' },
];
const skillName: Record<Skill, string> = { foundations: 'Foundations', reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };
const titles: Record<Page, string> = { dashboard: 'Overview', planner: 'Study plan', practice: 'Practice hub', vocabulary: 'Vocabulary', errors: 'Error log', settings: 'Settings' };
const today = localDate();
function friendlyDate(date: string, options: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) { return new Date(`${date}T12:00:00`).toLocaleDateString('en', options); }
function uid() { return crypto.randomUUID(); }

export default function App() {
  const state = useAppStore();
  const [page, setPage] = useState<Page>('dashboard');
  const [menuOpen, setMenuOpen] = useState(false);
  const [mentorOpen, setMentorOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [plannerDate, setPlannerDate] = useState(today);
  const [timerSkill, setTimerSkill] = useState<Skill>('foundations');
  const [timerTask, setTimerTask] = useState('Foundations · focused study');
  const [showFocusTimer, setShowFocusTimer] = useState(false);
  const [initialSkill, setInitialSkill] = useState<'reading' | 'listening' | 'writing' | 'speaking' | undefined>();
  const [mentorPrompt, setMentorPrompt] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [auth, setAuth] = useState<{ authenticated: boolean; authEnabled: boolean; aiConfigured: boolean } | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const exportRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const currentPage = useRef<HTMLElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const closeMentor = useCallback(() => setMentorOpen(false), []);
  const closeManual = useCallback(() => setManualOpen(false), []);
  const clearMentorPrompt = useCallback(() => setMentorPrompt(''), []);
  const handleFocusChange = useCallback((focused: boolean) => { if (!showFocusTimer) setFocusMode(focused); }, [showFocusTimer]);

  useEffect(() => { void sessionStatus().then(setAuth); }, []);
  useEffect(() => { document.documentElement.dataset.theme = state.settings.theme; }, [state.settings.theme]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMenuOpen(true); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'j') { e.preventDefault(); setMentorOpen(v => !v); }
      else if (e.key === 'Escape') { setMenuOpen(false); setMentorOpen(false); setMobileNav(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (!running) return; const started = Date.now() - seconds * 1000; const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 250); return () => window.clearInterval(id); }, [running, timerTask]);
  useEffect(() => { if (!notice) return; const id = window.setTimeout(() => setNotice(''), 3800); return () => window.clearTimeout(id); }, [notice]);
  const allToday = totalMinutes(state.logs, [today]);
  const dueWords = state.vocabulary.filter(v => v.due <= today).length;
  const week = useMemo(() => weekDates(plannerDate), [plannerDate]);
  const weekMinutes = totalMinutes(state.logs, week);
  const elapsedLabel = `${String(Math.floor(seconds / 3600)).padStart(2, '0')}:${String(Math.floor(seconds / 60) % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const go = (next: Page) => { setPage(next); setMobileNav(false); if (next !== 'practice') setFocusMode(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const startTimer = (g: typeof groups[number]) => { setTimerSkill(g.skill); setInitialSkill(g.id === 'input' ? 'reading' : g.id === 'output' ? 'writing' : undefined); setTimerTask(`${g.title} · focused study`); setSeconds(0); setRunning(true); setShowFocusTimer(true); setFocusMode(true); go('practice'); };
  const askMentor = (prompt: string) => { setMentorPrompt(prompt); setMentorOpen(true); };
  const finishTimer = () => {
    setRunning(false);
    if (seconds > 0) {
      const minutes = Math.floor(seconds / 60);
      if (minutes > 0) { actions.logStudy({ date: localDate(), minutes, skill: timerSkill, title: timerTask }); setNotice(`${formatMinutes(minutes)} added to your study log.`); }
      else setNotice('Timer stopped. Log at least one full minute to save this session.');
    }
    setSeconds(0); setFocusMode(false); setShowFocusTimer(false);
  };
  const manualLog = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const data = new FormData(e.currentTarget); const minutes = Number(data.get('minutes')); const skill = data.get('skill') as Skill; const title = String(data.get('title') || '').trim();
    if (minutes < 1 || minutes > 1440 || !title) return;
    actions.logStudy({ date: String(data.get('date') || localDate()), minutes, skill, title }); setManualOpen(false); setNotice('Study session added to your log.');
  };
  const downloadBackup = () => {
    const blob = new Blob([actions.exportData()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `fluentpath-progress-${localDate()}.json`; a.click(); URL.revokeObjectURL(url); setNotice('Progress backup downloaded.');
  };
  const importBackup = async (file?: File) => { if (!file) return; try { actions.importData(await file.text()); setNotice('Progress backup restored.'); } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not read that backup.'); } if (importRef.current) importRef.current.value = ''; };
  const signIn = async (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); const d = new FormData(e.currentTarget); setLoggingIn(true); setLoginError(''); try { await login(String(d.get('username')), String(d.get('password'))); setAuth(v => v ? { ...v, authenticated: true } : v); } catch (e) { setLoginError(e instanceof Error ? e.message : 'Sign in failed.'); } finally { setLoggingIn(false); } };
  const signOut = async () => { setLoggingOut(true); try { await logout(); if (auth) setAuth({ ...auth, authenticated: false }); } finally { setLoggingOut(false); } };

  if (auth?.authEnabled && !auth.authenticated) return <main className="login-screen"><div className="login-box"><BrandMark large /><h1>Welcome back.</h1><p className="muted">Sign in to continue your study journey.</p><form className="settings-form login-form" onSubmit={signIn}><label>Username<input name="username" autoComplete="username" required /></label><label>Password<input name="password" type="password" autoComplete="current-password" required /></label>{loginError && <p className="form-error" role="alert">{loginError}</p>}<button className="btn btn-primary" disabled={loggingIn}>{loggingIn ? 'Signing in…' : 'Sign in'}</button></form></div></main>;
  const selectedNav = nav.find(n => n.id === page)!;
  return <div className={`app-shell${focusMode && page === 'practice' ? ' is-focused' : ''}`}>
    {!focusMode && <><aside className={`sidebar${mobileNav ? ' mobile-open' : ''}`}>
      <div className="sidebar-brand"><BrandMark /><span>Fluent<span>Path</span></span><button className="icon-button mobile-close" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={18}/></button></div>
      <div className="rail-caption">YOUR LEARNING SPACE</div>
      <nav className="primary-nav" aria-label="Main navigation">{nav.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-link${page === id ? ' active' : ''}`} aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}><Icon size={18}/><span>{label}</span>{id === 'vocabulary' && dueWords > 0 && <b className="nav-count">{dueWords}</b>}</button>)}</nav>
      <div className="rail-bottom"><div className="rail-divider"/><div className="language-chip"><span className="language-dot"/><span>Learning English</span><span className="language-code">VI</span></div><button className="theme-control" onClick={() => actions.updateSettings({ theme: state.settings.theme === 'light' ? 'dark' : 'light' })} aria-label={`Switch to ${state.settings.theme === 'light' ? 'dark' : 'light'} theme`}>{state.settings.theme === 'light' ? <Moon size={17}/> : <Sun size={17}/>}<span>{state.settings.theme === 'light' ? 'Dark appearance' : 'Light appearance'}</span></button><div className="sidebar-user"><div className="user-avatar">F</div><div><strong>My study space</strong><span>IELTS Academic</span></div><button className="icon-button user-menu" aria-label="Open settings" onClick={() => go('settings')}><MoreHorizontal size={18}/></button></div></div>
    </aside><button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)}/></>}
    <div className="main-column">
      {!focusMode && <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={20}/></button><div className="breadcrumb"><span>Workspace</span><ChevronRight size={14}/><strong>{titles[page]}</strong></div><div className="topbar-actions"><button className="shortcut-button" aria-label="Open quick navigation" onClick={() => setMenuOpen(true)}><Search size={15}/><span>Jump to</span><kbd>⌘ K</kbd></button><span className="topbar-divider"/><button className="mentor-trigger" aria-label="Ask mentor" onClick={() => setMentorOpen(true)}><span className="mentor-trigger-icon"><Sparkles size={16}/></span><span>Ask mentor</span><kbd>⌘ J</kbd></button><button className="icon-button top-theme" aria-label="Toggle theme" onClick={() => actions.updateSettings({ theme: state.settings.theme === 'light' ? 'dark' : 'light' })}>{state.settings.theme === 'light' ? <Moon size={18}/> : <Sun size={18}/>}</button></div></header>}
      <main ref={currentPage} className={`page-content${focusMode ? ' focus-content' : ''}`} tabIndex={-1}>
        {page === 'dashboard' && <Dashboard state={state} todayMinutes={allToday} dueWords={dueWords} onStart={startTimer} onManual={() => setManualOpen(true)} onNavigate={go} onMentor={() => setMentorOpen(true)} onRemove={id => { actions.removeLog(id); setNotice('Study entry removed.'); }} />}
        {page === 'planner' && <Planner state={state} date={plannerDate} setDate={setPlannerDate} week={week} weekMinutes={weekMinutes} onStart={startTimer} onManual={() => setManualOpen(true)} />}
        {page === 'practice' && <section className="practice-shell">{showFocusTimer && <><header className="practice-toolbar"><div><h1>Study session</h1></div><div className="practice-toolbar-actions">{focusMode && <button className="btn btn-ghost" onClick={() => { setFocusMode(false); setRunning(false); }}><ArrowLeft size={16}/> Exit focus</button>}</div></header><div className="timer-panel panel"><div className="timer-left"><span className="timer-state"><span className={`status-dot${running ? ' live' : ''}`}/>{running ? 'SESSION IN PROGRESS' : seconds ? 'SESSION PAUSED' : 'READY WHEN YOU ARE'}</span><div className="timer-clock" aria-live="off">{elapsedLabel}</div><label className="timer-task-label">What are you working on?<input value={timerTask} onChange={e => setTimerTask(e.target.value)} disabled={running} aria-label="Study session title" /></label></div><div className="timer-controls"><button className="timer-main-button" onClick={() => setRunning(v => !v)} aria-label={running ? 'Pause timer' : 'Start timer'}>{running ? <Pause size={20}/> : <Play size={20} fill="currentColor"/>}<span>{running ? 'Pause' : seconds ? 'Resume' : 'Start session'}</span></button><button className="btn btn-ghost" onClick={() => { setRunning(false); setSeconds(0); }}><RotateCcw size={16}/> Reset</button><button className="btn btn-primary" disabled={seconds < 1} onClick={finishTimer}><Check size={16}/> Finish & log</button></div></div></>}<PracticeHub initialSkill={initialSkill} onAskMentor={askMentor} onFocusChange={handleFocusChange} /></section>}
        {page === 'vocabulary' && <Vocabulary />}{page === 'errors' && <ErrorLog />}
        {page === 'settings' && <SettingsPage state={state} aiConfigured={auth?.aiConfigured ?? false} authEnabled={auth?.authEnabled ?? false} onNotice={setNotice} onExport={downloadBackup} onImport={() => importRef.current?.click()} onLogout={() => void signOut()} loggingOut={loggingOut} />}
      </main>
      {!focusMode && <footer className="page-footer"><span>Small steps add up.</span><span>FluentPath <i>·</i> IELTS Academic</span></footer>}
    </div>
    <input ref={importRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose progress backup" tabIndex={-1} onChange={e => void importBackup(e.target.files?.[0])}/>
    {manualOpen && <ManualLog onClose={closeManual} onSubmit={manualLog}/>}
    {notice && <div className="toast" role="status"><Check size={17}/>{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16}/></button></div>}
    {storageError && <div className="storage-warning" role="alert"><ShieldCheck size={16}/>{storageError}</div>}
    <Mentor open={mentorOpen} onClose={closeMentor} language={state.settings.mentorLanguage} aiConfigured={auth?.aiConfigured ?? false} initialPrompt={mentorPrompt} onPromptUsed={clearMentorPrompt}/>
    <CommandMenu open={menuOpen} onClose={closeMenu} onNavigate={go}/>
  </div>;
}

function BrandMark({ large = false }: { large?: boolean }) { return <span className={`brand-mark${large ? ' large' : ''}`} aria-hidden="true"><span/><span/><span/><span/></span>; }

function Dashboard({ state, todayMinutes, dueWords, onStart, onManual, onNavigate, onMentor, onRemove }: { state: AppState; todayMinutes: number; dueWords: number; onStart: (g: typeof groups[number]) => void; onManual: () => void; onNavigate: (p: Page) => void; onMentor: () => void; onRemove: (id: string) => void }) {
  const [showHistory, setShowHistory] = useState(false);
  const todayLogs = state.logs.filter(l => l.date === localDate()).sort((a, b) => b.id.localeCompare(a.id));
  const completed = groups.filter(g => totalMinutes(state.logs, [localDate()], g.id === 'input' ? ['reading', 'listening'] : g.id === 'output' ? ['writing', 'speaking'] : ['foundations']) >= g.minutes).length;
  const roadmapStart = state.settings.startDate;
  const months = [
    { title: 'Build your base', sub: 'Month 1 · Grammar & diagnostic', date: addDays(roadmapStart, 0) },
    { title: 'Practise deliberately', sub: 'Months 2–3 · Skills & feedback', date: addDays(roadmapStart, 31) },
    { title: 'Work under time', sub: 'Months 4–5 · Timed practice', date: addDays(roadmapStart, 90) },
    { title: 'Ready for exam day', sub: 'Month 6 · Full-length practice', date: addDays(roadmapStart, 151) },
  ];
  return <div className="dashboard-page">
    <header className="welcome-row"><div><div className="date-stamp"><span className="date-dot"/> {friendlyDate(localDate())}</div><h1>A little progress,<br/><em>every day.</em></h1><p>One focused session at a time brings your English closer to your goal.</p></div><button className="welcome-mentor" onClick={onMentor}><div className="welcome-mentor-art"><Sparkles size={21}/></div><span><b>Need a hand?</b><small>Your study mentor is here</small></span><ArrowRight size={16}/></button></header>
    <section className="day-progress panel" aria-label="Today's study allocation"><div className="section-head"><div><h2>Today’s rhythm</h2><p>{completed === 3 ? 'All three areas reached their daily goal.' : `${formatMinutes(todayMinutes)} of 5 hours logged today`}</p></div><span className="allocation-label"><Target size={15}/> 300 min · Mon–Fri</span></div><div className="allocation-track" role="img" aria-label={`Study time logged today: ${groups.map(g => `${g.title} ${totalMinutes(state.logs, [localDate()], g.id === 'input' ? ['reading', 'listening'] : g.id === 'output' ? ['writing', 'speaking'] : ['foundations'])} of ${g.minutes} minutes`).join(', ')}`}>
      {groups.map(g => { const skills = g.id === 'input' ? ['reading', 'listening'] as Skill[] : g.id === 'output' ? ['writing', 'speaking'] as Skill[] : ['foundations'] as Skill[]; const minutes = totalMinutes(state.logs, [localDate()], skills); const width = Math.min(100, minutes / g.minutes * 100); return <div key={g.id} className={`allocation-segment ${g.color}`} style={{ flex: `${g.minutes} 1 0%` }}><div className="allocation-fill" style={{ width: `${width}%` }}/></div>; })}
    </div><div className="allocation-legend">{groups.map(g => { const skills = g.id === 'input' ? ['reading', 'listening'] as Skill[] : g.id === 'output' ? ['writing', 'speaking'] as Skill[] : ['foundations'] as Skill[]; const minutes = totalMinutes(state.logs, [localDate()], skills); return <div className="legend-item" key={g.id}><span className={`legend-dot ${g.color}`}/><span className="legend-name">{g.title}</span><b>{minutes}<i> / {g.minutes}m</i></b></div>; })}</div></section>
    <div className="dashboard-grid"><div className="dashboard-main">
      <section className="queue-section"><div className="section-head queue-head"><div><h2>Your study queue</h2></div><button className="btn btn-ghost small-button" onClick={() => onNavigate('planner')}>View week <ArrowRight size={15}/></button></div>
        <div className="study-queue">{groups.map((g, i) => { const Icon = g.icon; const skills = g.id === 'input' ? ['reading', 'listening'] as Skill[] : g.id === 'output' ? ['writing', 'speaking'] as Skill[] : ['foundations'] as Skill[]; const done = totalMinutes(state.logs, [localDate()], skills); const pct = Math.min(100, Math.round(done / g.minutes * 100)); return <article className="queue-item" key={g.id}><span className="queue-index">0{i + 1}</span><div className={`queue-icon ${g.color}`}><Icon size={19}/></div><div className="queue-copy"><div className="queue-title-line"><h3>{g.title}</h3><span className="queue-duration"><Clock3 size={14}/>{g.minutes} min</span></div><p>{g.sub}</p><div className="queue-progress"><span className={g.color} style={{ width: `${pct}%` }}/></div><small>{done >= g.minutes ? 'Daily goal reached' : done ? `${formatMinutes(done)} logged · ${g.minutes - done}m to go` : 'Not started yet'}</small></div><button className={`queue-start${done >= g.minutes ? ' is-done' : ''}`} onClick={() => onStart(g)} aria-label={`${done >= g.minutes ? 'Study again' : 'Start'} ${g.title}`}>{done >= g.minutes ? <Check size={18}/> : <Play size={17} fill="currentColor"/>}</button></article>; })}</div>
        <button className="manual-add-link" onClick={onManual}><Plus size={15}/> Log time you studied earlier</button>
      </section>
      <section className="roadmap-section panel"><div className="section-head"><div><h2>A clear path forward</h2></div><button className="icon-button" aria-label="Edit study plan" onClick={() => onNavigate('settings')}><Settings2 size={17}/></button></div><div className="roadmap-track">{months.map((m, i) => <div className={`roadmap-step${i === 0 ? ' current' : ''}`} key={m.title}><div className="roadmap-point">{i === 0 ? <span/> : <i>{i + 1}</i>}</div><div><small>{m.sub.split(' · ')[0]}</small><h3>{m.title}</h3><p>{m.sub.split(' · ')[1]}</p></div></div>)}</div><div className="roadmap-foot"><span><CalendarDays size={15}/> Starting {friendlyDate(roadmapStart, { month: 'short', day: 'numeric', year: 'numeric' })}</span><button onClick={() => onNavigate('planner')}>Open study plan <ArrowRight size={14}/></button></div></section>
      {todayLogs.length > 0 && <section className="today-history"><div className="section-head"><div><h2>Your sessions</h2></div><button className="text-button" onClick={() => setShowHistory(v => !v)}>{showHistory ? 'Hide entries' : 'View entries'} <ChevronDown size={15}/></button></div>{showHistory && <div className="history-list">{todayLogs.map(log => <div key={log.id} className="history-item"><span className="history-mark"><Check size={14}/></span><span className="history-title">{log.title}<small>{skillName[log.skill]} · {friendlyDate(log.date, { day: 'numeric', month: 'short' })}</small></span><b>{formatMinutes(log.minutes)}</b><button className="icon-button delete-entry" aria-label={`Remove ${log.title}`} onClick={() => onRemove(log.id)}><Trash2 size={15}/></button></div>)}</div>}</section>}
    </div><aside className="dashboard-aside"><section className="goal-card"><div className="goal-top"><span className="goal-icon"><Target size={19}/></span><span>YOUR GOAL</span></div><div className="goal-band">{state.settings.targetBand.toFixed(1)}<span> IELTS</span></div><p>Target band score</p><div className="goal-rule"/><div className="goal-timeline"><span className="timeline-icon"><CalendarDays size={15}/></span><span>Six-month study plan</span><span className="timeline-chevron"><ArrowDownRight size={16}/></span></div><button className="goal-edit" onClick={() => onNavigate('settings')}>Edit your goal <ArrowRight size={14}/></button></section>
      <section className="review-card panel"><div className="review-card-head"><div className="review-heading-icon"><BookOpen size={17}/></div><span>NEXT REVIEW</span></div><div className="review-count">{dueWords}<span> {dueWords === 1 ? 'word' : 'words'}</span></div><p>{dueWords ? 'Ready when you are. A quick review keeps them fresh.' : 'Your vocabulary is up to date for today.'}</p><button className="review-link" onClick={() => onNavigate('vocabulary')}>{dueWords ? 'Review vocabulary' : 'Open vocabulary'} <ArrowRight size={14}/></button></section>
      <section className="week-note panel"><div className="week-note-icon"><Flame size={16}/></div><p><strong>{studyStreak(state.logs)}-day study streak</strong><br/><span>Weekends are optional.</span></p></section>
    </aside></div>
  </div>;
}

function Planner({ state, date, setDate, week, weekMinutes, onStart, onManual }: { state: AppState; date: string; setDate: (d: string) => void; week: string[]; weekMinutes: number; onStart: (g: typeof groups[number]) => void; onManual: () => void }) {
  const weekdays = week.slice(0, 5); const todayDate = localDate();
  const weekStart = week[0]; const weekEnd = week[6];
  const shift = (count: number) => setDate(addDays(date, count * 7));
  return <section className="planner-page"><header className="page-heading planner-heading"><div><h1>Study plan</h1><p className="muted">A steady weekday rhythm, with room to move at your own pace.</p></div><button className="btn btn-primary" onClick={onManual}><Plus size={16}/> Log completed study</button></header>
    <div className="planner-summary panel"><div><span className="planner-label">THIS WEEK</span><strong>{formatMinutes(weekMinutes)} <i>logged</i></strong><p>{formatMinutes(Math.max(0, 1500 - weekMinutes))} to the 25-hour weekly target</p></div><div className="week-meter"><span style={{ width: `${Math.min(100, weekMinutes / 1500 * 100)}%` }}/></div><div className="planner-quota"><span><b>300 min</b><small>per weekday</small></span><span><b>5 days</b><small>Mon–Fri focus</small></span></div></div>
    <div className="week-nav"><button className="icon-button" onClick={() => shift(-1)} aria-label="Previous week"><ChevronLeft size={19}/></button><div><h2>{friendlyDate(weekStart, { month: 'long', day: 'numeric' })} – {friendlyDate(weekEnd, { month: 'long', day: 'numeric', year: 'numeric' })}</h2><button className="text-button" onClick={() => setDate(todayDate)}>Go to this week</button></div><button className="icon-button" onClick={() => shift(1)} aria-label="Next week"><ChevronRight size={19}/></button></div>
    <div className="planner-days">{weekdays.map((d, i) => { const logs = state.logs.filter(l => l.date === d); const mins = logs.reduce((s, l) => s + l.minutes, 0); const isToday = d === todayDate; const quota = [90, 120, 90]; return <article className={`planner-day panel${isToday ? ' is-today' : ''}${d > todayDate ? ' is-upcoming' : ''}`} key={d}><header><div><span className="day-name">{['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'][i]}</span><h3>{friendlyDate(d, { month: 'short', day: 'numeric' })}{isToday && <i>Today</i>}</h3></div><span className="day-minutes">{formatMinutes(mins)} <small>/ 300m</small></span></header><div className="day-meter"><span style={{ width: `${Math.min(100, mins / 300 * 100)}%` }}/></div><div className="day-allocations">{groups.map((g, gi) => { const skills = g.id === 'input' ? ['reading', 'listening'] as Skill[] : g.id === 'output' ? ['writing', 'speaking'] as Skill[] : ['foundations'] as Skill[]; const amount = totalMinutes(state.logs, [d], skills); return <div key={g.id} className="day-allocation"><span className={`allocation-mini ${g.color}`}/><span>{g.title}</span><b>{Math.min(amount, quota[gi])}<i>/{quota[gi]}</i></b></div>; })}</div>{logs.length > 0 ? <div className="day-log-list">{logs.map(l => <div key={l.id}><Check size={13}/><span>{l.title}</span><b>{formatMinutes(l.minutes)}</b></div>)}</div> : <div className="day-empty">{d > todayDate ? 'A fresh page for your next session.' : 'No sessions logged yet.'}</div>}<button className="day-action" onClick={() => d > todayDate ? onStart(groups[0]) : onManual()}>{d > todayDate ? <><Play size={14}/> Start foundations now</> : <><Plus size={14}/> Add study time</>}</button></article>; })}</div>
    <div className="planner-note"><Clock3 size={16}/><p><strong>Move sessions around.</strong> Your weekly view follows your real study log. Sessions can be logged on any day; weekends are left open by default.</p></div>
  </section>;
}

function ManualLog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) {
  const ref = useRef<HTMLDivElement>(null); const first = useRef<HTMLInputElement>(null);
  useEffect(() => { const prior = document.activeElement as HTMLElement; first.current?.focus(); const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); if (e.key === 'Tab' && ref.current) { const els = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]),input,select')]; if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els.at(-1)?.focus(); } else if (!e.shiftKey && document.activeElement === els.at(-1)) { e.preventDefault(); els[0]?.focus(); } } }; document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); prior?.focus(); }; }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}><section className="manual-modal" role="dialog" aria-modal="true" aria-labelledby="log-title" ref={ref}><header><div className="modal-mark"><Clock3 size={18}/></div><div><h2 id="log-title">Add a study session</h2><p>For time you’ve already spent studying.</p></div><button className="icon-button" aria-label="Close" onClick={onClose}><X size={18}/></button></header><form className="settings-form" onSubmit={onSubmit}><label>What did you work on?<input ref={first} name="title" placeholder="e.g. Cambridge Listening Test 2" required maxLength={120}/></label><div className="form-row"><label>Skill<select name="skill" defaultValue="foundations">{Object.entries(skillName).map(([k, v]) => <option value={k} key={k}>{v}</option>)}</select></label><label>Time spent (minutes)<input name="minutes" type="number" min="1" max="1440" defaultValue="30" required/></label></div><label>Study date<input name="date" type="date" defaultValue={localDate()} max={localDate()} required/></label><div className="modal-actions"><button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-primary"><Check size={16}/> Save session</button></div></form></section></div>;
}

function SettingsPage({ state, aiConfigured, authEnabled, onNotice, onExport, onImport, onLogout, loggingOut }: { state: AppState; aiConfigured: boolean; authEnabled: boolean; onNotice: (s: string) => void; onExport: () => void; onImport: () => void; onLogout: () => void; loggingOut: boolean }) {
  const roadmap = state.settings.startDate;
  return <section className="settings-page"><header className="page-heading"><div><h1>Settings</h1><p className="muted">Choose a plan that works for your life and keep your learning backed up.</p></div></header>
    <div className="settings-layout"><div className="settings-content">
      <section className="settings-card panel"><div className="settings-card-head"><div className="settings-icon"><Target size={18}/></div><div><h2>Your IELTS goal</h2><p>Adjust the target and timeline for your study plan.</p></div></div><div className="settings-form"><label>Target band<select value={state.settings.targetBand} onChange={e => actions.updateSettings({ targetBand: Number(e.target.value) })}>{[5,5.5,6,6.5,7,7.5,8,8.5,9].map(n => <option value={n} key={n}>{n.toFixed(1)}</option>)}</select></label><label>Study plan start date<input type="date" value={roadmap} onChange={e => { actions.updateSettings({ startDate: e.target.value }); onNotice('Your six-month roadmap date was updated.'); }}/></label><p className="field-note">Aiming for your goal by {friendlyDate(addDays(roadmap, 181), { month: 'long', day: 'numeric', year: 'numeric' })}.</p></div></section>
      <section className="settings-card panel"><div className="settings-card-head"><div className="settings-icon language"><MessageCircle size={18}/></div><div><h2>Study mentor</h2><p>Set the language used for explanations.</p></div><span className={`connection-status${aiConfigured ? ' connected' : ''}`}><i/>{aiConfigured ? 'Connected' : 'Not connected'}</span></div><label className="settings-select">Explanation language<select value={state.settings.mentorLanguage} onChange={e => actions.updateSettings({ mentorLanguage: e.target.value as 'vi' | 'en' })}><option value="vi">Vietnamese explanations</option><option value="en">English explanations</option></select></label><p className="field-note">The mentor opens when your optional AI server is configured.</p></section>
      <section className="settings-card panel"><div className="settings-card-head"><div className="settings-icon appearance"><Sun size={18}/></div><div><h2>Appearance</h2><p>Choose a comfortable workspace theme.</p></div></div><div className="theme-options"><button className={`theme-option${state.settings.theme === 'light' ? ' selected' : ''}`} onClick={() => actions.updateSettings({ theme: 'light' })}><Sun size={18}/><span>Light</span>{state.settings.theme === 'light' && <Check size={16}/>}</button><button className={`theme-option${state.settings.theme === 'dark' ? ' selected' : ''}`} onClick={() => actions.updateSettings({ theme: 'dark' })}><Moon size={18}/><span>Dark</span>{state.settings.theme === 'dark' && <Check size={16}/>}</button></div></section>
      <section className="settings-card panel"><div className="settings-card-head"><div className="settings-icon backup"><ShieldCheck size={18}/></div><div><h2>Your progress & privacy</h2><p>Your study data is saved in this browser. Back it up before switching devices.</p></div></div><div className="backup-actions"><button className="btn btn-ghost" onClick={onExport}><Download size={16}/> Export backup</button><button className="btn btn-ghost" onClick={onImport}><Upload size={16}/> Import backup</button></div><p className="field-note">Includes your study log, vocabulary, error log, and preferences.</p></section>
      {authEnabled && <section className="settings-card panel signout-card"><div className="settings-card-head"><div className="settings-icon signout"><LogOut size={18}/></div><div><h2>Account</h2><p>Sign out of this device.</p></div></div><button className="btn btn-ghost" onClick={onLogout} disabled={loggingOut}><LogOut size={16}/>{loggingOut ? 'Signing out…' : 'Sign out'}</button></section>}
    </div><aside className="settings-aside"><div className="settings-aside-card"><span className="aside-sprig"><Sparkles size={19}/></span><h3>Progress is personal.</h3><p>FluentPath keeps your activity on this device. Only an explicit backup moves it elsewhere.</p><div className="aside-separator"/><div className="aside-fact"><span>Activity logged</span><b>{state.logs.length} {state.logs.length === 1 ? 'session' : 'sessions'}</b></div><div className="aside-fact"><span>Words saved</span><b>{state.vocabulary.length}</b></div><div className="aside-fact"><span>Errors reviewed</span><b>{state.errors.filter(e => e.resolved).length}</b></div></div></aside></div>
  </section>;
}
