import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HistoricalBoundaries } from './HistoricalBoundaries';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('opens a dated snapshot, switches vintages and highlights a region through native controls', async () => {
  const region = (id: string, name: string) => ({
    id, name, polygons: [[[[-73.8, 41], [-73.2, 41], [-73.2, 41.5], [-73.8, 41]]]],
  });
  const dataset = {
    scope: 'Connecticut, United States', source: 'Census', license: 'Public domain',
    license_url: 'https://example.org/license', notice_url: 'https://example.org/notice', uncertainty: 'Generalized geometry.',
    snapshots: [
      { year: '2020', label: '2020 Census counties', date: '2020-01-01', source_url: 'https://example.org/Census2020',
        regions: [region('09001', 'Fairfield County')] },
      { year: '2023', label: '2023 planning regions', date: '2023-01-01', source_url: 'https://example.org/ACS2023',
        regions: [region('09120', 'Greater Bridgeport Planning Region'), region('09190', 'Western Connecticut Planning Region')] },
    ],
  };
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => dataset })));
  history.replaceState(null, '', '/map/boundaries?year=2023');
  const { container } = render(<HistoricalBoundaries/>);
  await screen.findByRole('img', { name: '2023 planning regions in Connecticut' });
  expect(container.querySelectorAll('.boundary-map path')).toHaveLength(2);
  fireEvent.change(screen.getByRole('combobox', { name: 'Boundary snapshot' }), { target: { value: '2020' } });
  expect(location.search).toBe('?year=2020');
  expect(container.querySelectorAll('.boundary-map path')).toHaveLength(1);
  fireEvent.change(screen.getByRole('combobox', { name: 'Highlight a region' }), { target: { value: '09001' } });
  expect(container.querySelector('.boundary-map path.selected title')?.textContent).toBe('Fairfield County');
  expect(screen.getByRole('link', { name: /Original boundary layer/ }).getAttribute('href')).toContain('Census2020');
});
