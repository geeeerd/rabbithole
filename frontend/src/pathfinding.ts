import type { Edge, Graph } from './exploration';

export type RouteStep = { from: string; to: string; edge: Edge; reversed: boolean };

export function visibleRoute(graph: Graph, start: string, target: string, filter: string, arrowsOnly: boolean): RouteStep[] | null {
  const neighbors = new Map<string, RouteStep[]>();
  for (const node of graph.nodes) neighbors.set(node.id, []);
  if (!neighbors.has(start) || !neighbors.has(target)) return null;
  for (const edge of graph.edges) {
    if (filter !== 'all' && edge.property_id !== filter) continue;
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
