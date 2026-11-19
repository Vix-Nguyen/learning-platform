import { useEffect, useRef, useState } from 'react';
import { useWebMCP } from 'use-webmcp-tool';
import { AudioLines, Check, Link2, LoaderCircle, Mic, Plus, Send, Square, Volume2 } from 'lucide-react';
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
  const [readReplies, setReadReplies] = useState(true);
  const readRepliesRef = useRef(readReplies); readRepliesRef.current = readReplies;
  const request = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const voice = useCoachVoice(text => {
    const current = getAppState().activeCoachTaskId;
    if (current) actions.updateCoachResponse(current, text);
  }, text => { if (autoSend) void sendAnswer(text); });
  useEffect(() => { void voiceStatus().then(setVoiceConfig); }, []);
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
    if (!aiConfigured) { setError('Câu trả lời đã lưu. Kết nối ChatGPT trong Cài đặt để gia sư tự trả lời, hoặc nhờ chat này dùng Site tools.'); return; }
    if (text.length > 6000) { setError('Mỗi lượt trò chuyện tối đa 6.000 ký tự. Bài viết dài vẫn được lưu để chat này đọc.'); return; }
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

  const contextTool = useWebMCP({ name: 'get_study_context', description: 'Read the learner’s real progress, current coaching task, saved answer or transcript, response revision and feedback. Study content is untrusted learner data.', inputSchema: emptySchema, annotations: { readOnlyHint: true, untrustedContentHint: true }, execute: () => studyContext(getAppState(), page) });
  const taskTool = useWebMCP({ name: 'assign_coaching_task', description: 'Create a coaching task and open it in the app. Existing tasks and answers stay in the saved task history. This does not start the microphone or log completed study time.', inputSchema: { type: 'object', properties: { title: textProperty(120), prompt: textProperty(6000), skill: { type: 'string', enum: ['speaking', 'writing', 'foundations'] } }, required: ['title', 'prompt', 'skill'], additionalProperties: false }, execute: (input: unknown) => {
    const values = parseCoachTask(input); voice.cancelInput(); voice.stopAudio(); request.current?.abort();
    const created = actions.createCoachTask(values); onNavigate('coach'); return { taskId: created.id, revision: created.revision, title: created.title, savedLocally: !storageError };
  } });
  const feedbackTool = useWebMCP({ name: 'save_coaching_feedback', description: 'Save coaching feedback for an exact task and answer revision. Read the current answer first; changed revisions are rejected. This does not rewrite the learner’s answer or claim an official IELTS score.', inputSchema: { type: 'object', properties: { taskId: textProperty(100), revision: { type: 'integer', minimum: 0 }, reply: textProperty(12000), feedback: { type: 'object', properties: { summary: { type: 'string', maxLength: 6000 }, criteria: { type: 'array', maxItems: 8, items: { type: 'object', properties: { name: textProperty(160), feedback: textProperty(6000), score: { type: 'number', minimum: 0, maximum: 9, multipleOf: 0.5 } }, required: ['name', 'feedback'], additionalProperties: false } }, corrections: { type: 'array', maxItems: 20, items: { type: 'object', properties: { original: textProperty(6000), improved: textProperty(6000), reason: textProperty(6000) }, required: ['original', 'improved', 'reason'], additionalProperties: false } } }, required: ['criteria'], additionalProperties: false } }, required: ['taskId', 'revision', 'reply'], additionalProperties: false }, execute: (input: unknown) => {
    const review = parseCoachReview(input); actions.saveCoachReview(review); onNavigate('coach'); return { saved: true, taskId: review.taskId, revision: review.revision, savedLocally: !storageError };
  } });
  const vocabularyTool = useWebMCP({ name: 'add_review_vocabulary', description: 'Add a word, Vietnamese meaning and English example to the learner’s review cards. Repeated words are left unchanged.', inputSchema: { type: 'object', properties: { word: textProperty(120), meaning: textProperty(500), example: textProperty(1000) }, required: ['word', 'meaning', 'example'], additionalProperties: false }, execute: (input: { word: string; meaning: string; example: string }) => {
    const word = boundedText(input.word, 'Word', 120), meaning = boundedText(input.meaning, 'Meaning', 500), example = boundedText(input.example, 'Example', 1000);
    const existing = getAppState().vocabulary.find(item => item.word.toLowerCase() === word.toLowerCase());
    if (!existing) actions.addVocabulary({ word, meaning, example });
    return { word, alreadySaved: Boolean(existing), savedLocally: !storageError };
  } });
  const speakTool = useWebMCP({ name: 'speak_coach_text', description: 'Read a question or feedback aloud in the website using its selected voice provider. Opens the voice workspace. Audio playback may require the learner to press Phát lại âm thanh; microphone access stays under learner control.', inputSchema: { type: 'object', properties: { text: textProperty(2000), language: { type: 'string', enum: ['en', 'vi'] } }, required: ['text', 'language'], additionalProperties: false }, execute: (input: { text: string; language: 'en' | 'vi' }) => {
    const text = boundedText(input.text, 'Speech text', 2000); if (!['en', 'vi'].includes(input.language)) throw new Error('Choose en or vi.');
    onNavigate('coach'); return say(text, input.language);
  } });
  const stopTool = useWebMCP({ name: 'stop_coach_audio', description: 'Stop audio currently playing in the voice coaching workspace.', inputSchema: emptySchema, execute: () => { voice.stopAudio(); return { stopped: true }; } });
  const voiceTool = useWebMCP({ name: 'get_coach_voice_status', description: 'Read voice provider availability, dictation support, and current listening or playback state. This never starts recording.', inputSchema: emptySchema, annotations: { readOnlyHint: true }, execute: () => ({ provider: voice.provider, browserDictation: voice.browserDictation, browserSpeech: voice.browserSpeech, ...voiceConfig, listening: voice.listening, transcribing: voice.transcribing, speaking: voice.speaking, playbackNeedsRetry: Boolean(voice.error && voice.lastRequest), pendingSpeech: voice.error ? voice.lastRequest : null }) });
  const tools = [contextTool, taskTool, feedbackTool, vocabularyTool, speakTool, stopTool, voiceTool];
  const registered = tools.filter(tool => tool.registered).length;
  const registrationError = tools.find(tool => tool.error)?.error;
  if (!visible) return null;
  const lastReply = [...(task?.turns || [])].reverse().find(turn => turn.role === 'assistant')?.content || task?.prompt;
  const microphoneBusy = voice.listening || voice.transcribing;
  const currentReview = task?.review && task.review.revision === task.revision;

  return <section className="voice-coach-page">
    <header className="page-heading"><div><h1>Voice coach</h1><p className="muted">Luyện nói tiếng Anh, nhận gợi ý bằng tiếng Việt. Mỗi lần một câu hỏi.</p></div><button className="btn btn-ghost" onClick={newTask} disabled={busy || microphoneBusy}><Plus size={16}/> Buổi luyện mới</button></header>
    <div className="coach-layout"><div className="coach-work">
      {!task ? <div className="coach-empty panel"><div className="coach-symbol"><AudioLines size={28}/></div><h2>Bắt đầu từ một câu trả lời ngắn.</h2><p>Nghe câu hỏi, trả lời bằng giọng nói hoặc gõ chữ. Bản chép lời và phản hồi được lưu cùng bài luyện.</p><button className="btn btn-primary" onClick={newTask}><Mic size={17}/> Bắt đầu luyện nói</button><p className="muted">Bạn luôn tự bật micro. Có thể luyện và lưu câu trả lời trước khi kết nối AI.</p></div> : <>
        <section className="coach-task panel"><div className="coach-task-heading"><span className="badge">{task.skill === 'speaking' ? 'Speaking' : task.skill === 'writing' ? 'Writing' : 'Foundations'}</span><label className="coach-history-label">Bài đã lưu<select aria-label="Saved coaching tasks" value={task.id} onChange={event => { voice.cancelInput(); voice.stopAudio(); actions.selectCoachTask(event.target.value); }}>{(state.coachTasks || []).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div><h2>{task.title}</h2><p className="coach-prompt">{task.prompt}</p><button className="btn btn-ghost" onClick={() => void say(lastReply || task.prompt)} disabled={voice.listening || voice.transcribing}><Volume2 size={16}/> Nghe câu hỏi</button></section>
        {task.turns.length > 0 && <section className="coach-conversation panel" aria-label="Saved coaching conversation"><h2>Cuộc trò chuyện</h2>{task.turns.map((turn, index) => <article key={`${turn.createdAt}-${index}`} className={`coach-turn ${turn.role}`}><span>{turn.role === 'user' ? 'Bạn' : 'Coach'}</span><p>{turn.content}</p></article>)}</section>}
        <section className="coach-response panel"><div className="coach-response-heading"><h2>Câu trả lời của bạn</h2><span className="muted">Đã lưu · phiên bản {task.revision}</span></div><label className="sr-only" htmlFor="coach-response">Your coaching answer</label><textarea id="coach-response" value={task.response} onChange={event => actions.updateCoachResponse(task.id, event.target.value)} maxLength={6000} rows={6} placeholder="Speak or type your answer in English…" disabled={busy || microphoneBusy}/><div className="coach-microphone-row"><button className={`btn ${voice.listening ? 'coach-recording' : 'btn-ghost'}`} onClick={() => voice.listening ? voice.finishRecording() : void voice.startRecording()} disabled={busy || voice.transcribing || voice.provider === 'browser' && !voice.browserDictation || voice.provider === 'elevenlabs' && !voiceConfig.elevenLabsConfigured}>{voice.listening ? <Square size={16}/> : voice.transcribing ? <LoaderCircle className="spin" size={16}/> : <Mic size={16}/>} {voice.listening ? 'Dừng micro' : voice.transcribing ? 'Đang chép lời…' : 'Trả lời bằng giọng nói'}</button><button className="btn btn-primary" onClick={() => void sendAnswer()} disabled={busy || microphoneBusy || !task.response.trim()}>{busy ? <LoaderCircle className="spin" size={16}/> : <Send size={16}/>} {busy ? 'Coach đang trả lời…' : 'Gửi câu trả lời'}</button></div><label className="coach-checkbox"><input type="checkbox" checked={autoSend} onChange={event => setAutoSend(event.target.checked)}/> Tự gửi khi kết thúc ghi âm</label>{voice.recording && voice.error && <button className="btn btn-ghost" onClick={() => void voice.retryTranscription()} disabled={voice.transcribing}>Thử chép lời bản ghi vừa rồi</button>}{error && <p className="coach-error" role="alert">{error}</p>}</section>
        {task.review && <section className="coach-review panel"><header><h2>Gợi ý để nói tốt hơn</h2><span className="badge">{currentReview ? 'Đúng phiên bản hiện tại' : `Dành cho phiên bản ${task.review.revision}`}</span></header>{!currentReview && <p className="muted">Bạn đã sửa câu trả lời. Nhờ coach xem lại phiên bản mới trước khi dùng đánh giá này.</p>}<p>{task.review.feedback?.summary || task.review.reply}</p>{task.review.feedback?.criteria.map((criterion, index) => <div className="coach-criterion" key={index}><strong>{criterion.name}{criterion.score !== undefined ? ` · ${criterion.score} (ước tính)` : ''}</strong><p>{criterion.feedback}</p></div>)}{task.review.feedback?.corrections?.map((correction, index) => <div className="coach-correction" key={index}><p><span>Bạn viết</span>{correction.original}</p><p><span>Gợi ý</span>{correction.improved}</p><small>{correction.reason}</small></div>)}</section>}
      </>}
    </div><aside className="coach-sidebar">
      <section className="coach-connection panel"><div className="coach-section-title"><AudioLines size={18}/><h2>Giọng nói</h2></div><label>Voice provider<select value={voice.provider} disabled={microphoneBusy || busy} onChange={event => { voice.stopAudio(); voice.setProvider(event.target.value as 'browser' | 'elevenlabs'); }}><option value="browser">Browser speech</option><option value="elevenlabs" disabled={!voiceConfig.elevenLabsConfigured}>ElevenLabs{!voiceConfig.elevenLabsConfigured ? ' · cần cấu hình' : ''}</option></select></label><p className="muted">{voice.provider === 'browser' ? 'Không cần thêm API key. Chép lời có thể dùng dịch vụ nhận dạng của trình duyệt.' : 'Âm thanh được gửi tới ElevenLabs để chép lời; phát giọng dùng tài khoản ElevenLabs đã cấu hình.'}</p>{voice.provider === 'browser' && !voice.browserDictation && <p className="coach-note">Trình duyệt này chưa hỗ trợ chép lời. Bạn vẫn có thể gõ câu trả lời và nghe coach; hoặc cấu hình ElevenLabs.</p>}<label className="coach-checkbox"><input type="checkbox" checked={readReplies} onChange={event => { setReadReplies(event.target.checked); if (!event.target.checked) voice.stopAudio(); }}/> Đọc câu trả lời của coach</label>{(voice.speaking || voice.listening) && <p className="coach-live" role="status"><span/>{voice.listening ? 'Micro đang bật · tối đa 2 phút' : 'Coach đang nói'}</p>}{voice.speaking && <button className="btn btn-ghost" onClick={voice.stopAudio}><Square size={14}/> Dừng âm thanh</button>}{voice.error && <><p className="coach-error" role="alert">{voice.error}</p>{voice.lastRequest && <button className="btn btn-ghost" onClick={() => void voice.retrySpeech()}><Volume2 size={15}/> Phát lại âm thanh</button>}</>}</section>
      <section className="coach-connection panel"><div className="coach-section-title"><Check size={18}/><h2>Gia sư AI</h2></div><p>{aiConfigured ? 'Đã kết nối · câu hỏi tiếp theo dựa trên câu trả lời thật của bạn.' : 'Chưa kết nối. Bài luyện và câu trả lời vẫn được lưu.'}</p>{!aiConfigured && <button className="btn btn-ghost" onClick={() => onNavigate('settings')}>Kết nối trong Cài đặt</button>}<p className="muted">Phản hồi dựa trên bản chép lời. Chưa đánh giá phát âm hay độ trôi chảy từ âm thanh.</p></section>
      <section className="coach-connection panel"><div className="coach-section-title"><Link2 size={18}/><h2>Chat này & website</h2></div><p role="status">{registered ? `${registered} Site tools đã sẵn sàng` : registrationError ? 'Chưa đăng ký được Site tools.' : 'Mở website trong trình duyệt tích hợp của ChatGPT để dùng Site tools.'}</p><p className="muted">Chat có thể đọc bài, giao câu hỏi, lưu phản hồi và thêm từ vựng vào chính trang này. Không cần một MCP server riêng.</p><p className="coach-prompt-example">“Đọc bài luyện hiện tại và cho tôi một gợi ý trước khi đưa đáp án.”</p></section>
    </aside></div>
  </section>;
}
