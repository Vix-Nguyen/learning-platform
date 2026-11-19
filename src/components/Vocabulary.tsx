import { useMemo, useState } from 'react';
import { BookOpen, Check, ChevronRight, Eye, Plus, Trash2, X } from 'lucide-react';
import { actions, useAppStore } from '../lib/store';
import { localDate } from '../lib/progress';
import './practice.css';

export function Vocabulary() {
  const { vocabulary } = useAppStore();
  const due = useMemo(() => vocabulary.filter(v => v.due <= localDate()), [vocabulary]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [word, setWord] = useState('');
  const [meaning, setMeaning] = useState('');
  const [example, setExample] = useState('');
  const current = due.length ? due[index % due.length] : undefined;
  function review(known: boolean) {
    if (!current) return;
    actions.reviewVocabulary(current.id, known);
    setIndex(i => i + 1); setRevealed(false);
  }
  function add(event: React.FormEvent) {
    event.preventDefault(); if (!word.trim() || !meaning.trim()) return;
    actions.addVocabulary({ word: word.trim(), meaning: meaning.trim(), example: example.trim() });
    setWord(''); setMeaning(''); setExample(''); setShowForm(false);
  }
  return <section className="practice-page vocab-page">
    <header className="page-heading"><div><h1>Vocabulary</h1></div><button className="btn btn-primary" onClick={() => setShowForm(v => !v)}><Plus size={17}/>{showForm ? 'Close form' : 'Add a word'}</button></header>
    <div className="vocab-summary"><span><BookOpen size={18}/> {vocabulary.length} saved words</span><span>{due.length} due today</span></div>
    {showForm && <form className="panel vocab-form" onSubmit={add}><div className="vocab-form-head"><h2>New vocabulary</h2><button type="button" className="icon-button" aria-label="Close form" onClick={() => setShowForm(false)}><X size={17}/></button></div><label>Word or phrase<input required value={word} onChange={e => setWord(e.target.value)} placeholder="e.g. in contrast" /></label><label>Vietnamese meaning<input required value={meaning} onChange={e => setMeaning(e.target.value)} placeholder="ngược lại" /></label><label>Example sentence <span className="muted">(optional)</span><textarea value={example} onChange={e => setExample(e.target.value)} rows={2} placeholder="Use it in a sentence you might write or say." /></label><button className="btn btn-primary" type="submit">Save word</button></form>}
    {current ? <div className="panel vocab-flashcard"><h2>{current.word}</h2>{revealed ? <div className="vocab-answer"><p className="vocab-meaning">{current.meaning}</p>{current.example && <blockquote>{current.example}</blockquote>}<p className="muted small">Mark how well you remembered it. “Again” keeps it due today.</p><div className="vocab-actions"><button className="btn btn-ghost" onClick={() => review(false)}><X size={16}/> Again</button><button className="btn btn-primary" onClick={() => review(true)}><Check size={16}/> I knew it</button></div></div> : <button className="btn btn-primary vocab-reveal" onClick={() => setRevealed(true)}><Eye size={17}/> Show meaning</button>}<div className="vocab-progress"><span style={{ width: `${Math.min(100, (index % Math.max(due.length, 1)) / Math.max(due.length, 1) * 100)}%` }}/></div></div> : <div className="empty-state"><BookOpen size={23}/><h2>All caught up</h2><p>No words are due right now. Add a word from your reading or writing, or come back tomorrow.</p><button className="btn btn-ghost" onClick={() => setShowForm(true)}>Add a word <ChevronRight size={16}/></button></div>}
    <div className="panel vocab-list"><div className="section-title"><div><h2>Your word bank</h2><p className="muted">Words stay here until you remove them.</p></div></div>{vocabulary.length ? <ul>{vocabulary.map(v => <li key={v.id}><div><strong>{v.word}</strong><span>{v.meaning}</span>{v.example && <small>{v.example}</small>}</div><button className="icon-button danger-icon" aria-label={`Remove ${v.word}`} onClick={() => actions.removeVocabulary(v.id)}><Trash2 size={16}/></button></li>)}</ul> : <p className="muted">Your saved vocabulary will appear here.</p>}</div>
  </section>;
}
export default Vocabulary;
