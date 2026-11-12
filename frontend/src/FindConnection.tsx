import { useEffect, useMemo, useState } from 'react';
import type { Edge, Entity, Graph } from './exploration';
import { visibleRoute, type RouteStep } from './pathfinding';
import { SearchBox } from './SearchBox';
import { RouteSteps } from './TraceRoute';

type RouteResponse = {
  nodes: Entity[];
  steps: { from_id: string; to_id: string; edge: Edge; reversed: boolean }[];
  checked: number;
  saved_edge_ids: string[];
  partial: boolean;
};

type Result = { nodes: Entity[]; steps: RouteStep[]; savedIds?: string[]; checked?: number; partial?: boolean };
type Lookup = { target: string; result: Result } | { target: string; error: string };

export function FindConnection({ graph, start, target, destination, disabled, onTargetChange, onDestination }: {
  graph: Graph;
  start: Entity;
  target?: string;
  destination?: Entity;
  disabled: boolean;
  onTargetChange: (target?: string) => void;
  onDestination: (entity: Entity) => void;
}) {
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sameTopic, setSameTopic] = useState(false);
  const loaded = useMemo(() => target ? visibleRoute(graph, start.id, target, 'all', false) : null,
    [graph, start.id, target]);
  const needsLookup = !!target && !loaded;

  useEffect(() => {
    if (!needsLookup || !target) return;
    const request = new AbortController();
    setLookup(null);
    const query = new URLSearchParams({ start: start.id, target });
    void (async () => {
      try {
        const response = await fetch('/api/graph/route?' + query, { signal: request.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not look for a connection.');
        const route: RouteResponse = body;
        if (request.signal.aborted) return;
        const resolved = route.nodes.find(node => node.id === target);
        if (resolved) onDestination(resolved);
        setLookup({ target, result: { nodes: route.nodes, checked: route.checked, partial: route.partial,
          savedIds: route.saved_edge_ids, steps: route.steps.map(({ from_id, to_id, ...step }) => ({ ...step, from: from_id, to: to_id })) } });
      } catch (failure) {
        if (!request.signal.aborted) setLookup({ target, error: failure instanceof Error ? failure.message : 'Could not look for a connection.' });
      }
    })();
    return () => request.abort();
  }, [start.id, target, needsLookup, attempt, onDestination]);

  function choose(topic: Entity) {
    setSameTopic(start.id === topic.id);
    if (start.id === topic.id) return;
    onDestination(topic);
    if (target === topic.id && needsLookup) setAttempt(count => count + 1);
    onTargetChange(topic.id);
  }

  const currentLookup = lookup && lookup.target === target ? lookup : null;
  const result: Result | null = loaded ? { nodes: graph.nodes, steps: loaded, savedIds: graph.saved_edge_ids }
    : currentLookup && 'result' in currentLookup ? currentLookup.result : null;
  const error = !loaded && currentLookup && 'error' in currentLookup ? currentLookup.error : '';
  const label = destination?.id === target ? destination?.label : graph.nodes.find(node => node.id === target)?.label;

  return <section className="find-connection" aria-labelledby="find-connection-title">
    <h3 id="find-connection-title">Find a connection</h3>
    <p>Starting from <strong>{start.label}</strong>. Search for a second topic.</p>
    <SearchBox inputId="connection-target" label="Search for a destination topic" placeholder="Connect to…"
      disabled={disabled} onSelect={(_, topic) => choose(topic)}/>
    {sameTopic && <p role="alert">Choose a topic other than the starting topic.</p>}
    {target && <div className="trace-route">
      <div className="connection-result-heading">
        <h3>{start.label} → {label ?? target}</h3>
        <button disabled={disabled} onClick={() => { setSameTopic(false); onTargetChange(); }}>Clear destination</button>
      </div>
      {!result && !error && <p role="status">Checking nearby Wikidata topics…</p>}
      {error && <div role="alert"><p>{error}</p><button onClick={() => setAttempt(count => count + 1)}>Retry connection search</button></div>}
      {result && <>
        <p role="status">{result.steps.length
          ? `${result.steps.length} ${result.steps.length === 1 ? 'connection' : 'connections'} found ${result.checked === undefined ? 'in this trail' : 'in the checked neighborhood'}.`
          : 'No route found in the checked neighborhood.'}</p>
        {result.checked !== undefined && <p>Checked {result.checked} topic records for routes of up to three connections.{result.partial && ' Some live records were unavailable.'}</p>}
        {result.steps.length > 0 && <RouteSteps nodes={result.nodes} steps={result.steps} savedIds={result.savedIds}/>}
        <div className="connection-result-actions">
          <a href={`/?entity=${target}`}>Explore destination ↗</a>
          <a href={`/?entity=${target}&target=${start.id}`}>Swap topics ↔</a>
        </div>
      </>}
    </div>}
  </section>;
}
