import { useEffect, useMemo, useState } from 'react';
import type { ConnectionOptions, Edge, Entity, Graph } from './exploration';
import { visibleRoute, WIKIMEDIA_ADMIN_PROPERTIES, type RouteStep } from './pathfinding';
import { SearchBox } from './SearchBox';

type WirePath = {
  nodes: Entity[];
  steps: { from_id: string; to_id: string; edge: Edge; reversed: boolean }[];
};

type RouteResponse = WirePath & {
  alternatives?: WirePath[];
  checked: number;
  saved_edge_ids: string[];
  partial: boolean;
  max_steps: number;
};

type Path = { nodes: Entity[]; steps: RouteStep[] };
type Result = Path & { alternatives?: Path[]; savedIds?: string[]; checked?: number; partial?: boolean; maxSteps?: number };
type Lookup = { target: string; arrowsOnly: boolean; deep: boolean } & ({ result: Result } | { error: string });

function readPath(path: WirePath): Path {
  return { nodes: path.nodes, steps: path.steps.map(({ from_id, to_id, ...step }) => ({ ...step, from: from_id, to: to_id })) };
}

function ConnectionPath({ path, start, savedIds }: { path: Path; start: Entity; savedIds?: string[] }) {
  const labels = new Map(path.nodes.map(node => [node.id, node.label]));
  const name = (id: string) => labels.get(id) ?? id;
  return <ol className="connection-path" role="list" aria-label="Connection path">
    <li><a className="connection-path-topic" href={`/?entity=${start.id}`}>{start.label}</a></li>
    {path.steps.map(step => <li key={step.edge.id}>
      <div className="connection-path-edge">
        <span className="connection-path-arrow" aria-hidden="true">{step.reversed ? '↑' : '↓'}</span>
        <div>
          <strong>{step.edge.label}</strong>
          <span>{name(step.edge.source)} → {name(step.edge.target)}</span>
          {step.reversed && <span>Traversed against the statement arrow</span>}
          {savedIds?.includes(step.edge.id) && <span>Saved Wikidata statement</span>}
          <a href={step.edge.source_url} target="_blank" rel="noreferrer">Source statement ↗</a>
        </div>
      </div>
      <a className="connection-path-topic" href={`/?entity=${step.to}`}>{name(step.to)}</a>
    </li>)}
  </ol>;
}

function ConnectionPaths({ result, start }: { result: Result; start: Entity }) {
  const [active, setActive] = useState(0);
  const paths = [result, ...(result.alternatives ?? [])];
  const index = Math.min(active, paths.length - 1);
  const path = paths[index];
  const length = path.steps.length;
  return <>
    {paths.length > 1 && <label className="connection-route-choice">Connection route
      <select value={index} onChange={event => setActive(Number(event.target.value))}>
        {paths.map((option, position) => <option key={position} value={position}>
          Route {position + 1} · {option.steps.length} {option.steps.length === 1 ? 'link' : 'links'}
        </option>)}
      </select>
    </label>}
    <p role="status">{length} {length === 1 ? 'connection' : 'connections'} found {result.checked === undefined ? 'in this trail' : 'in the checked neighborhood'}.</p>
    <ConnectionPath path={path} start={start} savedIds={result.savedIds}/>
  </>;
}

