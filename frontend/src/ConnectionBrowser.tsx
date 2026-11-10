import { useEffect, useMemo, useRef, useState } from 'react';
import type { Edge, Entity, Graph } from './exploration';

type Direction = 'all' | 'incoming' | 'outgoing';
const pageSize = 30;

function searchable(value: string) {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();
}

export function ConnectionBrowser({ graph, filter, selected, hidden, onInspect }: {
  graph: Graph;
  filter: string;
  selected: Entity;
  hidden: boolean;
  onInspect: (edge: Edge) => void;
}) {
  const [query, setQuery] = useState('');
  const [direction, setDirection] = useState<Direction>('all');
  const [limit, setLimit] = useState(pageSize);
  const inspectButton = useRef<HTMLButtonElement | null>(null);
  const indexed = useMemo(() => {
    const labels = new Map(graph.nodes.map(node => [node.id, node.label]));
    return graph.edges.map(edge => {
      const source = labels.get(edge.source) ?? edge.source;
      const target = labels.get(edge.target) ?? edge.target;
      return { edge, source, target, text: searchable(
        [source, target, edge.label, edge.property_id, edge.source, edge.target].join(' '),
      ) };
    });
  }, [graph]);

  useEffect(() => {
    if (hidden) return;
    inspectButton.current?.focus();
    inspectButton.current = null;
  }, [hidden]);

  const visible = indexed.filter(({ edge }) => filter === 'all' || edge.property_id === filter);
  const terms = searchable(query).trim().split(/\s+/).filter(Boolean);
  const matches = visible.filter(({ edge, text }) => {
    if (direction === 'incoming' && edge.target !== selected.id) return false;
    if (direction === 'outgoing' && edge.source !== selected.id) return false;
    return terms.every(term => text.includes(term));
  });

  return <details className="connection-browser" hidden={hidden}>
    <summary>Inspect connections ({visible.length})</summary>
    <div className="connection-controls">
      <label>Search loaded connections
        <input type="search" value={query} placeholder="Topic, relationship or ID" onChange={event => {
          setQuery(event.target.value);
          setLimit(pageSize);
        }}/>
      </label>
      <label>Direction relative to {selected.label}
        <select value={direction} onChange={event => {
          setDirection(event.target.value as Direction);
          setLimit(pageSize);
        }}>
          <option value="all">Any connection in the trail</option>
          <option value="incoming">Pointing to this topic</option>
          <option value="outgoing">Pointing from this topic</option>
        </select>
      </label>
    </div>
    <p className="connection-count" role="status">{matches.length
      ? `Showing ${Math.min(limit, matches.length)} of ${matches.length} matching connections.`
      : 'No loaded connections match these settings.'}</p>
    <ul className="connection-results">
      {matches.slice(0, limit).map(({ edge, source, target }) => <li key={edge.id}>
        <button className="edgelist" onClick={event => {
          inspectButton.current = event.currentTarget;
          onInspect(edge);
        }}>{source} → {edge.label} → {target}</button>
      </li>)}
    </ul>
    {matches.length > limit && <button onClick={() => setLimit(limit + pageSize)}>Show more matches</button>}
  </details>;
}
