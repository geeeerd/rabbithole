import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import type { Entity } from './exploration';

export function SearchBox({ onSelect, placeholder = 'Start with anything…', label = 'Search Wikidata topics' }: { onSelect: (id: string) => void; placeholder?: string; label?: string }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Entity[]>([]);
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const statusId = useId();
  useEffect(() => {
    setResults([]); setActive(-1); setFailed(false);
    if (query.trim().length < 2) { setStatus(''); setOpen(false); return; }
    const controller = new AbortController();
    setStatus('Searching…');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch('/api/search?q=' + encodeURIComponent(query.trim()), { signal: controller.signal });
        if (!response.ok) {
          if (response.status === 429) throw new Error('Search is busy. Wait a moment, then retry.');
          throw new Error('Search is temporarily unavailable. Retry or choose a featured topic.');
        }
        const data = await response.json();
        if (controller.signal.aborted) return;
        setResults(data.results); setOpen(document.activeElement === input.current);
        setStatus(data.results.length ? `${data.results.length} topics found.${data.offline ? ' Searching the offline collection.' : ''} Use arrow keys to choose.` : 'No topics found. Try another name.');
      } catch (e) {
        if (controller.signal.aborted) return;
        setStatus(e instanceof Error && e.message.startsWith('Search is')
          ? e.message
          : 'Search is temporarily unavailable. Retry or choose a featured topic.');
        setFailed(true);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, attempt]);

  function choose(entity: Entity) {
    setQuery(''); setResults([]); setOpen(false); setStatus(''); onSelect(entity.id);
  }
  return <div className="searchbox"><div className="searchwrap"><Search size={20} aria-hidden="true"/><input ref={input} id="search" role="combobox" aria-autocomplete="list" aria-expanded={open && results.length > 0} aria-controls={listId} aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined} aria-describedby={statusId} aria-label={label} placeholder={placeholder} maxLength={100} autoComplete="off" value={query} onFocus={() => { if (results.length) setOpen(true); }} onBlur={() => setOpen(false)} onChange={e => { setQuery(e.target.value); setResults([]); setActive(-1); }} onKeyDown={e => {
    if (e.key === 'Escape') { setOpen(false); setActive(-1); return; }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && results.length) {
      e.preventDefault(); setOpen(true);
      setActive(index => e.key === 'ArrowDown' ? (index + 1) % results.length : index < 1 ? results.length - 1 : index - 1);
    }
    if (e.key === 'Enter' && open && results.length) { e.preventDefault(); choose(results[active < 0 ? 0 : active]); }
  }}/><kbd aria-hidden="true">↵</kbd>{open && results.length > 0 && <ul id={listId} className="results" role="listbox" aria-label="Matching topics">{results.map((entity, index) => <li id={`${listId}-${index}`} role="option" aria-selected={active === index} key={entity.id} onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(entity)}><strong>{entity.label}</strong><small>{entity.description}</small><ArrowUpRight size={16} aria-hidden="true"/></li>)}</ul>}</div><div id={statusId} className="searchstatus" role="status" aria-live="polite">{status}{failed && <button onClick={() => setAttempt(attempt + 1)}>Retry search</button>}</div></div>;
}
