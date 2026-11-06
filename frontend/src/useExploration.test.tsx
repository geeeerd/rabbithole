import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useExploration } from './useExploration';
import { fixture } from './testFixtures';
const graphs = {Q1:fixture('Q1',['Q2']),Q2:fixture('Q2',['Q3']),Q3:fixture('Q3',['Q4'])};
function Harness() {
  const e = useExploration();
  return <><output data-testid="nodes">{e.graph?.nodes.map(n=>n.id).join(',')}</output><output data-testid="selected">{e.selected?.id}</output>
    <output data-testid="filter">{e.filter}</output><output data-testid="error">{e.error}</output><output data-testid="busy">{String(e.busy)}</output>
    <button onClick={()=>e.explore('Q1')}>Start</button><button onClick={()=>e.explore('Q2',true)}>Expand</button>
    <button onClick={()=>e.collapse('Q2')}>Collapse</button><button onClick={()=>e.home()}>Home</button>
    <button onClick={()=>e.setFilter('P361')}>Filter</button><button onClick={e.retry}>Retry</button>
  </>;
}
beforeEach(()=>{
  history.replaceState(null,'','/');
  vi.stubGlobal('fetch',vi.fn(async (url:string)=>({ok:true,json:async()=>graphs[new URL(url,'http://localhost').searchParams.get('entity') as keyof typeof graphs]})));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals()});
it('expands, collapses, and updates the shareable address',async()=>{
  render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2'));
  fireEvent.click(screen.getByText('Expand'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3'));
  expect(location.search).toContain('expand=Q2');
  fireEvent.click(screen.getByText('Filter'));
  expect(location.search).toContain('filter=P361');
  fireEvent.click(screen.getByText('Collapse'));
  expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2');
  expect(location.search).not.toContain('expand=');
});
it('restores complete branches and view settings from a fresh URL',async()=>{
  history.replaceState(null,'','/?entity=Q1&expand=Q2&selected=Q3&filter=P361');
  render(<Harness/>);
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3'));
  expect(screen.getByTestId('selected').textContent).toBe('Q3');
  expect(screen.getByTestId('filter').textContent).toBe('P361');
});
it('restores session history from saved data without upstream calls',async()=>{
  render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2'));
  const saved = history.state;
  fireEvent.click(screen.getByText('Expand'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3'));
  vi.mocked(fetch).mockClear();
  act(()=>{history.replaceState(saved,'','/?entity=Q1');window.dispatchEvent(new PopStateEvent('popstate',{state:saved}))});
  expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2');
  expect(fetch).not.toHaveBeenCalled();
});
it('does not let an interrupted request reopen a graph after going home',async()=>{
  let resolve!: (response: Response)=>void;
  vi.mocked(fetch).mockImplementationOnce(()=>new Promise(r=>{resolve=r}));
  render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  fireEvent.click(screen.getByText('Home'));
  await act(async()=>resolve({ok:true,json:async()=>graphs.Q1} as Response));
  expect(screen.getByTestId('nodes').textContent).toBe('');
  expect(screen.getByTestId('busy').textContent).toBe('false');
});
it('retries a failed branch expansion without discarding the current graph',async()=>{
  render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2'));
  vi.mocked(fetch).mockRejectedValueOnce(new Error('Temporary failure'));
  fireEvent.click(screen.getByText('Expand'));
  await waitFor(()=>expect(screen.getByTestId('error').textContent).toBe('Temporary failure'));
  expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2');
  fireEvent.click(screen.getByText('Retry'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3'));
});
it('keeps session-history controls and graph data when remounting after reload',async()=>{
  const view = render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2'));
  fireEvent.click(screen.getByText('Expand'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3'));
  const index = history.state.index;
  view.unmount();
  vi.mocked(fetch).mockClear();
  render(<Harness/>);
  expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3');
  expect(history.state.index).toBe(index);
  expect(fetch).not.toHaveBeenCalled();
});
