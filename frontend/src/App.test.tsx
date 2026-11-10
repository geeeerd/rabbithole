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

it('saves a trail once, reopens its branches and filter, and removes it from the browser', async () => {
  history.replaceState(null, '', '/?entity=Q7251&expand=Q924289&selected=Q35794&filter=P361');
  const explorer = render(<App/>);
  const save = await screen.findByRole('button', { name: 'Save trail' });
  fireEvent.click(save);
  expect(screen.getByText('Trail saved in this browser.')).toBeTruthy();
  fireEvent.click(save);
  expect(screen.getByText('This trail is already saved.')).toBeTruthy();
  explorer.unmount();

  history.replaceState(null, '', '/trails');
  const saved = render(<App/>);
  const title = 'Alan Turing → University of Cambridge';
  const link = screen.getByRole('link', { name: title });
  const href = link.getAttribute('href');
  expect(href).toContain('expand=Q924289');
  expect(href).toContain('selected=Q35794');
  expect(href).toContain('filter=P361');
  expect(screen.getByText('3 topics when saved')).toBeTruthy();
  expect((await axe.run(saved.container, { rules: { 'color-contrast': { enabled: false } } })).violations).toEqual([]);
  saved.unmount();

  history.replaceState(null, '', href!);
  const restored = render(<App/>);
  await screen.findByRole('heading', { name: 'University of Cambridge' });
  expect((screen.getByLabelText('RELATIONSHIP FILTER') as HTMLSelectElement).value).toBe('P361');
  restored.unmount();

  history.replaceState(null, '', '/trails');
  render(<App/>);
  fireEvent.click(screen.getByRole('button', { name: `Remove ${title}` }));
  expect(screen.queryByRole('link', { name: title })).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('Removed');
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Saved Trails' }));
});

it('searches loaded connections by topic or ID and keeps the results after inspecting evidence', async () => {
  history.replaceState(null, '', '/?entity=Q7251&expand=Q924289&selected=Q924289');
  render(<App/>);
  fireEvent.click(await screen.findByText('Inspect connections (2)'));
  const search = screen.getByRole('searchbox', { name: 'Search loaded connections' });
  const direction = screen.getByLabelText("Direction relative to King's College");
  const incoming = "Alan Turing → part of → King's College";
  const outgoing = "King's College → part of → University of Cambridge";
  expect(screen.getByRole('button', { name: outgoing })).toBeTruthy();
  fireEvent.change(search, { target: { value: 'Túring p361' } });
  expect(screen.queryByRole('button', { name: outgoing })).toBeNull();
  fireEvent.change(direction, { target: { value: 'outgoing' } });
  expect(screen.getByText('No loaded connections match these settings.')).toBeTruthy();
  fireEvent.change(direction, { target: { value: 'incoming' } });
  fireEvent.click(screen.getByRole('button', { name: incoming }));
  expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'part of' }));
  fireEvent.click(screen.getByRole('button', { name: 'Back to topic' }));
  expect(screen.getByRole('searchbox')).toBe(search);
  expect((search as HTMLInputElement).value).toBe('Túring p361');
  expect(document.activeElement).toBe(screen.getByRole('button', { name: incoming }));
});
