import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Filter, RotateCcw } from 'lucide-react';
import { actions, useAppStore } from '../lib/store';
import type { Skill } from '../types';
import './practice.css';

const labels: Record<Skill, string> = { foundations: 'Foundations', reading: 'Reading', listening: 'Listening', writing: 'Writing', speaking: 'Speaking' };
export function ErrorLog() {
  const { errors } = useAppStore();
  const [filter, setFilter] = useState<'all' | Skill>('all');
  const [showResolved, setShowResolved] = useState(false);
  const visible = useMemo(() => errors.filter(e => (filter === 'all' || e.skill === filter) && (showResolved || !e.resolved)).sort((a, b) => b.date.localeCompare(a.date)), [errors, filter, showResolved]);
  const openCount = errors.filter(e => !e.resolved).length;
  return <section className="practice-page error-page">
    <header className="page-heading"><div><h1>Error log</h1></div><span className="badge">{openCount} to review</span></header>
    <div className="error-toolbar panel"><label className="filter-label"><Filter size={16}/><span>Skill</span><select aria-label="Filter by skill" value={filter} onChange={e => setFilter(e.target.value as 'all' | Skill)}><option value="all">All skills</option>{Object.entries(labels).map(([key, name]) => <option value={key} key={key}>{name}</option>)}</select></label><label className="resolved-toggle"><input type="checkbox" checked={showResolved} onChange={e => setShowResolved(e.target.checked)}/> Include resolved</label></div>
    {visible.length ? <ul className="error-list">{visible.map(item => <li className={`panel error-item${item.resolved ? ' is-resolved' : ''}`} key={item.id}><div className="error-item-top"><span className="badge">{labels[item.skill]}</span><time dateTime={item.date}>{new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</time></div><h2>{item.question}</h2><div className="error-answer-grid"><div><span className="error-label">Your answer</span><p>{item.answer || 'No answer recorded'}</p></div><div><span className="error-label">Correct answer</span><p>{item.correct}</p></div></div><p className="error-explanation">{item.explanation}</p><button className="btn btn-ghost error-resolve" onClick={() => actions.resolveError(item.id)}>{item.resolved ? <><RotateCcw size={16}/> Reopen</> : <><CheckCircle2 size={16}/> Mark reviewed</>}</button></li>)}</ul> : <div className="empty-state"><Circle size={23}/><h2>{errors.length ? 'No mistakes match this filter' : 'Your error log is clear'}</h2><p>{errors.length ? 'Try another skill or include resolved items.' : 'Incorrect answers from practice drills will appear here with an explanation, once per attempt.'}</p></div>}
  </section>;
}
export default ErrorLog;
