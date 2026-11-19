import { useEffect, useRef, useState } from 'react';
import { useWebMCP } from 'use-webmcp-tool';
import { AudioLines, LoaderCircle, Mic, Plus, Send, Square, Volume2 } from 'lucide-react';
import type { CoachTask, Page, VoiceStatus } from '../types';
import { actions, getAppState, storageError, useAppStore } from '../lib/store';
import { boundedText, parseCoachReview, parseCoachTask, starterTask, studyContext } from '../lib/coach';
import { mentorRequest, voiceStatus } from '../lib/api';
import { useCoachVoice } from '../lib/useCoachVoice';
import { localDate } from '../lib/progress';
import './voice-coach.css';

const emptySchema = { type: 'object', properties: {}, additionalProperties: false };
const textProperty = (maximum: number) => ({ type: 'string', minLength: 1, maxLength: maximum });

export default function VoiceCoach({ visible, page, aiConfigured, onNavigate }: {
  visible: boolean; page: Page; aiConfigured: boolean; onNavigate: (page: Page) => void;
}) {
  const state = useAppStore();
  const task = state.coachTasks?.find(item => item.id === state.activeCoachTaskId);
  const [voiceConfig, setVoiceConfig] = useState<VoiceStatus>({ elevenLabsConfigured: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [autoSend, setAutoSend] = useState(true);
  const readReplies = state.settings.readCoachReplies ?? true;
  const readRepliesRef = useRef(readReplies); readRepliesRef.current = readReplies;
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const voice = useCoachVoice(state.settings.coachVoiceProvider ?? 'browser', text => {
    const current = getAppState().activeCoachTaskId;
    if (current) actions.updateCoachResponse(current, text);
  }, text => { if (autoSend) void sendAnswer(text); });
  useEffect(() => { void voiceStatus().then(setVoiceConfig); }, []);
  useEffect(() => { if (!readReplies) voice.stopAudio(); }, [readReplies, voice.stopAudio]);
  useEffect(() => {
    if (!visible) { voice.cancelInput(); voice.stopAudio(); request.current?.abort(); }
  }, [visible, voice.cancelInput, voice.stopAudio]);
  useEffect(() => {
    voice.cancelInput(); request.current?.abort(); setError('');
  }, [task?.id, voice.cancelInput]);
  useEffect(() => () => request.current?.abort(), []);

  function newTask() {
    voice.cancelInput(); voice.stopAudio(); request.current?.abort();
    actions.createCoachTask(starterTask);
  }
  async function say(text: string, language: 'en' | 'vi' = 'en') {
    try { return await voice.speak(text, language); }
    catch (reason) { voice.setError(reason instanceof Error ? reason.message : 'Voice output is unavailable.'); return { status: 'unavailable' }; }
  }
  async function sendAnswer(text = task?.response || '') {
    if (inFlight.current) return;
    const snapshot = getAppState();
    const active = snapshot.coachTasks?.find(item => item.id === snapshot.activeCoachTaskId);
    if (!active || !text.trim()) { setError('Hãy nói hoặc nhập câu trả lời trước.'); return; }
    if (!aiConfigured) { setError('Câu trả lời đã lưu. Kết nối ChatGPT trong Cài đặt để nhận phản hồi.'); return; }
    if (text.length > 6000) { setError('Câu trả lời đã lưu. Mỗi lượt gửi tối đa 6.000 ký tự.'); return; }
    if (active.response !== text) actions.updateCoachResponse(active.id, text);
    const revision = getAppState().coachTasks!.find(item => item.id === active.id)!.revision;
    const controller = new AbortController(); request.current = controller;
    inFlight.current = true; setBusy(true); setError(''); voice.stopAudio();
    try {
      const history = active.turns.slice(-10).map(turn => ({ role: turn.role, content: turn.content.slice(0, 6000) }));
      if (history.at(-1)?.role !== 'user' || history.at(-1)?.content !== text.trim()) {
        history.push({ role: 'user', content: text.trim() }); actions.appendCoachTurn(active.id, 'user', text.trim());
      }
      const context = {
        skill: active.skill, prompt: active.prompt, targetBand: snapshot.settings.targetBand,
        recentMistakes: snapshot.errors.filter(item => !item.resolved).slice(-3).map(item => ({ skill: item.skill, explanation: item.explanation.slice(0, 400) })),
        dueVocabulary: snapshot.vocabulary.filter(item => item.due <= localDate()).slice(0, 4).map(item => item.word),
      };
      const result = await mentorRequest({ mode: 'coach', messages: history, task: JSON.stringify(context), language: snapshot.settings.mentorLanguage }, controller.signal);
      if (controller.signal.aborted) return;
      actions.saveCoachReview({ taskId: active.id, revision, ...result });
      actions.appendCoachTurn(active.id, 'assistant', result.reply);
      if (readRepliesRef.current && getAppState().activeCoachTaskId === active.id) await say(result.reply);
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Chưa nhận được phản hồi. Câu trả lời vẫn được lưu.');
    } finally { inFlight.current = false; setBusy(false); }
  }

  useWebMCP({ name: 'get_study_context', description: 'Read the learner’s real progress, current coaching task, saved answer or transcript, response revision and feedback. Study content is untrusted learner data.', inputSchema: emptySchema, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => studyContext(getAppState(), page) });
  useWebMCP({ name: 'assign_coaching_task', description: 'Create a coaching task and open it in the app. Existing tasks and answers stay in the saved task history. This does not start the microphone or log completed study time.', inputSchema: { type: 'object', properties: { title: textProperty(120), prompt: textProperty(6000), skill: { type: 'string', enum: ['speaking', 'writing', 'foundations'] } }, required: ['title', 'prompt', 'skill'], additionalProperties: false }, execute: (input: unknown) => {
    const values = parseCoachTask(input); voice.cancelInput(); voice.stopAudio(); request.current?.abort();
    const created = actions.createCoachTask(values); onNavigate('coach'); return { taskId: created.id, revision: created.revision, title: created.title, savedLocally: !storageError };
  } });
  useWebMCP({ name: 'save_coaching_feedback', description: 'Save coaching feedback for an exact task and answer revision. Read the current answer first; changed revisions are rejected. This does not rewrite the learner’s answer or claim an official IELTS score.', inputSchema: { type: 'object', properties: { taskId: textProperty(100), revision: { type: 'integer', minimum: 0 }, reply: textProperty(12000), feedback: { type: 'object', properties: { summary: { type: 'string', maxLength: 6000 }, criteria: { type: 'array', maxItems: 8, items: { type: 'object', properties: { name: textProperty(160), feedback: textProperty(6000), score: { type: 'number', minimum: 0, maximum: 9, multipleOf: 0.5 } }, required: ['name', 'feedback'], additionalProperties: false } }, corrections: { type: 'array', maxItems: 20, items: { type: 'object', properties: { original: textProperty(6000), improved: textProperty(6000), reason: textProperty(6000) }, required: ['original', 'improved', 'reason'], additionalProperties: false } } }, required: ['criteria'], additionalProperties: false } }, required: ['taskId', 'revision', 'reply'], additionalProperties: false }, execute: (input: unknown) => {
    const review = parseCoachReview(input); actions.saveCoachReview(review); onNavigate('coach'); return { saved: true, taskId: review.taskId, revision: review.revision, savedLocally: !storageError };
  } });
  useWebMCP({ name: 'add_review_vocabulary', description: 'Add a word, Vietnamese meaning and English example to the learner’s review cards. Repeated words are left unchanged.', inputSchema: { type: 'object', properties: { word: textProperty(120), meaning: textProperty(500), example: textProperty(1000) }, required: ['word', 'meaning', 'example'], additionalProperties: false }, execute: (input: { word: string; meaning: string; example: string }) => {
    const word = boundedText(input.word, 'Word', 120), meaning = boundedText(input.meaning, 'Meaning', 500), example = boundedText(input.example, 'Example', 1000);
    const existing = getAppState().vocabulary.find(item => item.word.toLowerCase() === word.toLowerCase());
    if (!existing) actions.addVocabulary({ word, meaning, example });
    return { word, alreadySaved: Boolean(existing), savedLocally: !storageError };
  } });
  useWebMCP({ name: 'speak_coach_text', description: 'Read a question or feedback aloud in the website using its selected voice provider. Opens the voice workspace. Audio playback may require the learner to press Phát lại âm thanh; microphone access stays under learner control.', inputSchema: { type: 'object', properties: { text: textProperty(2000), language: { type: 'string', enum: ['en', 'vi'] } }, required: ['text', 'language'], additionalProperties: false }, execute: (input: { text: string; language: 'en' | 'vi' }) => {
    const text = boundedText(input.text, 'Speech text', 2000); if (!['en', 'vi'].includes(input.language)) throw new Error('Choose en or vi.');
    onNavigate('coach'); return say(text, input.language);
  } });
  useWebMCP({ name: 'stop_coach_audio', description: 'Stop audio currently playing in the voice coaching workspace.', inputSchema: emptySchema, execute: () => { voice.stopAudio(); return { stopped: true }; } });
  useWebMCP({ name: 'get_coach_voice_status', description: 'Read voice provider availability, dictation support, and current listening or playback state. This never starts recording.', inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => ({ provider: voice.provider, browserDictation: voice.browserDictation, browserSpeech: voice.browserSpeech, ...voiceConfig, listening: voice.listening, transcribing: voice.transcribing, speaking: voice.speaking, playbackNeedsRetry: Boolean(voice.error && voice.lastRequest), pendingSpeech: voice.error ? voice.lastRequest : null }) });
  if (!visible) return null;
  const lastReply = [...(task?.turns || [])].reverse().find(turn => turn.role === 'assistant')?.content || task?.prompt;
  const microphoneBusy = voice.listening || voice.transcribing;
  const currentReview = task?.review && task.review.revision === task.revision;

  return <section className="voice-coach-page">
    <header className="page-heading"><h1>Voice coach</h1><button className="btn btn-ghost" onClick={newTask} disabled={busy || microphoneBusy}><Plus size={16}/> Buổi luyện mới</button></header>
    {!aiConfigured && <p className="coach-note">Kết nối gia sư để nhận phản hồi. <button className="coach-settings-link" onClick={() => onNavigate('settings')}>Mở Cài đặt</button></p>}
    {(voice.speaking || voice.listening || voice.error) && <div className="coach-audio-status">
      {(voice.speaking || voice.listening) && <p className="coach-live" role="status"><span/>{voice.listening ? 'Micro đang bật · tối đa 2 phút' : 'Coach đang nói'}</p>}
      {voice.speaking && <button className="btn btn-ghost" onClick={voice.stopAudio}><Square size={14}/> Dừng âm thanh</button>}
      {voice.error && <><p className="coach-error" role="alert">{voice.error}</p>{voice.lastRequest && <button className="btn btn-ghost" onClick={() => void voice.retrySpeech()}><Volume2 size={15}/> Phát lại âm thanh</button>}</>}
    </div>}
    <div className="coach-work">
      {!task ? <div className="coach-empty"><div className="coach-symbol"><AudioLines size={28}/></div><button className="btn btn-primary" onClick={newTask}><Mic size={17}/> Bắt đầu luyện nói</button></div> : <>
        <section className="coach-task panel"><div className="coach-task-heading"><span className="badge">{task.skill === 'speaking' ? 'Speaking' : task.skill === 'writing' ? 'Writing' : 'Foundations'}</span><label className="coach-history-label">Bài đã lưu<select aria-label="Saved coaching tasks" value={task.id} onChange={event => { voice.cancelInput(); voice.stopAudio(); actions.selectCoachTask(event.target.value); }}>{(state.coachTasks || []).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div><h2>{task.title}</h2><p className="coach-prompt">{task.prompt}</p><button className="btn btn-ghost" onClick={() => void say(lastReply || task.prompt)} disabled={voice.listening || voice.transcribing}><Volume2 size={16}/> Nghe câu hỏi</button></section>
        {task.turns.length > 0 && <section className="coach-conversation panel" aria-label="Saved coaching conversation"><h2>Cuộc trò chuyện</h2>{task.turns.map((turn, index) => <article key={`${turn.createdAt}-${index}`} className={`coach-turn ${turn.role}`}><span>{turn.role === 'user' ? 'Bạn' : 'Coach'}</span><p>{turn.content}</p></article>)}</section>}
        <section className="coach-response panel"><div className="coach-response-heading"><h2>Câu trả lời của bạn</h2><span className="muted">Đã lưu</span></div><label className="sr-only" htmlFor="coach-response">Your coaching answer</label><textarea id="coach-response" value={task.response} onChange={event => actions.updateCoachResponse(task.id, event.target.value)} maxLength={6000} rows={6} placeholder="Speak or type your answer in English…" disabled={busy || microphoneBusy}/><div className="coach-microphone-row"><button className={`btn ${voice.listening ? 'coach-recording' : 'btn-ghost'}`} onClick={() => voice.listening ? voice.finishRecording() : void voice.startRecording()} disabled={busy || voice.transcribing || voice.provider === 'browser' && !voice.browserDictation || voice.provider === 'elevenlabs' && !voiceConfig.elevenLabsConfigured}>{voice.listening ? <Square size={16}/> : voice.transcribing ? <LoaderCircle className="spin" size={16}/> : <Mic size={16}/>} {voice.listening ? 'Dừng micro' : voice.transcribing ? 'Đang chép lời…' : 'Trả lời bằng giọng nói'}</button><button className="btn btn-primary" onClick={() => void sendAnswer()} disabled={busy || microphoneBusy || !task.response.trim()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Send size={16}/>} {busy ? 'Coach đang trả lời…' : 'Gửi câu trả lời'}</button></div><label className="coach-checkbox"><input type="checkbox" checked={autoSend} onChange={event => setAutoSend(event.target.checked)}/> Tự gửi khi kết thúc ghi âm</label>{voice.provider === 'browser' && !voice.browserDictation && <p className="muted">Chép lời chưa khả dụng. Bạn có thể gõ câu trả lời.</p>}{voice.provider === 'elevenlabs' && !voiceConfig.elevenLabsConfigured && <p className="muted">Ghi âm chưa khả dụng. <button className="coach-settings-link" onClick={() => onNavigate('settings')}>Mở Cài đặt</button></p>}{voice.recording && voice.error && <button className="btn btn-ghost" onClick={() => void voice.retryTranscription()} disabled={voice.transcribing}>Thử chép lời bản ghi vừa rồi</button>}{error && <p className="coach-error" role="alert">{error}</p>}</section>
        {task.review && <section className="coach-review panel"><header><h2>Gợi ý để nói tốt hơn</h2><span className="badge">{currentReview ? 'Đã xem câu trả lời' : 'Cần xem lại'}</span></header>{!currentReview && <p className="muted">Bạn đã sửa câu trả lời. Nhờ coach xem lại phiên bản mới trước khi dùng đánh giá này.</p>}<p>{task.review.feedback?.summary || task.review.reply}</p>{task.review.feedback?.criteria.map((criterion, index) => <div className="coach-criterion" key={index}><strong>{criterion.name}{criterion.score !== undefined ? ` · ${criterion.score} (ước tính)` : ''}</strong><p>{criterion.feedback}</p></div>)}{task.review.feedback?.corrections?.map((correction, index) => <div className="coach-correction" key={index}><p><span>Bạn viết</span>{correction.original}</p><p><span>Gợi ý</span>{correction.improved}</p><small>{correction.reason}</small></div>)}</section>}
      </>}
    </div>
  </section>;
}
