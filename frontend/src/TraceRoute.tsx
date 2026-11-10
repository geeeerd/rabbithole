import React from 'react';
import type { Graph } from './exploration';
import type { RouteStep } from './pathfinding';

export function TraceRoute({ graph, route, arrowsOnly, setArrowsOnly }: {
  graph: Graph;
  route: RouteStep[] | null;
  arrowsOnly: boolean;
  setArrowsOnly: (enabled: boolean) => void;
}) {
  const name = (id: string) => graph.nodes.find(node => node.id === id)?.label ?? id;
  return <section className="trace-route" aria-label="Route through visible topics">
    <h3>Route through this graph</h3>
    <label><input type="checkbox" checked={arrowsOnly} onChange={event => setArrowsOnly(event.target.checked)}/> Follow statement arrows only</label>
    <p role="status">{route ? `${route.length} ${route.length === 1 ? 'connection' : 'connections'} through the visible graph.` : 'No route through the visible connections. Try a different filter or add more links.'}</p>
    {route && <ol>{route.map(step => <li key={step.edge.id}>
      <strong>{name(step.from)} → {name(step.to)}</strong>
      <span>{name(step.edge.source)} → {step.edge.label} → {name(step.edge.target)}</span>
      {step.reversed && <span>Traversed against the statement arrow</span>}
      <a href={step.edge.source_url} target="_blank" rel="noreferrer">Source statement ↗</a>
    </li>)}</ol>}
  </section>;
}
