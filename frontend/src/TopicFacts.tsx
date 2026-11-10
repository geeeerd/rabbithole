import React, { useEffect, useRef, useState } from 'react';

type Fact = {
  id: string;
  label: string;
  value: string;
  kind: string;
  unit_id: string | null;
  unit_label: string | null;
  note: string | null;
  dates: string[];
  source_url: string;
  references_count: number;
};
type FactPage = { facts: Fact[]; total: number; next_offset: number | null; offline: boolean };

export function TopicFacts({ entityId }: { entityId: string }) {
  const [page, setPage] = useState<FactPage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  const lastOffset = useRef(0);

  useEffect(() => () => request.current?.abort(), []);

  async function load(offset: number) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    lastOffset.current = offset;
    setError('');
    setBusy(true);
    try {
      const response = await fetch(`/api/entities/${encodeURIComponent(entityId)}/facts?offset=${offset}`, { signal: controller.signal });
      const next = await response.json();
      if (!response.ok) throw new Error(typeof next.detail === 'string' ? next.detail : 'Recorded facts could not load.');
      if (!controller.signal.aborted) setPage(previous => {
        const incoming = next as FactPage;
        if (!offset || !previous) return incoming;
        return { ...incoming, offline: previous.offline || incoming.offline,
          facts: [...new Map([...previous.facts, ...incoming.facts].map(fact => [fact.id, fact])).values()] };
      });
    } catch (failure) {
      if (!controller.signal.aborted) setError((failure as Error).message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  return <details className="topic-background topic-facts" onToggle={event => {
    if (event.currentTarget.open && !page) void load(0);
    else if (!event.currentTarget.open) { request.current?.abort(); setBusy(false); }
  }}>
    <summary>See recorded facts</summary>
    {busy && <p role="status">Loading recorded facts…</p>}
    {error && <div><p role="alert">{error}</p><button onClick={() => void load(lastOffset.current)}>Retry facts</button></div>}
    {page && <>
      <p>{page.facts.length ? `${page.facts.length} of ${page.total} recorded facts${page.offline ? ' · includes saved records' : ''}` : 'No supported fact values are recorded for this topic.'}</p>
      <dl>{page.facts.map(fact => <div key={fact.id} className="fact-row">
        <dt>{fact.label}</dt>
        <dd>{fact.kind === 'website' ? <a href={fact.value} target="_blank" rel="noreferrer">{fact.value} ↗</a> : <strong>{fact.value}{(fact.unit_label || fact.unit_id) ? ` ${fact.unit_label ?? fact.unit_id}` : ''}</strong>}
          {fact.note && <span>{fact.note}</span>}{fact.dates.map(date => <span key={date}>{date}</span>)}
          <a className="fact-source" href={fact.source_url} target="_blank" rel="noreferrer">Statement ↗</a>
          <span>{fact.references_count ? `${fact.references_count} references recorded` : 'No supporting references recorded'}</span>
        </dd>
      </div>)}</dl>
      {page.next_offset != null && <button disabled={busy} onClick={() => void load(page.next_offset!)}>More facts</button>}
    </>}
  </details>;
}
