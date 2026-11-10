import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import axe from 'axe-core';
import App from './App';
import { fixture } from './testFixtures';
const a=fixture('Q7251',['Q924289']),b=fixture('Q924289',['Q35794']);
const labels:Record<string,string>={Q7251:'Alan Turing',Q924289:"King's College",Q35794:'University of Cambridge'};
for(const graph of [a,b]){for(const n of graph.nodes){n.label=labels[n.id];n.source_url='https://www.wikidata.org/wiki/'+n.id}for(const edge of graph.edges)edge.source_url='https://www.wikidata.org/wiki/'+edge.source+'#'+edge.property_id}
vi.mock('./GraphCanvas',()=>({default:()=> <div role="group" aria-label="Knowledge graph"/>}));
beforeEach(()=>{history.replaceState(null,'','/');const storage=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>storage.get(key)||null,setItem:(key:string,value:string)=>storage.set(key,value)});vi.stubGlobal('fetch',vi.fn(async(url:string)=>({ok:true,json:async()=>url.includes('Q924289')?b:a})))});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('provides an accessible homepage structure and a persisted theme choice',async()=>{
 const {container}=render(<App/>);
 expect(screen.getByRole('link',{name:'Skip to content'})).toBeTruthy();
 expect(screen.getByRole('combobox',{name:'Search Wikidata topics'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Toggle color theme'}));
 expect(localStorage.getItem('rabbithole-theme')).toBe('light');
 const results=await axe.run(container,{rules:{'color-contrast':{enabled:false}}});
 expect(results.violations.map(v=>v.id)).toEqual([]);
});
it('supports a complete keyboard-list exploration including expand, collapse and evidence',async()=>{
 const {container}=render(<App/>);
 fireEvent.click(screen.getByRole('button',{name:'Alan Turing ↗'}));
 const college=await screen.findByRole('button',{name:"King's College"});fireEvent.click(college);
 fireEvent.click(screen.getByRole('button',{name:/Expand connections/}));
 await screen.findByRole('button',{name:'University of Cambridge'});
 expect(location.search).toContain('expand=Q924289');
 fireEvent.click(screen.getByRole('button',{name:'Collapse branch'}));
 expect(screen.queryByRole('button',{name:'University of Cambridge'})).toBeNull();
 fireEvent.click(screen.getByText('Inspect connections (1)'));
 fireEvent.click(screen.getByRole('button',{name:"Alan Turing → part of → King's College"}));
 expect(screen.getByText(/No supporting references recorded/)).toBeTruthy();
 expect(screen.getByRole('link',{name:/Inspect original statement/})).toBeTruthy();
 const results=await axe.run(container,{rules:{'color-contrast':{enabled:false}}});
 expect(results.violations.map(v=>v.id)).toEqual([]);
});
