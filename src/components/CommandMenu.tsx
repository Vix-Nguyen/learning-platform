import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Dumbbell, House, Search, Settings2, SpellCheck, X } from 'lucide-react';
import type { Page } from '../types';

const items: { page: Page; label: string; icon: typeof House }[] = [
  { page: 'dashboard', label: 'Overview', icon: House }, { page: 'planner', label: 'Study plan', icon: CalendarDays },
  { page: 'practice', label: 'Practice hub', icon: Dumbbell }, { page: 'vocabulary', label: 'Vocabulary', icon: SpellCheck },
  { page: 'errors', label: 'Error log', icon: BookOpen }, { page: 'settings', label: 'Settings', icon: Settings2 },
];

export default function CommandMenu({ open, onClose, onNavigate }: { open: boolean; onClose: () => void; onNavigate: (page: Page) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => items.filter(i => i.label.toLowerCase().includes(query.toLowerCase().trim())), [query]);
  useEffect(() => {
    if (!open) return;
    const prior = document.activeElement as HTMLElement | null;
    setQuery(''); search.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>('.command-item') || [])];
        if (buttons.length) { e.preventDefault(); const active = document.activeElement; const at = buttons.indexOf(active as HTMLButtonElement); if (active === search.current) buttons[e.key === 'ArrowDown' ? 0 : buttons.length - 1].focus(); else { const delta = e.key === 'ArrowDown' ? 1 : -1; buttons[(at + delta + buttons.length) % buttons.length].focus(); } }
      }
      if (e.key === 'Tab' && ref.current) {
        const els = [...ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')];
        if (!els.length) return;
        if (e.shiftKey && document.activeElement === els[0]) { e.preventDefault(); els.at(-1)?.focus(); }
        else if (!e.shiftKey && document.activeElement === els.at(-1)) { e.preventDefault(); els[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); prior?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return <div className="command-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
    <section className="command-menu" role="dialog" aria-modal="true" aria-label="Navigate FluentPath" ref={ref}>
      <div className="command-search"><Search size={18} /><input ref={search} value={query} onChange={e => setQuery(e.target.value)} aria-label="Search pages" placeholder="Where would you like to go?" onKeyDown={e => {
        if (e.key === 'Enter' && filtered[0]) { e.preventDefault(); onNavigate(filtered[0].page); onClose(); }
      }} /><button className="icon-button" onClick={onClose} aria-label="Close navigation"><X size={18} /></button></div>
      <p className="command-label">GO TO</p>
      {filtered.map(({ page, label, icon: Icon }) => <button key={page} className="command-item" onClick={() => { onNavigate(page); onClose(); }}><Icon size={18} /><span>{label}</span><ArrowRight size={15} className="command-arrow" /></button>)}
      {!filtered.length && <p className="command-empty">No pages match “{query}”.</p>}
      <div className="command-hint"><kbd>↑</kbd><kbd>↓</kbd> to move <kbd>↵</kbd> to open <kbd>esc</kbd> to close</div>
    </section>
  </div>;
}
