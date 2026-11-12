import { useEffect, useRef, useState } from 'react';
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

export function FindConnection({ graph, start }: { graph: Graph; start: Entity }) {
  const [destination, setDestination] = useState<Entity | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef<AbortController | null>(null);

  useEffect(() => () => pending.current?.abort(), []);

  async function find(target: Entity) {
    pending.current?.abort();
    setDestination(target);
    setResult(null);
    setError('');
    setBusy(false);
    if (start.id === target.id) {
      setError('Choose a topic other than the starting topic.');
      return;
    }
    const loaded = visibleRoute(graph, start.id, target.id, 'all', false);
    if (loaded) {
      setResult({ nodes: graph.nodes, steps: loaded, savedIds: graph.saved_edge_ids });
      return;
    }

    const request = new AbortController();
    pending.current = request;
    setBusy(true);
    try {
      const query = new URLSearchParams({ start: start.id, target: target.id });
      const response = await fetch('/api/graph/route?' + query, { signal: request.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Could not look for a connection.');
      const route: RouteResponse = body;
      if (!request.signal.aborted) setResult({ nodes: route.nodes, checked: route.checked, partial: route.partial,
        savedIds: route.saved_edge_ids, steps: route.steps.map(({ from_id, to_id, ...step }) => ({ ...step, from: from_id, to: to_id })) });
    } catch (failure) {
      if (!request.signal.aborted) setError(failure instanceof Error ? failure.message : 'Could not look for a connection.');
    } finally {
      if (!request.signal.aborted) setBusy(false);
    }
  }

  return <section className="find-connection" aria-labelledby="find-connection-title">
    <h3 id="find-connection-title">Find a connection</h3>
    <p>Starting from <strong>{start.label}</strong>. Search for a second topic.</p>
    <SearchBox inputId="connection-target" label="Search for a destination topic" placeholder="Connect to…"
      onSelect={(_, topic) => void find(topic)}/>
    {destination && <div className="trace-route">
      <h3>{start.label} → {destination.label}</h3>
      {busy && <p role="status">Checking nearby Wikidata topics…</p>}
      {error && <div role="alert"><p>{error}</p>{destination.id !== start.id && <button onClick={() => void find(destination)}>Retry connection search</button>}</div>}
      {result && <>
        <p role="status">{result.steps.length
          ? `${result.steps.length} ${result.steps.length === 1 ? 'connection' : 'connections'} found ${result.checked === undefined ? 'in this trail' : 'in the checked neighborhood'}.`
          : 'No route found in the checked neighborhood.'}</p>
        {result.checked !== undefined && <p>Checked {result.checked} topic records for routes of up to three connections.{result.partial && ' Some live records were unavailable.'}</p>}
        {result.steps.length > 0 && <RouteSteps nodes={result.nodes} steps={result.steps} savedIds={result.savedIds}/>}
      </>}
    </div>}
  </section>;
}
