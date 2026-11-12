import React from 'react';
import type { Entity, Graph } from './exploration';
import type { RouteStep } from './pathfinding';

export function RouteSteps({ nodes, steps, savedIds = [] }: { nodes: Entity[]; steps: RouteStep[]; savedIds?: string[] }) {
  const name = (id: string) => nodes.find(node => node.id === id)?.label ?? id;
  return <ol>{steps.map(step => <li key={step.edge.id}>
    <strong>{name(step.from)} → {name(step.to)}</strong>
    <span>{name(step.edge.source)} → {step.edge.label} → {name(step.edge.target)}</span>
    {step.reversed && <span>Traversed against the statement arrow</span>}
    {savedIds.includes(step.edge.id) && <span>Saved Wikidata statement</span>}
    <a href={step.edge.source_url} target="_blank" rel="noreferrer">Source statement ↗</a>
  </li>)}</ol>;
}

export function TraceRoute({ graph, route, arrowsOnly, setArrowsOnly }: {
  graph: Graph;
  route: RouteStep[] | null;
  arrowsOnly: boolean;
  setArrowsOnly: (enabled: boolean) => void;
}) {
  return <section className="trace-route" aria-label="Route through visible topics">
    <h3>Route through this graph</h3>
    <label><input type="checkbox" checked={arrowsOnly} onChange={event => setArrowsOnly(event.target.checked)}/> Follow statement arrows only</label>
    <p role="status">{route ? `${route.length} ${route.length === 1 ? 'connection' : 'connections'} through the visible graph.` : 'No route through the visible connections. Try a different filter or add more links.'}</p>
    {route && <RouteSteps nodes={graph.nodes} steps={route} savedIds={graph.saved_edge_ids}/>}
  </section>;
}
