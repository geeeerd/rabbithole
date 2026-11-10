import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useExploration } from './useExploration';
import { fixture } from './testFixtures';
const graphs = {Q1:fixture('Q1',['Q2']),Q2:fixture('Q2',['Q3']),Q3:fixture('Q3',['Q4'])};
function Harness() {
  const e = useExploration();
  return <><output data-testid="edges">{e.graph?.edges.map(edge=>edge.id).join(',')}</output><output data-testid="nodes">{e.graph?.nodes.map(n=>n.id).join(',')}</output><output data-testid="selected">{e.selected?.id}</output>
    <output data-testid="filter">{e.filter}</output><output data-testid="error">{e.error}</output><output data-testid="busy">{String(e.busy)}</output>
    <button onClick={()=>e.explore('Q1')}>Start</button><button onClick={()=>e.loadMore('Q1')}>More</button><button onClick={e.loadLinks}>Cross-links</button><button onClick={()=>e.explore('Q2',true)}>Expand</button>
    <button onClick={() => e.loadIncoming('Q1')}>Incoming</button>
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
it('clears a relationship filter when its last matching branch is collapsed', async () => {
  const root = { ...graphs.Q1, edges: graphs.Q1.edges.map(edge => ({ ...edge, property_id: 'P69' })) };
  vi.mocked(fetch).mockImplementation(async url => ({
    ok: true, json: async () => String(url).includes('entity=Q2') ? graphs.Q2 : root,
  }) as Response);
  history.replaceState(null, '', '/?entity=Q1&expand=Q2&filter=P361');
  render(<Harness/>);
  await waitFor(() => expect(screen.getByTestId('filter').textContent).toBe('P361'));
  fireEvent.click(screen.getByRole('button', { name: 'Collapse' }));
  expect(screen.getByTestId('filter').textContent).toBe('all');
  expect(new URLSearchParams(location.search).has('filter')).toBe(false);
});

it('opens reachable branches from a stale shared link and retries the original link', async () => {
  let changed = false;
  vi.mocked(fetch).mockImplementation(async url => {
    const id = new URL(String(url), location.origin).searchParams.get('entity');
    const graph = id === 'Q2' && !changed ? fixture('Q2', []) : graphs[id as keyof typeof graphs];
    return { ok: true, json: async () => graph } as Response;
  });
  history.replaceState(null, '', '/?entity=Q1&expand=Q2,Q3&selected=Q4');
  render(<Harness/>);
  await waitFor(() => expect(screen.getByTestId('error').textContent).toContain('no longer reachable'));
  expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2');
  expect(new URLSearchParams(location.search).get('expand')).toBe('Q2');
  changed = true;
  fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('Q4'));
  expect(new URLSearchParams(location.search).get('expand')).toBe('Q2,Q3');
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

it('adds another connection page and restores a branch reached through that page', async () => {
  const first = { ...fixture('Q1',['Q2']), next_offset: 24, truncated: true };
  const second = { ...fixture('Q1',['Q3']), next_offset: null };
  vi.mocked(fetch).mockImplementation(async (url: string | URL | Request) => {
    const params = new URL(String(url), 'http://localhost').searchParams;
    const body = params.get('entity') === 'Q3' ? fixture('Q3',['Q4']) : params.has('offset') ? second : first;
    return {ok:true,json:async()=>body} as Response;
  });
  const view = render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2'));
  fireEvent.click(screen.getByText('More'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3'));
  expect(new URLSearchParams(location.search).get('pages')).toBe('Q1:1');
  view.unmount();
  history.replaceState(null, '', '/?entity=Q1&pages=Q1:1&expand=Q3&selected=Q4');
  render(<Harness/>);
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3,Q4'));
  expect(screen.getByTestId('selected').textContent).toBe('Q4');
});

it('checks only visible topics and preserves discovered cross-links when sharing a trail', async () => {
  const first = fixture('Q1', ['Q2', 'Q3']);
  const scan = { edges: fixture('Q2',['Q3']).edges, scanned_ids: ['Q1','Q2','Q3'], offline: false,
    truncated: false, saved_edge_ids: [], fetched_at: first.fetched_at };
  vi.mocked(fetch).mockImplementation(async (url) => ({
    ok: true, json: async () => String(url).endsWith('/links') ? scan : first,
  }) as Response);
  const view = render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  await waitFor(()=>expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3'));
  fireEvent.click(screen.getByText('Cross-links'));
  await waitFor(()=>expect(screen.getByTestId('edges').textContent).toContain('Q2-Q3'));
  expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2,Q3');
  expect(new URLSearchParams(location.search).get('links')).toBe('1');
  expect(fetch).toHaveBeenCalledWith('/api/graph/links', expect.objectContaining({
    body: JSON.stringify({ topics: ['Q1','Q2','Q3'], sources: ['Q1','Q2','Q3'] }),
  }));
  view.unmount();
  history.replaceState(null, '', '/?entity=Q1&links=1');
  render(<Harness/>);
  await waitFor(()=>expect(screen.getByTestId('edges').textContent).toContain('Q2-Q3'));
});

it('follows incoming cursors and restores a branch reached through an incoming statement', async () => {
  vi.mocked(fetch).mockImplementation(async (url) => {
    const request = new URL(String(url), 'http://localhost');
    const graph = graphs[request.searchParams.get('entity') as keyof typeof graphs];
    const hasCursor = request.searchParams.get('cursor') === 'next|Q3';
    const source = fixture(hasCursor ? 'Q5' : 'Q3', ['Q1']);
    const incoming = { nodes: source.nodes.slice(0, 1), edges: source.edges,
      checked: 8, next_cursor: hasCursor ? null : 'next|Q3', fetched_at: source.fetched_at };
    return { ok: true, json: async () => request.pathname.endsWith('/incoming') ? incoming : graph } as Response;
  });
  const view = render(<Harness/>);
  fireEvent.click(screen.getByText('Start'));
  await waitFor(() => expect(screen.getByTestId('nodes').textContent).toBe('Q1,Q2'));
  fireEvent.click(screen.getByText('Incoming'));
  await waitFor(() => expect(screen.getByTestId('edges').textContent).toContain('Q3-Q1'));
  fireEvent.click(screen.getByText('Incoming'));
  await waitFor(() => expect(screen.getByTestId('edges').textContent).toContain('Q5-Q1'));
  expect(new URLSearchParams(location.search).get('incoming')).toBe('Q1:2');

  view.unmount();
  history.replaceState(null, '', '/?entity=Q1&incoming=Q1:2&expand=Q3&selected=Q4');
  render(<Harness/>);
  await waitFor(() => expect(screen.getByTestId('selected').textContent).toBe('Q4'));
  expect(screen.getByTestId('edges').textContent).toContain('Q5-Q1');
});
