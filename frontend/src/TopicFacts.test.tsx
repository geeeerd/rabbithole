import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { TopicFacts } from './TopicFacts';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('loads another page of sourced facts without losing the earlier values', async () => {
  const population = { id: 'population', label: 'Population', value: '123.45', kind: 'quantity', unit_id: 'Q5',
    unit_label: 'inhabitants', note: 'Recorded range 123.4 to 123.5', dates: ['Recorded date 2020'],
    source_url: 'https://www.wikidata.org/wiki/Q90#P1082', references_count: 1 };
  const area = { ...population, id: 'area', label: 'Area', value: '98.7', unit_label: 'square kilometres' };
  const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => ({
    facts: url.includes('offset=20') ? [area] : [population], total: 2,
    next_offset: url.includes('offset=20') ? null : 20, offline: false,
  }) }));
  vi.stubGlobal('fetch', fetcher);
  render(<TopicFacts entityId="Q90"/>);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('See recorded facts'));
  await screen.findByText('123.45 inhabitants');
  fireEvent.click(screen.getByRole('button', { name: 'More facts' }));
  await screen.findByText('98.7 square kilometres');
  expect(screen.getByText('123.45 inhabitants')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'More facts' })).toBeNull();
});
