import type { Graph } from './exploration';
export function fixture(root: string, neighbors: string[]): Graph {
  const ids = [...new Set([root, ...neighbors])];
  return { root_id: root, nodes: ids.map(id => ({ id, label: id, description: '', source_url: '' })),
    edges: neighbors.map(target => ({id: root+'-'+target, source: root, target, label: 'part of', property_id: 'P361', references: [], qualifiers: {}, source_url: ''})),
    truncated: false, offline: false, fetched_at: '2026-11-06T00:00:00Z' };
}
