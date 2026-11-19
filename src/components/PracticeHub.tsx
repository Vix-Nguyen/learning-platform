import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, Clock3, Download, Headphones, Mic, Pause, PenLine, Play, RotateCcw, Send, Volume2 } from 'lucide-react';
import { actions, useAppStore } from '../lib/store';
import { mentorRequest } from '../lib/api';
import { localDate } from '../lib/progress';
import type { SpeechRecognitionLike } from '../lib/useCoachVoice';
import type { AIFeedback, Skill } from '../types';
import { cueCards, listeningScripts, officialLinks, readingDrills, taskPrompts } from '../data/practice';
import './practice.css';

type Props = { initialSkill?: 'reading' | 'listening' | 'writing' | 'speaking'; onAskMentor?: (prompt: string) => void; onFocusChange?: (focused: boolean) => void };
const tabs: { id: 'reading'|'listening'|'writing'|'speaking'; label: string; Icon: typeof Headphones }[] = [
  { id: 'reading', label: 'Reading', Icon: BookOpen }, { id: 'listening', label: 'Listening', Icon: Headphones }, { id: 'writing', label: 'Writing', Icon: PenLine }, { id: 'speaking', label: 'Speaking', Icon: Mic },
];
const DRAFT_KEY = 'fluentpath.writingDrafts.v1';
const TRANSCRIPT_KEY = 'fluentpath.speakingTranscript.v1';
function readDrafts(): Record<string, string> { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}'); } catch { return {}; } }
function readTranscript(): string { try { return localStorage.getItem(TRANSCRIPT_KEY) || ''; } catch { return ''; } }
function FeedbackPanel({ feedback, reply }: { feedback: AIFeedback | null; reply: string }) {
  if (!feedback) return reply ? <div className="mentor-feedback"><h3>Mentor feedback</h3><p>{reply}</p></div> : null;
  return <div className="mentor-feedback"><h3>Mentor feedback</h3>{feedback.summary && <p>{feedback.summary}</p>}<ul className="feedback-criteria">{feedback.criteria.map((criterion, i) => <li key={`${criterion.name}-${i}`}><strong>{criterion.name}</strong>{typeof criterion.score === 'number' && <span className="badge">{criterion.score}</span>}<p>{criterion.feedback}</p></li>)}</ul>{feedback.corrections?.length ? <div className="feedback-corrections"><h4>Suggested corrections</h4>{feedback.corrections.map((correction, i) => <div className="feedback-correction" key={`${correction.original}-${i}`}><div><span>Your text</span><p>{correction.original}</p></div><ArrowRight size={16}/><div><span>Suggestion</span><p>{correction.improved}</p></div><small>{correction.reason}</small></div>)}</div> : null}</div>;
}

