import { useEffect, useMemo, useRef, useState } from 'react';
import { buildSnapshot, MAX_BRANCHES, MAX_EXTRA_PAGES, MAX_INCOMING_PAGES, MAX_LINK_SCANS, LINK_SOURCE_LIMIT, mergeGraph, mergeIncoming, mergePage, pageCount, readTrail, trailUrl } from './exploration';
import type { ConnectionOptions, Entity, Graph, IncomingPage, LinkScan, Snapshot } from './exploration';

async function fetchGraph(id: string, signal: AbortSignal, offset?: number): Promise<Graph> {
  const params = new URLSearchParams({ entity: id });
  if (offset !== undefined) params.set('offset', String(offset));
  const response = await fetch('/api/graph?' + params, { signal });
  if (!response.ok) throw new Error((await response.json()).detail || 'Could not load this topic. Please retry.');
  return response.json();
}

function nextSources(topics: string[], scans: LinkScan[]) {
  const scanned = new Set(scans.flatMap(scan => scan.scanned_ids));
  return topics.filter(id => !scanned.has(id)).sort().slice(0, LINK_SOURCE_LIMIT);
}

async function fetchIncoming(id: string, signal: AbortSignal, cursor?: string): Promise<IncomingPage> {
  const query = cursor ? '?' + new URLSearchParams({ cursor }) : '';
  const response = await fetch(`/api/entities/${id}/incoming${query}`, { signal });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Could not check incoming connections.');
  return result;
}

