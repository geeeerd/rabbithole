import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Challenge, type Game } from './Challenge';
const entity = (id:string,label:string) => ({id,label,description:'A topic',source_url:'https://www.wikidata.org/wiki/'+id});
const start = entity('Q7251','Alan Turing');
const destination = entity('Q35794','University of Cambridge');
const edge = {id:'statement-1',source:start.id,target:destination.id,label:'part of',property_id:'P361',references:[],qualifiers:{},source_url:'https://www.wikidata.org/wiki/Q7251#P361'};
const initial:Game = {token:'signed-start',id:'daily',graph_version:'v1',start,destination,current:start,path:[],visited:[start],choices:[{edge,entity:destination}],steps:0,hints_used:0,complete:false,max_steps:12,hint_edge_id:null,daily_date:'2026-11-06',model:'Directed snapshot',snapshot_date:'2026-11-06'};
const complete:Game = {...initial,token:'signed-win',current:destination,path:[edge],visited:[start,destination],choices:[],steps:1,complete:true};
let mockApi:ReturnType<typeof vi.fn>;
beforeEach(()=>{
 sessionStorage.clear();
 history.replaceState(null, '', '/challenge');
 mockApi=vi.fn(async (url:string,options?:RequestInit)=>{
   const endpoint=url.split('?')[0].split('/').pop();
   const body=options?.body?JSON.parse(String(options.body)):null;
   const data=endpoint==='collection'?{entities:[start,destination]}:endpoint==='validate-move'?complete:endpoint==='hint'?{...initial,token:'signed-hint',hints_used:1,hint_edge_id:edge.id}:endpoint==='verify-path'&&body?.token==='signed-win'?complete:initial;
   return {ok:true,json:async()=>data};
 });
 vi.stubGlobal('fetch',mockApi);
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('validates a move with the server before showing completion and continuing exploration',async()=>{
 const explore=vi.fn();render(<Challenge onExplore={explore}/>);
 const move=await screen.findByRole('button',{name:/part of.*University of Cambridge/});
 fireEvent.click(move);
 await screen.findByText('You followed the thread.');
 expect(mockApi).toHaveBeenCalledWith('/api/challenges/validate-move',expect.objectContaining({body:JSON.stringify({token:'signed-start',edge_id:edge.id})}));
 expect(sessionStorage.getItem('rabbithole-challenge-v1')).toBe('signed-win');
 fireEvent.click(screen.getByRole('button',{name:/Keep exploring/}));
 expect(explore).toHaveBeenCalledWith('Q35794');
});
it('highlights the signed hint and can undo a completed move',async()=>{
 render(<Challenge onExplore={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Get a hint/}));
 await screen.findByText('Suggested by your hint');
 expect(screen.getByText('1 hint used')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:/part of.*University of Cambridge/}));
 await screen.findByText('You followed the thread.');
 fireEvent.click(screen.getByRole('button',{name:/Undo last move/}));
 await screen.findByRole('button',{name:/Get a hint/});
 expect(screen.queryByText('You followed the thread.')).toBeNull();
});
it('verifies saved progress with the backend on reload',async()=>{
 sessionStorage.setItem('rabbithole-challenge-v1','signed-win');
 render(<Challenge onExplore={()=>{}}/>);
 await screen.findByText('You followed the thread.');
 expect(mockApi).toHaveBeenCalledWith('/api/challenges/verify-path',expect.objectContaining({body:JSON.stringify({token:'signed-win'})}));
});
it('keeps the previous position when the server rejects a move and retries it',async()=>{
 render(<Challenge onExplore={()=>{}}/>);
 const button=await screen.findByRole('button',{name:/part of.*University of Cambridge/});
 mockApi.mockResolvedValueOnce({ok:false,json:async()=>({detail:'Temporary error'})});
 fireEvent.click(button);
 await screen.findByText('Temporary error');
 expect(screen.queryByText('You followed the thread.')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Retry'}));
 await screen.findByText('You followed the thread.');
});
it('checks practice pairs with the server and shows invalid-route errors',async()=>{
 render(<Challenge onExplore={()=>{}}/>);
 await screen.findByRole('button',{name:/part of.*University of Cambridge/});
 await waitFor(()=>expect((screen.getByRole('button',{name:/Start practice/}) as HTMLButtonElement).disabled).toBe(false));
 mockApi.mockResolvedValueOnce({ok:false,json:async()=>({detail:'No eligible route exists'})});
 fireEvent.click(screen.getByRole('button',{name:/Start practice/}));
 await screen.findByText('No eligible route exists');
 expect(mockApi).toHaveBeenLastCalledWith('/api/challenges/custom',expect.objectContaining({body:JSON.stringify({start:'Q7251',destination:'Q35794',category:'classic'})}));
});

it('opens a dated replay and restarts the same UTC puzzle', async () => {
 history.replaceState(null, '', '/challenge?day=2026-11-11');
 const replay = {...initial, daily_date:'2026-11-11'};
 mockApi.mockImplementation(async (url:string) => ({ok:true,json:async()=>url.endsWith('collection')?{entities:[start,destination]}:replay}));
 render(<Challenge onExplore={()=>{}}/>);
 await screen.findByText(/2026-11-11 UTC/);
 expect(mockApi).toHaveBeenCalledWith('/api/challenges/daily?day=2026-11-11',expect.anything());
 expect(sessionStorage.getItem('rabbithole-challenge-v1:2026-11-11')).toBe(replay.token);
 fireEvent.click(screen.getByRole('button',{name:'Restart'}));
 await waitFor(()=>expect(mockApi.mock.calls.filter(([url])=>url.endsWith('day=2026-11-11'))).toHaveLength(2));
});
