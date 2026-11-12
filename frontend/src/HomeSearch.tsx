import { useState } from 'react';
import type { Entity } from './exploration';
import { SearchBox } from './SearchBox';

export function HomeSearch({ busy, onExplore, onConnect }: {
  busy: boolean;
  onExplore: (id: string) => void;
  onConnect: (start: string, target: Entity) => void;
}) {
  const [connecting, setConnecting] = useState(false);
  const [start, setStart] = useState<Entity>();
  const [target, setTarget] = useState<Entity>();
  const sameTopic = !!start && start.id === target?.id;

  return <div className="home-search">
    <div className="home-search-modes" role="group" aria-label="Search mode">
      <button type="button" aria-pressed={!connecting} disabled={busy} onClick={() => setConnecting(false)}>Explore one topic</button>
      <button type="button" aria-pressed={connecting} disabled={busy} onClick={() => setConnecting(true)}>Connect two topics</button>
    </div>
    {connecting ? <>
      <div className="home-search-pair">
        <div>
          <label htmlFor="search">Starting topic</label>
          <SearchBox key="start" label="Starting topic" placeholder="Choose a starting topic…"
            disabled={busy} onSelect={(_, topic) => setStart(topic)}/>
          {start && <span className="home-search-choice">{start.label}</span>}
        </div>
        <div>
          <label htmlFor="home-destination">Destination topic</label>
          <SearchBox inputId="home-destination" label="Destination topic" placeholder="Choose a destination…"
            disabled={busy} onSelect={(_, topic) => setTarget(topic)}/>
          {target && <span className="home-search-choice">{target.label}</span>}
        </div>
      </div>
      {sameTopic && <p role="status">Choose two different topics.</p>}
      <button className="primary home-search-submit" type="button" disabled={busy || !start || !target || sameTopic}
        onClick={() => { if (start && target && !sameTopic) onConnect(start.id, target); }}>Find a connection</button>
    </> : <SearchBox key="single" disabled={busy} onSelect={id => onExplore(id)}/>}
  </div>;
}
