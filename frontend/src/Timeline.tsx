import React, { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarDays } from 'lucide-react';

import type { Entity } from './exploration';
import { SearchBox } from './SearchBox';

type Milestone = {
  id: string;
  label: string;
  date: { label: string; precision: string; calendar: string; raw: string; uncertain: boolean };
  statement_id: string;
  property_id: string;
  source_url: string;
  references_count: number;
  related_id: string | null;
  related_label: string | null;
  relationship: string | null;
};
type TimelineData = { subject: Entity; entries: Milestone[]; offline: boolean; truncated: boolean };
type Selection = { entity: string | null; saved: boolean };

function readSelection(): Selection {
  const params = new URLSearchParams(location.search);
  return { entity: params.get('entity'), saved: params.get('saved') === '1' };
}

const examples = [
  ['Q7251', 'Alan Turing'], ['Q7259', 'Ada Lovelace'], ['Q7186', 'Marie Curie'],
];

export function Timeline() {
  const [selection, setSelection] = useState(readSelection);
  const [data, setData] = useState<TimelineData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const onPop = () => setSelection(readSelection());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    setData(null);
    setError('');
    if (!selection.entity) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const id = encodeURIComponent(selection.entity);
    const endpoint = `/api/entities/${id}/timeline${selection.saved ? '?offline=true' : ''}`;
    void fetch(endpoint, { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'This timeline could not load.');
      if (!controller.signal.aborted) setData(result);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure.message);
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [selection.entity, selection.saved, attempt]);

  function open(next: Selection) {
    const params = new URLSearchParams();
    if (next.entity) params.set('entity', next.entity);
    if (next.saved) params.set('saved', '1');
    history.pushState({}, '', '/timeline' + (params.size ? '?' + params : ''));
    setFilter('all');
    setSelection(next);
  }

  const entries = data?.entries.filter(entry => filter === 'all' || (filter === 'related' ? entry.related_id : !entry.related_id)) ?? [];

  return <section className="timeline-page">
    <div className="storyintro">
      <div className="eyebrow">TIMEATLAS · TIMELINE</div>
      <h1>Follow a topic through time.</h1>
      <p>Explore dates recorded for people, works, places, and the relationships that connect them.</p>
    </div>
    <SearchBox label="Search for a timeline topic" placeholder="Find a topic in time…" onSelect={entity => open({ ...selection, entity })}/>
    <div className="suggestions">
      TRY A TIMELINE {examples.map(([id, label]) => <button key={id} onClick={() => open({ ...selection, entity: id })}>{label} ↗</button>)}
    </div>
    <label className="timeline-source">
      <input type="checkbox" checked={selection.saved} onChange={event => open({ ...selection, saved: event.target.checked })}/>
      Use saved records
    </label>
    {busy && <p role="status" className="gamestatus">Finding recorded dates…</p>}
    {error && <div className="gameerror" role="alert"><p>{error}</p><button onClick={() => setAttempt(attempt + 1)}>Retry</button></div>}
    {data && <div className="timeline-result">
      <div className="timeline-top">
        <div>
          <div className="eyebrow">{data.offline ? 'SAVED WIKIDATA RECORDS' : 'WIKIDATA STATEMENTS'}</div>
          <h2>{data.subject.label}</h2>
          <p>{data.subject.description}</p>
        </div>
        <a href={'/?entity=' + data.subject.id}>Open connection graph <ArrowUpRight size={16}/></a>
      </div>
      {data.entries.length > 0 && <label className="timeline-filter">Show dates<select value={filter} onChange={event => setFilter(event.target.value)}>
        <option value="all">All recorded dates</option><option value="direct">Topic dates</option><option value="related">Relationship dates</option>
      </select></label>}
      {!entries.length && <p className="timeline-empty"><CalendarDays size={20}/>{data.entries.length ? 'No recorded dates match this filter.' : 'No supported dates are recorded for this topic.'}</p>}
      <ol className="milestones">{entries.map(entry => <li key={entry.id}>
        <div className="milestone-date"><strong>{entry.date.label}</strong><span>{entry.date.calendar} · {entry.date.precision} precision</span>{entry.date.uncertain && <span className="uncertain">Date has qualifiers or uncertainty</span>}</div>
        <div className="milestone-fact"><h3>{entry.label}{entry.relationship ? ` of ${entry.relationship}` : ''}</h3>
          {entry.related_id && <a href={'/?entity=' + entry.related_id}>{entry.related_label ?? entry.related_id} <ArrowUpRight size={14}/></a>}
          <details><summary>Statement and date details</summary>
            <p>{entry.references_count ? `${entry.references_count} reference(s) on the ${entry.related_id ? 'parent ' : ''}statement.` : 'No supporting references recorded on this statement.'}</p>
            <p>Recorded value <code>{entry.date.raw}</code></p>
            <p>Statement <code>{entry.statement_id}</code></p>
            <a href={entry.source_url} target="_blank" rel="noreferrer">Inspect Wikidata statement ↗</a>
          </details>
        </div>
      </li>)}</ol>
      <p className="timeline-note">Dates are ordered by their recorded values. Julian and Gregorian dates retain their source calendar. {data.truncated && 'This timeline shows up to 40 recorded dates.'}</p>
    </div>}
  </section>;
}
