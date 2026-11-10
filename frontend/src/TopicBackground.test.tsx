import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { TopicBackground } from './TopicBackground';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('loads only when opened and keeps contributor, revision, and license links with the excerpt', async () => {
  const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({
    title: 'Alan Turing', excerpt: 'A test introduction.', article_url: 'https://en.wikipedia.org/?curid=10',
    revision_url: 'https://en.wikipedia.org/wiki/Special:PermanentLink/20',
    contributors_url: 'https://en.wikipedia.org/w/index.php?title=Alan+Turing&action=history',
    license_url: 'https://creativecommons.org/licenses/by-sa/4.0/',
  }) }));
  vi.stubGlobal('fetch', fetcher);
  render(<TopicBackground entityId="Q7251"/>);
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('Read Wikipedia background'));
  expect(await screen.findByText('A test introduction.')).toBeTruthy();
  expect(fetcher).toHaveBeenCalledWith('/api/entities/Q7251/background', expect.anything());
  expect(screen.getByRole('link', { name: /Source revision/ }).getAttribute('href')).toContain('/20');
  expect(screen.getByRole('link', { name: /Contributors/ }).getAttribute('href')).toContain('action=history');
  expect(screen.getByRole('link', { name: /CC BY-SA/ }).getAttribute('href')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
});
