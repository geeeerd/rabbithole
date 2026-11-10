import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SearchBox } from './SearchBox';
const results=[{id:'Q7251',label:'Alan Turing',description:'Computer scientist',source_url:''},{id:'Q7259',label:'Ada Lovelace',description:'Mathematician',source_url:''}];
beforeEach(()=>vi.stubGlobal('fetch',vi.fn(async()=>({ok:true,json:async()=>({results,offline:false})}))));
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('supports combobox arrow navigation, Enter selection and Escape dismissal',async()=>{
 const choose=vi.fn();render(<SearchBox onSelect={choose}/>);
 const input=screen.getByRole('combobox');fireEvent.focus(input);input.focus();fireEvent.change(input,{target:{value:'Al'}});
 await screen.findByRole('option',{name:/Alan Turing/});
 expect(input.getAttribute('aria-expanded')).toBe('true');
 fireEvent.keyDown(input,{key:'ArrowDown'});fireEvent.keyDown(input,{key:'ArrowDown'});
 expect(screen.getByRole('option',{name:/Ada Lovelace/}).getAttribute('aria-selected')).toBe('true');
 fireEvent.keyDown(input,{key:'Enter'});
 expect(choose).toHaveBeenCalledWith('Q7259');
 expect((input as HTMLInputElement).value).toBe('');
 fireEvent.change(input,{target:{value:'Alan'}});await screen.findByRole('option',{name:/Alan Turing/});
 fireEvent.keyDown(input,{key:'Escape'});fireEvent.keyDown(input,{key:'Enter'});
 expect(input.getAttribute('aria-expanded')).toBe('false');expect(choose).toHaveBeenCalledTimes(1);
});
it('announces empty/error states and retries a failed query',async()=>{
 vi.mocked(fetch).mockRejectedValueOnce(new Error('unavailable'));
 render(<SearchBox onSelect={()=>{}}/>);const input=screen.getByRole('combobox');input.focus();fireEvent.change(input,{target:{value:'Alan'}});
 await screen.findByText(/Search is temporarily unavailable/);
 vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({results:[],offline:true})} as Response);
 fireEvent.click(screen.getByRole('button',{name:'Retry search'}));
 await screen.findByText('No topics found. Try another name.');
});
it('ignores stale responses even when a fetch implementation does not honor cancellation',async()=>{
 let resolve!:(r:Response)=>void;
 vi.mocked(fetch).mockImplementationOnce(()=>new Promise(r=>resolve=r));
 render(<SearchBox onSelect={()=>{}}/>);const input=screen.getByRole('combobox');input.focus();fireEvent.change(input,{target:{value:'Old'}});
 await waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
 fireEvent.change(input,{target:{value:'Ada'}});
 await screen.findByRole('option',{name:/Ada Lovelace/});
 await act(async()=>resolve({ok:true,json:async()=>({results:[{...results[0],label:'Stale topic'}],offline:false})} as Response));
 expect(screen.queryByRole('option',{name:/Stale topic/})).toBeNull();
});
