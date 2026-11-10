import { useEffect, useRef, useState } from 'react';
import { MAX_NODES, readTrail, trailUrl } from './exploration';

const storageKey = 'rabbithole-trails-v1';
const maxTrails = 30;

type SavedTrail = { query: string; title: string; topics: number };

function readSavedTrails(): SavedTrail[] {
  let stored: unknown;
  try { stored = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); } catch { return []; }
  if (!Array.isArray(stored)) return [];
  const trails = new Map<string, SavedTrail>();
  for (const item of stored.slice(0, maxTrails)) {
    if (!item || typeof item.title !== 'string' || !item.title.trim() ||
        typeof item.query !== 'string' || item.query.length > 1500 ||
        !Number.isInteger(item.topics) || item.topics < 1 || item.topics > MAX_NODES) continue;
    try {
      const trail = readTrail(item.query);
      if (!trail) continue;
      const query = trailUrl(trail);
      trails.set(query, { query, title: item.title.slice(0, 200), topics: item.topics });
    } catch {
      continue;
    }
  }
  return [...trails.values()];
}

export function useSavedTrails() {
  const [trails, setTrails] = useState(readSavedTrails);
  useEffect(() => {
    const refresh = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setTrails(readSavedTrails());
    };
    window.addEventListener('storage', refresh);
    return () => window.removeEventListener('storage', refresh);
  }, []);

  function write(trails: SavedTrail[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(trails));
      setTrails(trails);
      return true;
    } catch {
      return false;
    }
  }

  function save(trail: SavedTrail) {
    const current = readSavedTrails();
    if (current.some(item => item.query === trail.query)) return 'This trail is already saved.';
    if (current.length >= maxTrails) return 'You can save up to 30 trails. Remove one from Saved Trails to make room.';
    return write([trail, ...current]) ? 'Trail saved in this browser.' : 'This browser could not save the trail.';
  }

  function remove(query: string) {
    return write(readSavedTrails().filter(trail => trail.query !== query));
  }

  return { trails, save, remove };
}

export function SavedTrails({ trails, onRemove }: { trails: SavedTrail[]; onRemove: (query: string) => boolean }) {
  const [notice, setNotice] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);

  function remove(trail: SavedTrail) {
    if (onRemove(trail.query)) {
      setNotice(`Removed ${trail.title}.`);
      heading.current?.focus();
    } else {
      setNotice('This browser could not remove the trail.');
    }
  }

  return <section className="saved-trails" aria-labelledby="saved-trails-title">
    <h1 id="saved-trails-title" ref={heading} tabIndex={-1}>Saved Trails</h1>
    <p>Your saved explorations live in this browser. Reopening a trail loads its topics and connections from current data.</p>
    {trails.length ? <ul>
      {trails.map(trail => <li key={trail.query}>
        <div>
          <a href={'/' + trail.query}>{trail.title}</a>
          <small>{trail.topics} {trail.topics === 1 ? 'topic' : 'topics'} when saved</small>
        </div>
        <button type="button" aria-label={`Remove ${trail.title}`} onClick={() => remove(trail)}>Remove</button>
      </li>)}
    </ul> : <p>No trails saved yet. Open a topic and use <strong>Save trail</strong> to keep your exploration.</p>}
    <a className="source" href="/">Explore topics ↗</a>
    <p role="status">{notice}</p>
  </section>;
}
