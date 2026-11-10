import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import GraphCanvas from './GraphCanvas';
import { fixture } from './testFixtures';
const mocks=vi.hoisted(()=>({handlers:{} as Record<string,(event:{target:{id:()=>string}})=>void>,c:{on:vi.fn(),style:vi.fn(),batch:vi.fn(),elements:vi.fn(),edges:vi.fn(),add:vi.fn(),layout:vi.fn(),nodes:vi.fn(),$id:vi.fn(),animate:vi.fn(),center:vi.fn(),fit:vi.fn(),resize:vi.fn(),destroy:vi.fn(),zoom:vi.fn()}}));
vi.mock('cytoscape',()=>({default:vi.fn(()=>mocks.c)}));
beforeEach(()=>{
 vi.clearAllMocks();mocks.handlers={};
 mocks.c.on.mockImplementation((_event,selector,handler)=>{mocks.handlers[selector]=handler});
 mocks.c.batch.mockImplementation(fn=>fn());mocks.c.elements.mockReturnValue({remove:vi.fn(),removeClass:vi.fn()});mocks.c.edges.mockReturnValue({removeClass:vi.fn()});mocks.c.layout.mockReturnValue({run:vi.fn()});mocks.c.nodes.mockReturnValue({unselect:vi.fn()});mocks.c.$id.mockReturnValue({select:vi.fn(),addClass:vi.fn()});mocks.c.zoom.mockReturnValue(1);
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});vi.stubGlobal('matchMedia',vi.fn(()=>({matches:true})));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('supports graph selection through keyboard and pointer with identical entities',()=>{
 const graph=fixture('Q1',['Q2']),choose=vi.fn(),inspect=vi.fn(),reset=vi.fn();
 render(<GraphCanvas graph={graph} selectedId="Q1" filter="all" light={false} onSelect={choose} onInspect={inspect} onReset={reset}/>);
 fireEvent.keyDown(screen.getByRole('group',{name:'Knowledge graph'}),{key:'ArrowRight'});
 expect(choose).toHaveBeenCalledWith(graph.nodes[1]);
 mocks.handlers.node({target:{id:()=> 'Q2'}});expect(choose).toHaveBeenLastCalledWith(graph.nodes[1]);
 mocks.handlers.edge({target:{id:()=>graph.edges[0].id}});expect(inspect).toHaveBeenCalledWith(graph.edges[0]);
 fireEvent.click(screen.getByRole('button',{name:'Reset graph'}));expect(reset).toHaveBeenCalledOnce();
});
it('retains the renderer and layout on profile selection, honoring reduced motion',()=>{
 const graph=fixture('Q1',['Q2']),choose=vi.fn();const props={graph,filter:'all',light:false,onSelect:choose,onInspect:vi.fn(),onReset:vi.fn()};
 const view=render(<GraphCanvas {...props} selectedId="Q1"/>);const layouts=mocks.c.layout.mock.calls.length;
 view.rerender(<GraphCanvas {...props} selectedId="Q2"/>);
 expect(mocks.c.layout.mock.calls).toHaveLength(layouts);expect(mocks.c.destroy).not.toHaveBeenCalled();expect(mocks.c.center).toHaveBeenCalled();expect(mocks.c.animate).not.toHaveBeenCalled();
});
it('filters visible edges without reversing them and supports keyboard zoom',()=>{
 const graph=fixture('Q1',['Q2']);render(<GraphCanvas graph={graph} selectedId="Q1" filter="P69" light={false} onSelect={vi.fn()} onInspect={vi.fn()} onReset={vi.fn()}/>);
 expect(mocks.c.add.mock.calls[0][0]).toHaveLength(graph.nodes.length);
 const canvas=screen.getByRole('group',{name:'Knowledge graph'});fireEvent.keyDown(canvas,{key:'+'});expect(mocks.c.zoom).toHaveBeenCalledWith(1.2);
 fireEvent.keyDown(canvas,{key:'0'});expect(mocks.c.fit).toHaveBeenCalledWith(undefined,50);
});

it('emphasizes the selected neighborhood and traced route without moving the graph', () => {
 const graph = fixture('Q1', ['Q2', 'Q3', 'Q4', 'Q5']);
 graph.edges = [...fixture('Q1', ['Q2']).edges, ...fixture('Q2', ['Q3', 'Q4']).edges];
 const ids = [...graph.nodes.map(node => node.id), ...graph.edges.map(edge => edge.id)];
 let dimmed: string[] = [];
 const elements = {
  remove: vi.fn(),
  removeClass: vi.fn(() => { dimmed = []; }),
  filter: (predicate: (element: { id: () => string }) => boolean) => ({
   addClass: () => { dimmed = ids.filter(id => predicate({ id: () => id })); },
  }),
 };
 mocks.c.elements.mockReturnValue(elements);
 render(<GraphCanvas graph={graph} selectedId="Q1" filter="all" light={false} routeIds={['Q1-Q2', 'Q2-Q3']}
  onSelect={vi.fn()} onInspect={vi.fn()} onReset={vi.fn()}/>);
 const focus = screen.getByRole('button', { name: 'Focus selected topic' });
 fireEvent.click(focus);
 expect(focus.getAttribute('aria-pressed')).toBe('true');
 expect(dimmed).toEqual(['Q4', 'Q5', 'Q2-Q4']);
 expect(mocks.c.layout).toHaveBeenCalledTimes(1);
 fireEvent.click(focus);
 expect(dimmed).toEqual([]);
});
