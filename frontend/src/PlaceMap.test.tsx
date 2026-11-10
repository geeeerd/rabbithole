import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { PlaceMap } from './PlaceMap';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('opens a saved map, selects a place by keyboard and exposes its coordinate source', async () => {
  history.replaceState(null, '', '/map?entity=Q90&saved=1');
  const paris = { id: 'Q90', label: 'Paris', description: 'Capital city', source_url: 'https://www.wikidata.org/wiki/Q90' };
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({
    subject: paris, offline: true, missing_count: 0, truncated: false,
    points: [{ entity: paris, relationships: [], coordinate: { latitude: 48.85, longitude: 2.35,
      precision: 0.01, source_url: paris.source_url + '#P625', statement_id: 'Q90$coordinate', references_count: 1 } }],
  }) }));
  vi.stubGlobal('fetch', fetcher);
  render(<PlaceMap/>);
  const pin = await screen.findByRole('button', { name: 'Select Paris' });
  fireEvent.keyDown(pin, { key: 'Enter' });
  expect(pin.getAttribute('aria-pressed')).toBe('true');
  expect(fetcher).toHaveBeenCalledWith('/api/entities/Q90/places?offline=true', expect.anything());
  expect(screen.getByRole('link', { name: /Coordinate statement/ }).getAttribute('href')).toBe(paris.source_url + '#P625');
  fireEvent.click(screen.getByRole('button', { name: /Focus selected place/ }));
  expect(screen.getByRole('group', { name: /World map/ }).getAttribute('viewBox')).toMatch(/200 100$/);
});
