import { readFileSync } from 'node:fs';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { HistoricalBoundaries } from './HistoricalBoundaries';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('opens a dated snapshot, switches vintages and highlights a region through native controls', async () => {
  const dataset = JSON.parse(readFileSync('public/maps/connecticut-boundaries.json', 'utf8'));
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => dataset })));
  history.replaceState(null, '', '/map/boundaries?year=2023');
  const { container } = render(<HistoricalBoundaries/>);
  await screen.findByRole('img', { name: '2023 planning regions in Connecticut' });
  expect(container.querySelectorAll('.boundary-map path')).toHaveLength(9);
  fireEvent.change(screen.getByRole('combobox', { name: 'Boundary snapshot' }), { target: { value: '2020' } });
  expect(location.search).toBe('?year=2020');
  expect(container.querySelectorAll('.boundary-map path')).toHaveLength(8);
  fireEvent.change(screen.getByRole('combobox', { name: 'Highlight a region' }), { target: { value: '09001' } });
  expect(container.querySelector('.boundary-map path.selected title')?.textContent).toBe('Fairfield County');
  expect(screen.getByRole('link', { name: /Original boundary layer/ }).getAttribute('href')).toContain('Census2020');
});
