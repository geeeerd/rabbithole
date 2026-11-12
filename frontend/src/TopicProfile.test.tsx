import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TopicProfile } from './TopicProfile';
import { fixture } from './testFixtures';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('opens a sourced profile tab from its URL and supports keyboard navigation', async () => {
  const graph = fixture('Q12418', ['Q19675']);
  graph.nodes[0].label = 'Mona Lisa';
  graph.nodes[1].label = 'Louvre Museum';
  graph.edges[0].source_url = 'https://www.wikidata.org/wiki/Q12418#P276';
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () =>
    url.includes('/timeline') ? { entries: [] }
      : url.startsWith('/api/stories/topics') ? { cover: null, stories: [{ id: 'mona-lisa-to-paris', title: 'From the Mona Lisa to Paris', step: 0 }] }
        : graph,
  })));
  history.replaceState(null, '', '/profile?entity=Q12418&tab=connections');
  render(<TopicProfile/>);
  const connections = await screen.findByRole('tab', { name: 'Connections', selected: true });
  expect(screen.queryByRole('tab', { name: 'Timeline' })).toBeNull();
  expect(within(screen.getByRole('tabpanel')).getByRole('link', { name: /Source statement/ }).getAttribute('href')).toBe(graph.edges[0].source_url);
  fireEvent.keyDown(connections, { key: 'ArrowRight' });
  const further = screen.getByRole('tab', { name: 'Explore Further', selected: true });
  expect(document.activeElement).toBe(further);
  expect(location.search).toBe('?entity=Q12418&tab=further');
  expect(screen.getByRole('link', { name: /From the Mona Lisa to Paris/ }).getAttribute('href')).toBe('/stories?story=mona-lisa-to-paris&step=0');
});
