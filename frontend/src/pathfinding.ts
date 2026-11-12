import type { Edge, Graph } from './exploration';

export type RouteStep = { from: string; to: string; edge: Edge; reversed: boolean };

// Keep two-topic searches consistent with the route API's Wikimedia property exclusions.
export const WIKIMEDIA_ADMIN_PROPERTIES = new Set(['P301', 'P910', 'P1151', 'P1424', 'P5008', 'P6104']);

export function visibleRoute(graph: Graph, start: string, target: string, filter: string, arrowsOnly: boolean,
  excludedProperties?: ReadonlySet<string>): RouteStep[] | null {
  const neighbors = new Map<string, RouteStep[]>();
  for (const node of graph.nodes) neighbors.set(node.id, []);
  if (!neighbors.has(start) || !neighbors.has(target)) return null;
  for (const edge of graph.edges) {
    if (filter !== 'all' && edge.property_id !== filter) continue;
    if (excludedProperties?.has(edge.property_id)) continue;
    if (!neighbors.has(edge.source) || !neighbors.has(edge.target)) continue;
    neighbors.get(edge.source)!.push({ from: edge.source, to: edge.target, edge, reversed: false });
    if (!arrowsOnly) neighbors.get(edge.target)!.push({ from: edge.target, to: edge.source, edge, reversed: true });
  }

  const queue: { id: string; steps: RouteStep[] }[] = [{ id: start, steps: [] }];
  const visited = new Set([start]);
  for (let index = 0; index < queue.length; index++) {
    const { id, steps } = queue[index];
    if (id === target) return steps;
    for (const step of neighbors.get(id) ?? []) {
      if (visited.has(step.to)) continue;
      visited.add(step.to);
      queue.push({ id: step.to, steps: [...steps, step] });
    }
  }
  return null;
}
