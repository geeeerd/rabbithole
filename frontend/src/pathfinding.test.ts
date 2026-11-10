import { expect, it } from 'vitest';
import { visibleRoute } from './pathfinding';
import { fixture } from './testFixtures';

it('traces a visible route in either direction while preserving statement direction', () => {
  const root = fixture('Q1', ['Q2']);
  const incoming = fixture('Q3', ['Q2']);
  const graph = { ...root, nodes: [...root.nodes, incoming.nodes[0]], edges: [...root.edges, ...incoming.edges] };
  const route = visibleRoute(graph, 'Q1', 'Q3', 'all', false);
  expect(route?.map(step => [step.from, step.to, step.reversed])).toEqual([['Q1','Q2',false],['Q2','Q3',true]]);
  expect(route?.[1].edge.source).toBe('Q3');
  expect(visibleRoute(graph, 'Q1', 'Q3', 'all', true)).toBeNull();
  expect(visibleRoute(graph, 'Q1', 'Q3', 'P69', false)).toBeNull();
});
