import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { Timeline } from './Timeline';

const source = {
  subject: { id: 'Q7251', label: 'Alan Turing', description: 'Mathematician', source_url: 'https://www.wikidata.org/wiki/Q7251' },
  offline: true,
  truncated: false,
  entries: [
    { id: 'birth', label: 'Birth', date: { label: '1912', precision: 'year', calendar: 'Gregorian', raw: '+1912-00-00T00:00:00Z', uncertain: true }, statement_id: 'Q7251$birth', property_id: 'P569', source_url: 'https://www.wikidata.org/wiki/Q7251#P569', references_count: 0, related_id: null, related_label: null, relationship: null },
    { id: 'education', label: 'Start', date: { label: '1931', precision: 'year', calendar: 'Gregorian', raw: '+1931-00-00T00:00:00Z', uncertain: false }, statement_id: 'Q7251$education', property_id: 'P580', source_url: 'https://www.wikidata.org/wiki/Q7251#P69', references_count: 1, related_id: 'Q924289', related_label: "King's College", relationship: 'educated at' },
  ],
};

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('restores a saved timeline bookmark and filters relationship dates without losing source detail', async () => {
  history.replaceState(null, '', '/timeline?entity=Q7251&saved=1');
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => source }));
  vi.stubGlobal('fetch', fetcher);
  render(<Timeline/>);
  await screen.findByRole('heading', { name: 'Alan Turing' });
  expect(fetcher).toHaveBeenCalledWith('/api/entities/Q7251/timeline?offline=true', expect.anything());
  expect(screen.getByText('Date has qualifiers or uncertainty')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Show dates' }), { target: { value: 'related' } });
  expect(screen.queryByRole('heading', { name: 'Birth' })).toBeNull();
  expect(screen.getByRole('link', { name: /King's College/ }).getAttribute('href')).toBe('/?entity=Q924289');
  fireEvent.click(screen.getByText('Statement and date details'));
  expect(screen.getByRole('link', { name: /Inspect Wikidata statement/ }).getAttribute('href')).toBe('https://www.wikidata.org/wiki/Q7251#P69');
});