export function FindConnection({ graph, start, target, destination, arrowsOnly, deep, disabled, onTargetChange, onOptionsChange, onDestination }: {
  graph: Graph;
  start: Entity;
  target?: string;
  destination?: Entity;
  arrowsOnly: boolean;
  deep: boolean;
  disabled: boolean;
  onTargetChange: (target?: string) => void;
  onOptionsChange: (options: ConnectionOptions) => void;
  onDestination: (entity: Entity) => void;
}) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sameTopic, setSameTopic] = useState(false);
  const loaded = useMemo(() => target ? visibleRoute(graph, start.id, target, 'all', arrowsOnly, WIKIMEDIA_ADMIN_PROPERTIES) : null,
    [graph, start.id, target, arrowsOnly]);
  const needsLookup = !!target && (deep || !loaded);

  useEffect(() => {
    if (!needsLookup || !target) return;
    const request = new AbortController();
    setLookup(null);
    const query = new URLSearchParams({ start: start.id, target });
    if (arrowsOnly) query.set('arrows_only', 'true');
    if (deep) query.set('depth', 'deep');
    void (async () => {
      try {
        const response = await fetch('/api/graph/route?' + query, { signal: request.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not look for a connection.');
        const route: RouteResponse = body;
        if (request.signal.aborted) return;
        const resolved = route.nodes.find(node => node.id === target);
        if (resolved) onDestination(resolved);
        setLookup({ target, arrowsOnly, deep, result: { ...readPath(route), checked: route.checked, partial: route.partial,
          maxSteps: route.max_steps, savedIds: route.saved_edge_ids, alternatives: route.alternatives?.map(readPath) } });
      } catch (failure) {
        if (!request.signal.aborted) setLookup({ target, arrowsOnly, deep, error: failure instanceof Error ? failure.message : 'Could not look for a connection.' });
      }
    })();
    return () => request.abort();
  }, [start.id, target, needsLookup, arrowsOnly, deep, attempt, onDestination]);

  function choose(topic: Entity) {
    setSameTopic(start.id === topic.id);
    if (start.id === topic.id) return;
    onDestination(topic);
    if (target === topic.id && needsLookup) setAttempt(count => count + 1);
    onTargetChange(topic.id);
  }

  const currentLookup = lookup?.target === target && lookup?.arrowsOnly === arrowsOnly && lookup?.deep === deep ? lookup : null;
  const remote = needsLookup && currentLookup && 'result' in currentLookup ? currentLookup.result : null;
  const local: Result | null = loaded ? { nodes: graph.nodes, steps: loaded, savedIds: graph.saved_edge_ids } : null;
  const result = remote?.steps.length ? remote : local ?? remote;
  const error = needsLookup && currentLookup && 'error' in currentLookup ? currentLookup.error : '';
  const label = destination?.label ?? target;

  function clear() {
    setSameTopic(false);
    onTargetChange();
    document.getElementById('connection-target')?.focus();
  }

  return <section className="find-connection" aria-labelledby="find-connection-title">
    <h3 id="find-connection-title">Find a connection</h3>
    <p>Starting from <strong>{start.label}</strong>. Search for a second topic.</p>
    <SearchBox inputId="connection-target" label="Search for a destination topic" placeholder="Connect to…"
      disabled={disabled} onSelect={(_, topic) => choose(topic)}/>
    {sameTopic && <p role="alert">Choose a topic other than the starting topic.</p>}
    {target && <div className="trace-route">
      <div className="connection-result-heading">
        <h3>{start.label} → {label}</h3>
        <button disabled={disabled} onClick={clear}>Clear destination</button>
      </div>
      <label className="connection-direction"><input type="checkbox" checked={arrowsOnly} disabled={disabled}
        onChange={event => onOptionsChange({ arrowsOnly: event.target.checked })}/> Follow statement arrows only</label>
      {needsLookup && !currentLookup && <p role="status">{deep ? 'Checking a wider set of Wikidata topics…' : 'Checking nearby Wikidata topics…'}</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(count => count + 1)}>Retry connection search</button></div>}
      {result && <>
        {result.steps.length > 0 ? <ConnectionPaths key={`${target}:${arrowsOnly}:${deep}:${result.checked ?? 'trail'}`} result={result} start={start}/>
          : <p role="status">{arrowsOnly ? 'No route following the arrows was found in the checked neighborhood.'
            : 'No route found in the checked neighborhood.'}</p>}
        {remote && <p>Checked {remote.checked} topic records for routes of up to {remote.maxSteps ?? (deep ? 4 : 3)} connections.{remote.partial && ' Some live records were unavailable.'}</p>}
        <div className="connection-result-actions">
          {result.steps.length === 0 && <a href={`/?entity=${target}`}>Explore destination ↗</a>}
          <a href={`/?entity=${target}&target=${start.id}${arrowsOnly ? '&arrows=1' : ''}${deep ? '&depth=deep' : ''}`}>Swap topics ↔</a>
        </div>
      </>}
      {(deep || result) && <button className="connection-depth" disabled={disabled}
        onClick={() => onOptionsChange({ deep: !deep })}>{deep ? 'Use quick search' : result?.steps.length ? 'Look for more routes' : 'Search deeper'}</button>}
    </div>}
  </section>;
}
