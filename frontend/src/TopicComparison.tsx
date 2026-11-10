import { useState } from 'react';
import type { Edge, Entity, Graph } from './exploration';

function connectionsByNeighbor(edges: Edge[], topic: string) {
  const neighbors = new Map<string, Edge[]>();
  for (const edge of edges) {
    const neighbor = edge.source === topic ? edge.target : edge.target === topic ? edge.source : null;
    if (!neighbor || neighbor === topic) continue;
    const entries = neighbors.get(neighbor) ?? [];
    entries.push(edge);
    neighbors.set(neighbor, entries);
  }
  return neighbors;
}

export function TopicComparison({ graph, selected, filter, hidden }: {
  graph: Graph;
  selected: Entity;
  filter: string;
  hidden: boolean;
}) {
  const [comparisonId, setComparisonId] = useState('');
  const choices = graph.nodes.filter(node => node.id !== selected.id);
  const other = choices.find(node => node.id === comparisonId)
    ?? choices.find(node => node.id === graph.root_id) ?? choices[0];
  if (!other) return null;

  const visible = graph.edges.filter(edge => filter === 'all' || edge.property_id === filter);
  const first = connectionsByNeighbor(visible, selected.id);
  const second = connectionsByNeighbor(visible, other.id);
  const direct = first.get(other.id) ?? [];
  const common = choices.filter(node => node.id !== other.id && first.has(node.id) && second.has(node.id));
  common.sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
  const labels = new Map(graph.nodes.map(node => [node.id, node.label]));

  function statements(edges: Edge[]) {
    return <ul className="comparison-statements">{edges.map(edge => <li key={edge.id}>
      <a href={edge.source_url} target="_blank" rel="noreferrer">
        {labels.get(edge.source) ?? edge.source} → {edge.label} → {labels.get(edge.target) ?? edge.target}
      </a>
    </li>)}</ul>;
  }

  return <details className="topic-comparison" hidden={hidden}>
    <summary>Compare topics</summary>
    <p>See how {selected.label} and another topic connect in the loaded graph. The relationship filter applies here too.</p>
    <label>Compare {selected.label} with
      <select value={other.id} onChange={event => setComparisonId(event.target.value)}>
        {choices.map(node => <option key={node.id} value={node.id}>{node.label} · {node.id}</option>)}
      </select>
    </label>
    <p role="status">{direct.length} direct {direct.length === 1 ? 'connection' : 'connections'} · {common.length} shared {common.length === 1 ? 'neighbor' : 'neighbors'}</p>
    {direct.length > 0 && <section aria-label="Direct connections">
      <h3>Direct connections</h3>
      {statements(direct)}
    </section>}
    {common.length > 0 && <section aria-label="Shared neighbors">
      <h3>Shared neighbors</h3>
      {common.map(node => <details key={node.id}>
        <summary>{node.label}</summary>
        {statements([...(first.get(node.id) ?? []), ...(second.get(node.id) ?? [])])}
      </details>)}
    </section>}
    {direct.length === 0 && common.length === 0 && <p>Expand a topic or load more connections to continue comparing.</p>}
  </details>;
}
