import { useEffect, useRef, useState } from 'react';
import { ArrowUp, BookOpen, Check, LoaderCircle, MessageCircle, Mic2, PenLine, X } from 'lucide-react';
import { mentorRequest } from '../lib/api';
import type { MentorMessage } from '../types';

const quick = [
  { label: 'Explain a grammar point', icon: BookOpen, prompt: 'Explain one useful grammar point for IELTS, with a short example.' },
  { label: 'Improve my writing', icon: PenLine, prompt: 'I would like feedback on a piece of IELTS writing.' },
  { label: 'Speaking practice', icon: Mic2, prompt: 'Give me one IELTS Speaking Part 2 prompt and help me practise.' },
];

export default function Mentor({ open, onClose, language, aiConfigured, initialPrompt = '', onPromptUsed }: { open: boolean; onClose: () => void; language: 'vi' | 'en'; aiConfigured: boolean; initialPrompt?: string; onPromptUsed?: () => void }) {
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const drawer = useRef<HTMLElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const beforeOpen = useRef<HTMLElement | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    beforeOpen.current = document.activeElement as HTMLElement;
    input.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'Tab' && drawer.current) {
        const els = [...drawer.current.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])')];
        if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === els.at(-1)) { e.preventDefault(); els[0]?.focus(); }
      }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); beforeOpen.current?.focus(); };
  }, [open, onClose]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages, busy]);
  useEffect(() => { if (open && initialPrompt) { setDraft(initialPrompt); onPromptUsed?.(); } }, [open, initialPrompt, onPromptUsed]);
  if (!open) return null;
  const send = async (value = draft) => {
    const content = value.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next); setDraft(''); setBusy(true); setError('');
    try {
      const result = await mentorRequest({ mode: 'chat', messages: next.slice(-10), language });
      setMessages(current => [...current, { role: 'assistant' as const, content: result.reply }].slice(-40));
    } catch (err) { setError(err instanceof Error ? err.message : 'The mentor could not respond. Please try again.'); }
    finally { setBusy(false); input.current?.focus(); }
  };
  return <div className="drawer-layer" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <aside className="mentor-drawer" role="dialog" aria-modal="true" aria-labelledby="mentor-title" ref={drawer}>
      <header className="mentor-header"><div className="mentor-title-icon"><MessageCircle size={19} /></div><div><h2 id="mentor-title">Study mentor</h2><p>{aiConfigured ? 'Here to help you make the next step' : 'AI mentor is not connected yet'}</p></div><button className="icon-button" onClick={onClose} aria-label="Close mentor"><X size={19} /></button></header>
      <div className="mentor-conversation" aria-live="polite">
        {!messages.length ? <div className="mentor-welcome"><div className="mentor-welcome-mark"><MessageCircle size={24} /></div><h3>A thoughtful study partner</h3><p>Ask about IELTS, share a sentence, or practise explaining an idea. {language === 'vi' ? 'Phần giải thích sẽ ưu tiên tiếng Việt.' : 'I’ll answer in English.'}</p>
          {quick.map(q => <button key={q.label} className="quick-prompt" onClick={() => setDraft(q.prompt)}><q.icon size={17} /><span>{q.label}</span><ArrowUp size={15} /></button>)}
        </div> : messages.map((m, i) => <div key={i} className={`mentor-message ${m.role}`}><span className="message-role">{m.role === 'user' ? 'You' : 'Mentor'}</span><p>{m.content}</p></div>)}
        {busy && <div className="mentor-thinking"><LoaderCircle className="spin" size={16} /> Thinking through your question…</div>}
        {error && <div className="mentor-error" role="alert"><span>{error}</span><button onClick={() => send(messages.at(-1)?.content || '')}>Try again</button></div>}
        <div ref={end} />
      </div>
      <form className="mentor-compose" onSubmit={e => { e.preventDefault(); void send(); }}>
        {!aiConfigured && <p className="mentor-notice">The optional AI server isn’t configured. Your message won’t be sent until it is available.</p>}
        <div className="mentor-input-wrap"><textarea ref={input} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); } }} placeholder="Ask a study question…" rows={2} maxLength={4000} aria-label="Message your study mentor" disabled={!aiConfigured || busy} /><button aria-label="Send message" type="submit" className="send-button" disabled={!draft.trim() || busy || !aiConfigured}><ArrowUp size={18} /></button></div>
        <span className="mentor-footnote"><Check size={13} /> AI feedback is a learning aid, not an official IELTS score.</span>
      </form>
    </aside>
  </div>;
}