export default function PracticeHub({ initialSkill = 'reading', onAskMentor, onFocusChange }: Props) {
  const { settings } = useAppStore();
  const [skill, setSkill] = useState<Props['initialSkill']>(initialSkill);
  const [drillIndex, setDrillIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [audioText, setAudioText] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [timer, setTimer] = useState(0);
  const [running, setRunning] = useState(false);
  const [task, setTask] = useState<'task1'|'task2'>('task1');
  const [drafts, setDrafts] = useState(readDrafts);
  const [draftError, setDraftError] = useState('');
  const [feedback, setFeedback] = useState<AIFeedback | null>(null);
  const [feedbackReply, setFeedbackReply] = useState('');
  const [feedbackError, setFeedbackError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cueIndex, setCueIndex] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingError, setRecordingError] = useState('');
  const [recordedUrl, setRecordedUrl] = useState('');
  const [transcript, setTranscript] = useState(readTranscript);
  const [transcriptStorageError, setTranscriptStorageError] = useState('');
  const [transcriptionError, setTranscriptionError] = useState('');
  const [transcribing, setTranscribing] = useState(false);
  const [transcriptSupported, setTranscriptSupported] = useState(true);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAt = useRef(0);
  const drillStartedAt = useRef(Date.now());
  const taskInfo = taskPrompts[task];
  const drill = readingDrills[drillIndex % readingDrills.length];
  const script = listeningScripts[drillIndex % listeningScripts.length];
  const drillQuestions = skill === 'reading' ? drill.questions : drillIndex % 2 === 0 ? [
    { prompt: 'What time does the library open on weekdays?', options: ['8:00', '8:30', '9:00', '10:00'], answer: 1, explanation: 'The speaker says the library opens at eight thirty.' },
    { prompt: 'Where should visitors return books?', options: ['At the west entrance', 'At the café', 'At the desk by the east entrance', 'On the second floor'], answer: 2, explanation: 'Books should be returned at the desk beside the east entrance.' },
    { prompt: 'When should a study room be reserved?', options: ['An hour before', 'At least one day ahead', 'Only at the desk', 'After the café closes'], answer: 1, explanation: 'The speaker asks visitors to reserve a room at least a day in advance.' },
    { prompt: 'What time does the research area close?', options: ['4:00', '5:00', '5:30', '6:00'], answer: 3, explanation: 'The research area remains open until six.' },
  ] : [
    { prompt: 'On which day will the class visit Green Lake?', options: ['Tuesday', 'Wednesday', 'Thursday', 'Friday'], answer: 2, explanation: 'The speaker says the trip is on Thursday, not Wednesday.' },
    { prompt: 'When should students arrive for the bus?', options: ['At 6:45', 'At 7:00', 'At 7:15', 'At 7:30'], answer: 1, explanation: 'The bus leaves at 7:15 and students should arrive by 7:00.' },
    { prompt: 'Which item should students bring?', options: ['Lunch', 'A notebook', 'A camera', 'A packed dinner'], answer: 1, explanation: 'The speaker lists a notebook among the items to bring.' },
    { prompt: 'Where will the group meet Dr Tran?', options: ['At the southern gate', 'At the bus stop', 'At the visitor centre', 'At the northern gate'], answer: 3, explanation: 'The group will meet Dr Tran at the northern gate.' },
  ];
  const score = useMemo(() => answers.reduce((sum, a, i) => sum + (a === drillQuestions[i]?.answer ? 1 : 0), 0), [answers, drillQuestions]);
  // Calculate from a fixed deadline to avoid interval drift.
  useEffect(() => { if (!running) return; const deadline = Date.now() + timer * 1000; const id = window.setInterval(() => setTimer(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 250); return () => window.clearInterval(id); }, [running]);
  useEffect(() => { if (running && timer === 0) finishTimed('writing', `Writing ${task}`); }, [running, timer, task]);
  useEffect(() => { onFocusChange?.(!!running || recording || transcribing); }, [running, recording, transcribing, onFocusChange]);
  useEffect(() => () => { window.speechSynthesis?.cancel(); if (mediaRef.current?.state === 'recording') mediaRef.current.stop(); streamRef.current?.getTracks().forEach(t => t.stop()); recognitionRef.current?.abort(); }, []);
  useEffect(() => () => { if (recordedUrl) URL.revokeObjectURL(recordedUrl); }, [recordedUrl]);
  useEffect(() => { if (recording) stopRecording(); if (transcribing) { recognitionRef.current?.abort(); setTranscribing(false); } window.speechSynthesis?.cancel(); }, [skill]);
  useEffect(() => { setAnswers([]); setSubmitted(false); setAudioText(false); setAudioError(''); setTimer(0); setRunning(false); setFeedback(null); setFeedbackReply(''); setFeedbackError(''); drillStartedAt.current = Date.now(); }, [skill, drillIndex]);
  useEffect(() => { setFeedback(null); setFeedbackReply(''); setFeedbackError(''); }, [task]);
  function switchSkill(next: NonNullable<Props['initialSkill']>) { setSkill(next); }
  function startTimer(seconds: number) { startedAt.current = Date.now(); setTimer(seconds); setRunning(true); }
  function finishTimed(skillName: Skill, title: string) { if (running) { const elapsed = Math.round((Date.now() - startedAt.current) / 6000) / 10; if (elapsed > 0) actions.logStudy({ date: localDate(), minutes: elapsed, skill: skillName, title }); } setRunning(false); setTimer(0); }
  function resetDrill() { setAnswers([]); setSubmitted(false); drillStartedAt.current = Date.now(); }
  function submitDrill() {
    if (submitted || !drillQuestions.every((_, i) => Number.isInteger(answers[i]))) return;
    setSubmitted(true);
    const wrong = drillQuestions.flatMap((q, i) => answers[i] === q.answer ? [] : [{ date: localDate(), skill: skill as Skill, question: q.prompt, answer: q.options[answers[i]] || '', correct: q.options[q.answer], explanation: q.explanation }]);
    if (wrong.length) actions.addErrors(wrong);
    const elapsedMinutes = Math.round((Date.now() - drillStartedAt.current) / 6000) / 10;
    if (elapsedMinutes > 0) actions.logStudy({ date: localDate(), minutes: elapsedMinutes, skill: skill as Skill, title: `${skill === 'reading' ? 'Reading' : 'Listening'} mini drill` });
  }
  function playSynthetic(text: string) {
    if (!('speechSynthesis' in window)) { setAudioError('Speech synthesis is not supported in this browser. You can still read the script below.'); setAudioText(true); return; }
    window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'en-US'; utterance.rate = 0.9; utterance.onerror = () => setAudioError('Synthetic speech could not be played. Reveal the transcript to continue.'); window.speechSynthesis.speak(utterance);
  }
  function updateDraft(value: string) { const next = { ...drafts, [task]: value }; setDrafts(next); try { localStorage.setItem(DRAFT_KEY, JSON.stringify(next)); setDraftError(''); } catch { setDraftError('Could not save this draft in browser storage. Copy it somewhere safe before leaving.'); } }
  async function askWriting() {
    const text = drafts[task]?.trim() || ''; if (!text) { setFeedbackError('Write a response before asking for feedback.'); return; }
    const prompt = `Give provisional IELTS Academic Writing ${task === 'task1' ? 'Task 1' : 'Task 2'} feedback in Vietnamese. Assess the four public criteria; do not claim an official band. Prompt: ${taskInfo.prompt}\n\nResponse:\n${text}`;
    const fullPrompt = `${prompt}${task === 'task1' && 'rows' in taskInfo ? `\n\nData table:\n${taskInfo.rows.map(row => row.join(' | ')).join('\n')}` : ''}`;
    setBusy(true); setFeedbackError(''); setFeedback(null); setFeedbackReply(''); try { const result = await mentorRequest({ mode: 'writing', text, task: fullPrompt, language: settings.mentorLanguage }); setFeedback(result.feedback || null); setFeedbackReply(result.feedback ? '' : result.reply); } catch (e) { setFeedbackError(e instanceof Error ? e.message : 'The mentor is unavailable.'); } finally { setBusy(false); }
  }
  async function startRecording() {
    setRecordingError(''); if (recordedUrl) URL.revokeObjectURL(recordedUrl); setRecordedUrl(''); setSpeakingTranscript('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setRecordingError('Audio recording is not supported in this browser. Try a current desktop browser.'); return; }
    try { const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); streamRef.current = stream; chunksRef.current = []; const recorder = new MediaRecorder(stream); mediaRef.current = recorder; recorder.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); }; recorder.onstop = () => { const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }); const url = URL.createObjectURL(blob); setRecordedUrl(url); stream.getTracks().forEach(t => t.stop()); streamRef.current = null; }; recorder.start(); startedAt.current = Date.now(); setRecording(true); } catch (e) { setRecordingError(e instanceof Error && e.name === 'NotAllowedError' ? 'Microphone permission was denied. Allow microphone access in your browser settings and try again.' : 'Could not start the microphone. Check that it is connected and available.'); }
  }
  function stopRecording() { mediaRef.current?.stop(); setRecording(false); const minutes = Math.round((Date.now() - startedAt.current) / 6000) / 10; if (minutes > 0) actions.logStudy({ date: localDate(), minutes, skill: 'speaking', title: 'Recorded speaking practice' }); streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  function startTranscription() {
    const Constructor = window.SpeechRecognition || window.webkitSpeechRecognition; if (!Constructor) { setTranscriptSupported(false); return; }
    const recog = new Constructor(); recognitionRef.current = recog; recog.lang = 'en-US'; recog.interimResults = true; recog.onresult = e => { let text = ''; for (let i = 0; i < e.results.length; i++) text += `${e.results[i][0].transcript}${e.results[i].isFinal ? ' ' : ''}`; setSpeakingTranscript(text.trim()); }; recog.onerror = e => { setTranscribing(false); setTranscriptionError(e.error === 'not-allowed' ? 'Microphone permission was denied for dictation.' : `Dictation stopped: ${e.error}. You can type your transcript.`); }; recog.onend = () => setTranscribing(false); try { recog.start(); setTranscribing(true); setTranscriptSupported(true); setTranscriptionError(''); } catch { setTranscriptSupported(false); }
  }
  async function askSpeaking() {
    if (!transcript.trim()) { setFeedbackError('Add or edit a transcript before requesting language feedback.'); return; }
    const prompt = `Give provisional IELTS Speaking feedback in Vietnamese on fluency/coherence, lexical resource, grammar, and organization using this editable transcript. Do not assess audio quality or pronunciation from text. Cue card: ${cueCards[cueIndex]}\nTranscript:\n${transcript}`;
    setBusy(true); setFeedbackError(''); setFeedback(null); setFeedbackReply(''); try { const result = await mentorRequest({ mode: 'speaking', text: transcript, task: prompt, language: settings.mentorLanguage }); setFeedback(result.feedback || null); setFeedbackReply(result.feedback ? '' : result.reply); } catch (e) { setFeedbackError(e instanceof Error ? e.message : 'The mentor is unavailable.'); } finally { setBusy(false); }
  }
  function askMentor(prompt: string) { if (onAskMentor) onAskMentor(prompt); else setFeedbackError('The mentor panel is not available in this view.'); }
  function setSpeakingTranscript(value: string) { setTranscript(value); try { localStorage.setItem(TRANSCRIPT_KEY, value); setTranscriptStorageError(''); } catch { setTranscriptStorageError('Could not save the transcript in browser storage. Copy it before leaving.'); } }
  return <section className="practice-page practice-hub">
    <header className="page-heading"><div><h1>Practice hub</h1><p className="muted">Short practice rounds in English, with guidance in Vietnamese.</p></div><div className="practice-clock"><Clock3 size={17}/><span>5h daily plan</span></div></header>
    <nav className="practice-tabs" aria-label="Practice skills">{tabs.map(({ id, label, Icon }) => <button key={id} className={skill === id ? 'active' : ''} aria-current={skill === id ? 'page' : undefined} onClick={() => switchSkill(id)}><Icon size={17}/>{label}</button>)}</nav>
    {skill === 'reading' || skill === 'listening' ? <div className="practice-layout"><main className="practice-main">
      <div className="practice-section-heading"><div><h2>{skill === 'reading' ? drill.title : script.title}</h2></div><span className="badge">4 questions · original practice</span></div>
      {skill === 'reading' ? <article className="practice-passage">{drill.passage}</article> : <div className="listening-player"><div className="sound-icon"><Volume2 size={21}/></div><div className="listening-player-copy"><strong>Practice with synthetic audio</strong><p>Computer-generated speech is for practice only; it is not official test audio.</p></div><button className="btn btn-primary" onClick={() => playSynthetic(script.text)}><Play size={16}/> Play audio</button><button className="btn btn-ghost transcript-toggle" onClick={() => setAudioText(v => !v)}>{audioText ? 'Hide transcript' : 'Reveal transcript'}</button>{audioError && <p className="practice-error" role="status">{audioError}</p>}{audioText && <div className="listening-transcript"><strong>Transcript</strong><p>{script.text}</p></div>}</div>}
      <div className="practice-questions">{drillQuestions.map((q, i) => <fieldset className="practice-question" key={`${drillIndex}-${i}`} disabled={submitted}><legend><span>{String(i + 1).padStart(2, '0')}</span>{q.prompt}</legend><div className="practice-options">{q.options.map((option, oi) => { const selected = answers[i] === oi; const correct = submitted && oi === q.answer; const incorrect = submitted && selected && oi !== q.answer; return <label key={option} className={`${selected ? 'selected' : ''} ${correct ? 'answer-correct' : ''} ${incorrect ? 'answer-wrong' : ''}`}><input type="radio" name={`q-${i}`} checked={selected} onChange={() => setAnswers(a => { const n = [...a]; n[i] = oi; return n; })}/><span>{option}</span>{correct && <Check size={16}/>}</label>; })}</div>{submitted && <p className="answer-explanation">{q.explanation}</p>}</fieldset>)}</div>
      {submitted ? <div className="drill-result"><div><strong>{score} / {drillQuestions.length}</strong><span>correct answers</span><small>Small practice sample only; not a predicted IELTS band.</small></div><button className="btn btn-ghost" onClick={resetDrill}><RotateCcw size={16}/> Try again</button><button className="btn btn-primary" onClick={() => setDrillIndex(i => i + 1)}>Next practice <ArrowRight size={16}/></button></div> : <button className="btn btn-primary" disabled={!drillQuestions.every((_, i) => Number.isInteger(answers[i]))} onClick={submitDrill}>Check answers <ArrowRight size={16}/></button>}
      </main><aside className="practice-aside panel"><h3>{skill === 'reading' ? 'Read for the evidence' : 'Listen for key details'}</h3><p className="muted">Answer from the text or audio. Review each explanation after checking your answers.</p><div className="practice-aside-note"><span>Session</span><strong>4 questions</strong></div><div className="practice-aside-note"><span>Score</span><strong>Raw answers only</strong></div></aside></div>
    : skill === 'writing' ? <div className="writing-layout"><main className="practice-main panel writing-panel"><div className="practice-section-heading"><div><h2>Write your response</h2></div><span className="badge">{task === 'task1' ? '20 min · 150+ words' : '40 min · 250+ words'}</span></div><div className="task-switch" role="group" aria-label="Writing task"><button className={task === 'task1' ? 'active' : ''} onClick={() => setTask('task1')}>Task 1</button><button className={task === 'task2' ? 'active' : ''} onClick={() => setTask('task2')}>Task 2</button></div><div className="writing-prompt"><p>{taskInfo.prompt}</p>{task === 'task1' && 'rows' in taskInfo && <div className="data-table-wrap"><table className="data-table"><caption>Commuter transport choices (original practice data)</caption><thead><tr>{taskInfo.rows[0].map(x => <th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{taskInfo.rows.slice(1).map(row => <tr key={row[0]}>{row.map((x, i) => i ? <td key={i}>{x}</td> : <th key={i} scope="row">{x}</th>)}</tr>)}</tbody></table></div>}</div><div className="writing-tools"><span>{(drafts[task] || '').trim() ? (drafts[task] || '').trim().split(/\s+/).length : 0} words</span><button className="btn btn-ghost" onClick={() => running ? finishTimed('writing', `Writing ${task}`) : startTimer(task === 'task1' ? 20 * 60 : 40 * 60)}>{running ? <><Pause size={15}/> End timer {Math.floor(timer / 60)}:{String(timer % 60).padStart(2, '0')}</> : <><Clock3 size={15}/> Start {task === 'task1' ? '20' : '40'} min timer</>}</button></div><label className="sr-only" htmlFor="writing-response">Your writing response</label><textarea id="writing-response" className="writing-editor" value={drafts[task] || ''} onChange={e => updateDraft(e.target.value)} placeholder="Write your response here. Use clear paragraphs and check that you answer every part of the task." rows={14}/>{draftError && <p className="practice-error" role="alert">{draftError}</p>}<div className="writing-footer"><p className="muted">Four public criteria: task response, coherence, vocabulary, and grammar. AI feedback is provisional, not an official score.</p><button className="btn btn-primary" disabled={busy} onClick={askWriting}><Send size={15}/>{busy ? 'Asking mentor…' : 'Get writing feedback'}</button><button className="btn btn-ghost" onClick={() => askMentor(`Explain this Writing ${task} prompt and suggest a response plan.`)}>Ask mentor about planning</button></div>{feedbackError && <p className="practice-error" role="alert">{feedbackError}</p>}<FeedbackPanel feedback={feedback} reply={feedbackReply}/></main><aside className="practice-aside panel"><h3>Know the task</h3><p className="muted">Practice materials and descriptors from IELTS.</p>{officialLinks.slice(0, 3).map(x => <a className="practice-link" href={x.href} target="_blank" rel="noreferrer" key={x.href}>{x.label}<ArrowRight size={14}/></a>)}</aside></div>
    : <div className="speaking-layout"><main className="practice-main panel speaking-panel"><div className="practice-section-heading"><div><h2>Speak for up to two minutes</h2></div><span className="badge">1 min prepare · 2 min speak</span></div><div className="cue-card"><p>{cueCards[cueIndex]}</p><button className="btn btn-ghost" onClick={() => { setCueIndex(i => (i + 1) % cueCards.length); setSpeakingTranscript(''); setFeedback(null); setFeedbackReply(''); }}>New cue card <ArrowRight size={15}/></button></div><div className="recording-controls">{!recording ? <button className="btn btn-primary" onClick={startRecording}><Mic size={17}/> Start recording</button> : <button className="btn btn-primary recording-live" onClick={stopRecording}><span className="record-dot"/> Stop recording</button>}<button className="btn btn-ghost" onClick={startTranscription} disabled={transcribing}><Mic size={16}/>{transcribing ? 'Listening…' : 'Dictate transcript'}</button><span className="record-hint">Recording stays in this browser.</span></div>{recordingError && <p className="practice-error" role="alert">{recordingError}</p>}{recordedUrl && <div className="audio-review"><audio controls src={recordedUrl}>Audio playback is unsupported.</audio><a className="btn btn-ghost" href={recordedUrl} download="speaking-practice.webm"><Download size={15}/> Download</a></div>}<div className="transcript-box"><label htmlFor="speaking-transcript">Editable transcript <span className="muted">(browser dictation or type it yourself)</span></label><textarea id="speaking-transcript" value={transcript} onChange={e => setSpeakingTranscript(e.target.value)} rows={6} placeholder="Your transcript will appear here if browser dictation is available. You can edit it or type your response."/>{!transcriptSupported && <p className="muted small">Speech recognition is not available in this browser. You can type your own transcript.</p>}{transcriptionError && <p className="practice-error" role="alert">{transcriptionError}</p>}{transcriptStorageError && <p className="practice-error" role="alert">{transcriptStorageError}</p>}<p className="muted small">Text feedback can comment on language and organization. It cannot assess pronunciation or audio delivery.</p></div><div className="writing-footer"><button className="btn btn-primary" disabled={busy} onClick={askSpeaking}><Send size={15}/>{busy ? 'Asking mentor…' : 'Get transcript feedback'}</button><button className="btn btn-ghost" onClick={() => askMentor(`Help me prepare for this cue card: ${cueCards[cueIndex]}`)}>Ask mentor about this cue</button></div>{feedbackError && <p className="practice-error" role="alert">{feedbackError}</p>}<FeedbackPanel feedback={feedback} reply={feedbackReply}/></main><aside className="practice-aside panel"><h3>What to practise</h3><ul className="criteria-list"><li>Fluency & coherence</li><li>Lexical resource</li><li>Grammar range & accuracy</li><li>Pronunciation</li></ul><p className="muted small">Pronunciation needs audio analysis; a transcript cannot measure it.</p><a className="practice-link" href={officialLinks[3].href} target="_blank" rel="noreferrer">View public descriptors <ArrowRight size={14}/></a></aside></div>}
    <footer className="practice-resources"><p>Want full official practice materials?</p>{officialLinks.map(x => <a href={x.href} target="_blank" rel="noreferrer" key={x.href}>{x.label}</a>)}</footer>
  </section>;
}
