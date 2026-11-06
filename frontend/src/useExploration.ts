import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSnapshot, MAX_BRANCHES, mergeGraph, readTrail, trailUrl } from './exploration';
import type { Entity, Graph, Snapshot } from './exploration';

async function fetchGraph(id: string, signal: AbortSignal): Promise<Graph> {
  const response = await fetch('/api/graph?entity=' + encodeURIComponent(id), { signal });
  if (!response.ok) throw new Error((await response.json()).detail || 'Could not load this topic. Please retry.');
  return response.json();
}

export function useExploration(enabled = true) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const current = useRef<Snapshot | null>(null);
  const controller = useRef<AbortController | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAction, setRetryAction] = useState<(() => void) | null>(null);
  const [position, setPosition] = useState({ index: 0, end: 0 });
  const positionRef = useRef(position);

  function commit(next: Snapshot | null, push: boolean) {
    current.current = next;
    setSnapshot(next);
    if (push) {
      const index = positionRef.current.index + 1;
      positionRef.current = { index, end: index };
      setPosition(positionRef.current);
      history.pushState({ rabbitHole: true, snapshot: next, index, end: index }, '', next ? trailUrl(next.trail) : location.pathname);
    }
  }

  async function run(work: (signal: AbortSignal) => Promise<Snapshot | null>, push: boolean, retry: () => void) {
    controller.current?.abort();
    const pending = new AbortController();
    controller.current = pending;
    setBusy(true); setError(''); setRetryAction(null);
    try {
      const next = await work(pending.signal);
      if (!pending.signal.aborted) commit(next, push);
    } catch (e) {
      if (!pending.signal.aborted) {
        setError((e as Error).message);
        setRetryAction(() => retry);
      }
    } finally {
      if (!pending.signal.aborted) setBusy(false);
    }
  }

  function restoreUrl() {
    void run(async signal => {
      const trail = readTrail(location.search);
      if (!trail) return null;
      const bundles: Record<string, Graph> = { [trail.root]: await fetchGraph(trail.root, signal) };
      // Fetch only connected branches; never issue arbitrary disconnected traversals.
      const remaining = new Set(trail.expanded);
      while (remaining.size) {
        const visible = new Set(Object.values(bundles).flatMap(g => g.nodes.map(n => n.id)));
        const id = [...remaining].find(id => visible.has(id));
        if (!id) throw new Error('This exploration link contains a disconnected branch.');
        bundles[id] = await fetchGraph(id, signal);
        remaining.delete(id);
        buildSnapshot({ ...trail, expanded: Object.keys(bundles).filter(key => key !== trail.root) }, bundles);
      }
      return buildSnapshot(trail, bundles);
    }, false, restoreUrl);
  }

  useEffect(() => {
    if (!enabled) return;
    const saved = history.state;
    if (saved?.rabbitHole && saved.snapshot && trailUrl(saved.snapshot.trail) === location.search) {
      positionRef.current = { index: saved.index, end: saved.end ?? saved.index };
      setPosition(positionRef.current);
      commit(saved.snapshot, false);
    } else {
      history.replaceState({ rabbitHole: true, snapshot: null, index: 0, end: 0 }, '', location.href);
      restoreUrl();
    }
    const onPop = (event: PopStateEvent) => {
      controller.current?.abort(); setBusy(false); setError('');
      const state = event.state;
      const index = state?.rabbitHole ? state.index : 0;
      positionRef.current = { index, end: positionRef.current.end };
      setPosition(positionRef.current);
      if (state?.rabbitHole && state.snapshot) commit(state.snapshot, false);
      else restoreUrl();
    };
    window.addEventListener('popstate', onPop);
    return () => { controller.current?.abort(); window.removeEventListener('popstate', onPop); };
  }, [enabled]);

  // Store complete data in session history: Back/Forward also works offline.
  useEffect(() => {
    if (!enabled) return;
    history.replaceState({ rabbitHole: true, snapshot, index: positionRef.current.index, end: positionRef.current.end }, '', snapshot ? trailUrl(snapshot.trail) : location.href);
  }, [snapshot, enabled]);

  function explore(id: string, expand = false) {
    const previous = current.current;
    if (expand && previous && (id === previous.trail.root || previous.trail.expanded.includes(id))) return;
    const action = () => explore(id, expand);
    void run(async signal => {
      if (expand && previous && previous.trail.expanded.length >= MAX_BRANCHES) throw new Error('You reached the eight-branch limit. Collapse a branch to continue.');
      const next = await fetchGraph(id, signal);
      if (expand && previous) return buildSnapshot({ ...previous.trail, selected: id, expanded: [...previous.trail.expanded, id] }, { ...previous.bundles, [id]: next });
      return buildSnapshot({ root: id, selected: id, expanded: [], filter: 'all' }, { [id]: next });
    }, true, action);
  }

  function updateView(selected: string, filter: string) {
    if (!current.current) return;
    const next = { ...current.current, trail: { ...current.current.trail, selected, filter } };
    commit(next, false);
  }
  function collapse(id: string) {
    const previous = current.current;
    if (!previous || id === previous.trail.root) return;
    controller.current?.abort(); setBusy(false); setError('');
    commit(buildSnapshot({ ...previous.trail, expanded: previous.trail.expanded.filter(key => key !== id) }, previous.bundles), true);
  }
  function home() {
    controller.current?.abort(); setBusy(false); setError(''); commit(null, true);
  }
  const graph = useMemo(() => snapshot ? mergeGraph(snapshot) : null, [snapshot?.bundles]);
  const selected: Entity | null = graph?.nodes.find(n => n.id === snapshot?.trail.selected) || null;
  return { graph, selected, snapshot, busy, error, setError, retry: () => retryAction?.(), explore, home, collapse,
    filter: snapshot?.trail.filter || 'all',
    setSelected: (entity: Entity | null) => { if (entity && snapshot) updateView(entity.id, snapshot.trail.filter); },
    setFilter: (filter: string) => { if (snapshot) updateView(snapshot.trail.selected, filter); },
    canBack: position.index > 0, canForward: position.index < position.end };
}