async function scanLinks(snapshot: Snapshot, signal: AbortSignal): Promise<Snapshot> {
  const topics = mergeGraph(snapshot).nodes.map(node => node.id);
  const scans = snapshot.links ?? [];
  const sources = nextSources(topics, scans);
  if (topics.length < 2 || !sources.length || scans.length >= MAX_LINK_SCANS) return snapshot;
  const response = await fetch('/api/graph/links', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: JSON.stringify({ topics, sources }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Could not check these topics for links.');
  const links = [...scans, result as LinkScan];
  return { ...snapshot, links, trail: { ...snapshot.trail, linkScans: links.length } };
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
    if (next && next.trail.filter !== 'all') {
      const filter = next.trail.filter;
      const sources = [...Object.values(next.bundles), ...(next.links ?? [])];
      if (!sources.some(source => source.edges.some(edge => edge.property_id === filter))) {
        next = { ...next, trail: { ...next.trail, filter: 'all' } };
      }
    }
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

  function restoreUrl(search = location.search) {
    if (!search) {
      commit(null, false);
      return;
    }
    const retry = () => restoreUrl(search);
    void run(async signal => {
      const trail = readTrail(search);
      if (!trail) return null;
      const bundles: Record<string, Graph> = {};
    const pages: Record<string, number> = {};
    const incoming: Record<string, number> = {};
    const load = async (id: string) => {
      let bundle = await fetchGraph(id, signal);
      const count = trail.pages?.[id] ?? 0;
      for (let index = 0; index < count && bundle.next_offset != null; index++) {
        bundle = mergePage(bundle, await fetchGraph(id, signal, bundle.next_offset));
        pages[id] = index + 1;
      }
      for (let index = 0; index < (trail.incoming?.[id] ?? 0) && bundle.incoming_cursor !== null; index++) {
        bundle = mergeIncoming(bundle, await fetchIncoming(id, signal, bundle.incoming_cursor));
        incoming[id] = index + 1;
      }
      bundles[id] = bundle;
    };
    await load(trail.root);
    const remaining = new Set(trail.expanded);
    while (remaining.size) {
      const visible = new Set(Object.values(bundles).flatMap(g => g.nodes.map(n => n.id)));
      const id = [...remaining].find(id => visible.has(id));
      if (!id) break;
      await load(id);
      remaining.delete(id);
      buildSnapshot({ ...trail, expanded: Object.keys(bundles).filter(key => key !== trail.root), pages, incoming }, bundles);
    }
    let snapshot = buildSnapshot({ ...trail, pages, incoming }, bundles);
    for (let index = 0; index < (trail.linkScans ?? 0); index++) {
      try {
        const next = await scanLinks(snapshot, signal);
        if (next === snapshot) break;
        snapshot = next;
      } catch (failure) {
        if (signal.aborted) throw failure;
        setError('Some cross-links could not be restored. The rest of your trail is available.');
        setRetryAction(() => loadLinks);
        break;
      }
    }
    if (remaining.size && !signal.aborted) {
      setError('Some branches are no longer reachable from the loaded connections. The available part of your trail is open.');
      setRetryAction(() => retry);
    }
    return snapshot;
    }, false, retry);
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

  function explore(id: string, expand = false, target?: string) {
    const previous = current.current;
    if (expand && previous && (id === previous.trail.root || previous.trail.expanded.includes(id))) return;
    const action = () => explore(id, expand, target);
    void run(async signal => {
      if (expand && previous && previous.trail.expanded.length >= MAX_BRANCHES) throw new Error('You reached the eight-branch limit. Collapse a branch to continue.');
      const next = await fetchGraph(id, signal);
      if (expand && previous) return buildSnapshot({ ...previous.trail, selected: id, expanded: [...previous.trail.expanded, id] }, { ...previous.bundles, [id]: next });
      return buildSnapshot({ root: id, selected: id, expanded: [], filter: 'all', target }, { [id]: next });
    }, true, action);
  }

  function loadMore(id: string) {
    const previous = current.current;
    const bundle = previous?.bundles[id];
    const offset = bundle?.next_offset;
    if (!previous || !bundle || offset == null) return;
    const pages = previous.trail.pages ?? {};
    void run(async signal => {
      if (pageCount(pages) >= MAX_EXTRA_PAGES) throw new Error('This trail has reached its page limit. Recenter a topic or collapse a branch to continue.');
      const next = await fetchGraph(id, signal, offset);
      return buildSnapshot({ ...previous.trail, pages: { ...pages, [id]: (pages[id] ?? 0) + 1 } },
        { ...previous.bundles, [id]: mergePage(bundle, next) });
    }, true, () => loadMore(id));
  }

  function loadIncoming(id: string) {
    const previous = current.current;
    const bundle = previous?.bundles[id];
    if (!previous || !bundle || bundle.incoming_cursor === null) return;
    const incoming = previous.trail.incoming ?? {};
    if (pageCount(incoming) >= MAX_INCOMING_PAGES) return;
    const cursor = bundle.incoming_cursor;
    void run(async signal => {
      const page = await fetchIncoming(id, signal, cursor);
      return buildSnapshot({ ...previous.trail, incoming: { ...incoming, [id]: (incoming[id] ?? 0) + 1 } },
        { ...previous.bundles, [id]: mergeIncoming(bundle, page) });
    }, true, () => loadIncoming(id));
  }

  function loadLinks() {
    const previous = current.current;
    if (!previous) return;
    void run(signal => scanLinks(previous, signal), true, loadLinks);
  }

  function updateView(selected: string, filter: string) {
    if (!current.current) return;
    const next = { ...current.current, trail: { ...current.current.trail, selected, filter } };
    commit(next, false);
  }
  function setConnectionTarget(target?: string) {
    const previous = current.current;
    if (!previous || busy || target === previous.trail.root || target === previous.trail.target) return;
    commit({ ...previous, trail: { ...previous.trail, target, ...(!target && { arrowsOnly: undefined, deep: undefined }) } }, true);
  }
  function setConnectionOptions(options: ConnectionOptions) {
    const previous = current.current;
    if (!previous?.trail.target || busy) return;
    commit({ ...previous, trail: { ...previous.trail, ...options } }, true);
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
  const graph = useMemo(() => snapshot ? mergeGraph(snapshot) : null, [snapshot?.bundles, snapshot?.links]);
  const selected: Entity | null = graph?.nodes.find(n => n.id === snapshot?.trail.selected) || null;
  const scans = snapshot?.links ?? [];
  const checkedTopics = new Set(scans.flatMap(scan => scan.scanned_ids)).size;
  const canLoadLinks = !!graph && graph.nodes.length >= 2 && scans.length < MAX_LINK_SCANS
    && nextSources(graph.nodes.map(node => node.id), scans).length > 0;
  return { graph, selected, snapshot, busy, error, setError, loadLinks, checkedTopics, canLoadLinks, retry: () => retryAction?.(), explore, loadMore, loadIncoming, home, collapse, setConnectionTarget, setConnectionOptions,
    filter: snapshot?.trail.filter || 'all',
    setSelected: (entity: Entity | null) => { if (entity && snapshot) updateView(entity.id, snapshot.trail.filter); },
    setFilter: (filter: string) => { if (snapshot) updateView(snapshot.trail.selected, filter); },
    canBack: position.index > 0, canForward: position.index < position.end };
}
