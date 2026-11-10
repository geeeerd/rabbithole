import { describe, expect, it } from 'vitest';
import { buildSnapshot, mergeGraph, readTrail, trailUrl } from './exploration';
import type { Graph, Trail } from './exploration';
import { fixture } from './testFixtures';
const trail: Trail = {root: 'Q1', expanded: ['Q2','Q3','Q4'], selected: 'Q5', filter: 'P361'};
describe('exploration state', () => {
  it('round trips branches, selection and filter through a share URL', () => {
    expect(readTrail(trailUrl(trail))).toEqual(trail);
  });
  it('rejects invalid IDs and excessive branches before issuing requests', () => {
    expect(() => readTrail('?entity=not-an-id')).toThrow();
    expect(() => readTrail('?entity=Q1&expand='+Array.from({length:9},(_,i)=>'Q'+(i+2)).join(','))).toThrow();
    expect(() => readTrail('?entity=Q1&selected=bad')).toThrow();
    expect(() => readTrail('?entity=Q1&filter=bad')).toThrow();
  });
  it('deduplicates cycles and preserves direction and shared nodes on collapse', () => {
    const bundles = {Q1:fixture('Q1',['Q2','Q3']),Q2:fixture('Q2',['Q4','Q5']),Q3:fixture('Q3',['Q4']),Q4:fixture('Q4',['Q1','Q6'])};
    const before = buildSnapshot(trail,bundles);
    const after = buildSnapshot({...trail,expanded:['Q3','Q4']},before.bundles);
    const graph = mergeGraph(after);
    expect(after.trail.expanded).toEqual(['Q3','Q4']);
    expect(after.trail.selected).toBe('Q1');
    expect(graph.nodes.map(n=>n.id).sort()).toEqual(['Q1','Q2','Q3','Q4','Q6']);
    expect(graph.edges.find(e=>e.id==='Q4-Q1')).toMatchObject({source:'Q4',target:'Q1'});
    expect(graph.edges.some(e=>e.id==='Q2-Q4')).toBe(false);
  });
  it('prunes dependent expansions when their only parent is collapsed', () => {
    const state = buildSnapshot({...trail,expanded:['Q4']},{Q1:fixture('Q1',['Q2']),Q4:fixture('Q4',['Q6'])});
    expect(state.trail.expanded).toEqual([]);
    expect(Object.keys(state.bundles)).toEqual(['Q1']);
  });
  it('enforces the visible-node cap without mutating the original graph', () => {
    const original = fixture('Q1',['Q2']);
    expect(()=>buildSnapshot({...trail,expanded:['Q2']},{Q1:original,Q2:fixture('Q2',Array.from({length:100},(_,i)=>'Q'+(i+3)))})).toThrow('100-topic');
    expect(original.nodes).toHaveLength(2);
  });
});
