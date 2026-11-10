import React, { useEffect, useState } from 'react';
import { ArrowUpRight, Focus, MapPin } from 'lucide-react';

import type { Edge, Entity } from './exploration';
import { SearchBox } from './SearchBox';

type Place = {
  entity: Entity;
  coordinate: { latitude: number; longitude: number; precision: number | null; source_url: string; statement_id: string; references_count: number };
  relationships: Edge[];
  relationship_dates?: Record<string, string[]>;
};
type MapData = { subject: Entity; points: Place[]; offline: boolean; missing_count: number; truncated: boolean };
type Selection = { entity: string | null; saved: boolean };

const examples = [['Q7251', 'Alan Turing'], ['Q7186', 'Marie Curie'], ['Q90', 'Paris']];
const WORLD = '0 0 900 450';

function readSelection(): Selection {
  const params = new URLSearchParams(location.search);
  return { entity: params.get('entity'), saved: params.get('saved') === '1' };
}

function project(place: Place) {
  return { x: (place.coordinate.longitude + 180) * 2.5, y: (90 - place.coordinate.latitude) * 2.5 };
}

function focusedView(place: Place): string {
  const { x, y } = project(place);
  return `${Math.max(0, Math.min(700, x - 100))} ${Math.max(0, Math.min(350, y - 50))} 200 100`;
}

export function PlaceMap() {
  const [selection, setSelection] = useState(readSelection);
  const [data, setData] = useState<MapData | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const onPop = () => setSelection(readSelection());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    setData(null);
    setActiveId(null);
    setFocused(false);
    setError('');
    if (!selection.entity) {
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    const path = `/api/entities/${encodeURIComponent(selection.entity)}/places${selection.saved ? '?offline=true' : ''}`;
    void fetch(path, { signal: controller.signal }).then(async response => {
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'The map could not load this topic.');
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
    history.pushState({}, '', '/map' + (params.size ? '?' + params : ''));
    setSelection(next);
  }

  const active = data?.points.find(place => place.entity.id === activeId) ?? data?.points[0];
  const viewBox = focused && active ? focusedView(active) : WORLD;

  return <section className="timeline-page map-page">
    <div className="storyintro">
      <div className="eyebrow">TIMEATLAS · MAP</div>
      <h1>See where the story happened.</h1>
      <p>Find mapped places connected to a topic, including birthplaces, institutions and locations named in Wikidata.</p>
    </div>
    <SearchBox label="Search for a map topic" placeholder="Find a topic on the map…" onSelect={entity => open({ ...selection, entity })}/>
    <div className="suggestions">TRY A MAP {examples.map(([id, label]) => <button key={id} onClick={() => open({ ...selection, entity: id })}>{label} ↗</button>)}</div>
    <label className="timeline-source"><input type="checkbox" checked={selection.saved} onChange={event => open({ ...selection, saved: event.target.checked })}/> Use saved records</label>
    {busy && <p role="status" className="gamestatus">Finding recorded places…</p>}
    {error && <div className="gameerror" role="alert"><p>{error}</p><button onClick={() => setAttempt(attempt + 1)}>Retry</button></div>}
    {data && <div className="timeline-top">
      <div><div className="eyebrow">{data.offline ? 'INCLUDES SAVED RECORDS' : 'WIKIDATA PLACES'}</div><h2>{data.subject.label}</h2><p>{data.subject.description}</p></div>
      <div className="map-related"><a href={'/?entity=' + data.subject.id}>Open graph <ArrowUpRight size={15}/></a><a href={'/timeline?entity=' + data.subject.id}>View timeline <ArrowUpRight size={15}/></a></div>
    </div>}
    <div className="map-frame">
      <svg viewBox={viewBox} role="group" aria-label="World map with recorded place pins">
        <image href="/maps/land.svg" width="900" height="450" aria-hidden="true"/>
        {data?.points.map((place, index) => {
          const { x, y } = project(place);
          const selected = active?.entity.id === place.entity.id;
          return <g key={place.entity.id} className={'map-pin' + (selected ? ' selected' : '')} role="button" tabIndex={0}
            aria-label={`Select ${place.entity.label}`} aria-pressed={selected}
            onClick={() => setActiveId(place.entity.id)} onKeyDown={event => {
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveId(place.entity.id); }
            }}>
            <circle cx={x} cy={y} r={focused ? 2.6 : 9}/>
            <text x={x} y={y} dy={focused ? '.35em' : '.33em'} textAnchor="middle" fontSize={focused ? 3.2 : 10} aria-hidden="true">{index + 1}</text>
          </g>;
        })}
      </svg>
      <div className="map-controls">
        <button disabled={!active || focused} onClick={() => setFocused(true)}><Focus size={15}/> Focus selected place</button>
        <button disabled={!focused} onClick={() => setFocused(false)}>World view</button>
      </div>
    </div>
    <p className="timeline-note">Pins use recorded coordinates on a present-day land map. <a href="https://www.naturalearthdata.com/downloads/110m-physical-vectors/" target="_blank" rel="noreferrer">Made with Natural Earth ↗</a></p>
    {data && !data.points.length && <p className="timeline-empty"><MapPin size={20}/>No supported Earth coordinates were found for this topic or its checked places.</p>}
    {data && (data.missing_count > 0 || data.truncated) && <p className="timeline-note">{data.missing_count > 0 && `${data.missing_count} checked places had no usable coordinates. `}{data.truncated && 'This view checks up to eight related places.'}</p>}
    {data && active && <div className="place-results">
      <div className="place-list" aria-label="Mapped places">{data.points.map((place, index) => <button key={place.entity.id}
        aria-pressed={active.entity.id === place.entity.id} onClick={() => setActiveId(place.entity.id)}>
        <span>{index + 1}</span><span>{place.entity.label}<small>{place.relationships[0]?.label ?? 'Recorded coordinate'}</small></span>
      </button>)}</div>
      <article className="place-detail" aria-label="Selected place evidence">
        <div className="eyebrow">SELECTED PLACE</div><h3>{active.entity.label}</h3><p>{active.entity.description}</p>
        <p>Latitude {active.coordinate.latitude} · Longitude {active.coordinate.longitude}</p>
        {active.coordinate.precision !== null && <p>Recorded coordinate precision {active.coordinate.precision}°</p>}
        <a href={active.coordinate.source_url} target="_blank" rel="noreferrer">Coordinate statement ↗</a>
        {active.relationships.map(edge => <p key={edge.id}><a href={edge.source_url} target="_blank" rel="noreferrer">{data.subject.label} → {edge.label} → {active.entity.label} ↗</a>{active.relationship_dates?.[edge.id]?.map(date => <small className="map-date" key={date}>{date}</small>)}</p>)}
        <details><summary>Source identifiers</summary><p><code>{active.coordinate.statement_id}</code></p><p>{active.coordinate.references_count ? `${active.coordinate.references_count} references on the coordinate statement.` : 'No supporting references recorded on the coordinate statement.'}</p></details>
        <a className="timeline-link" href={'/?entity=' + active.entity.id}>Explore this place <ArrowUpRight size={15}/></a>
      </article>
    </div>}
  </section>;
}
