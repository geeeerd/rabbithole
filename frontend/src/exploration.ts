export type Entity = { id: string; label: string; description: string; source_url: string };
export type Edge = { id: string; source: string; target: string; label: string; property_id: string; references: unknown[]; qualifiers: Record<string, unknown>; source_url: string };
export type Graph = { nodes: Entity[]; edges: Edge[]; root_id: string; offline: boolean; truncated: boolean; fetched_at: string; next_offset?: number | null; total_statements?: number | null; saved_edge_ids?: string[] };
export type Trail = { root: string; expanded: string[]; selected: string; filter: string; pages?: Record<string, number>; linkScans?: number };
export type LinkScan = { edges: Edge[]; scanned_ids: string[]; saved_edge_ids: string[]; offline: boolean; truncated: boolean; fetched_at: string };
export type Snapshot = { trail: Trail; bundles: Record<string, Graph>; links?: LinkScan[] };
export const MAX_NODES = 100;
export const MAX_BRANCHES = 8;
export const MAX_EXTRA_PAGES = 6;
export const MAX_LINK_SCANS = 4;
export const LINK_SOURCE_LIMIT = 8;
const validId = (value: string) => /^Q[1-9][0-9]{0,11}$/.test(value);

export function readTrail(search: string): Trail | null {
  const params = new URLSearchParams(search);
  const root = params.get('entity');
  if (!root) return null;
  if (!validId(root)) throw new Error('This exploration link has an invalid topic.');
  const expanded = [...new Set((params.get('expand') || '').split(',').filter(Boolean))];
  if (expanded.length > MAX_BRANCHES || expanded.some(id => !validId(id))) throw new Error('This exploration link has too many branches or an invalid topic.');
  const selected = params.get('selected') || root;
  const filter = params.get('filter') || 'all';
  if (!validId(selected) || (filter !== 'all' && !/^P[1-9][0-9]*$/.test(filter))) throw new Error('This exploration link has invalid view settings.');
  const pages: Record<string, number> = {};
  let pageCount = 0;
  for (const part of (params.get('pages') || '').split(',').filter(Boolean)) {
    const [id, count, extra] = part.split(':');
    if (extra !== undefined || !validId(id) || (id !== root && !expanded.includes(id)) || id in pages || !/^[1-6]$/.test(count)) {
      throw new Error('This exploration link has invalid connection pages.');
    }
    pages[id] = Number(count);
    pageCount += pages[id];
  }
  if (pageCount > MAX_EXTRA_PAGES) throw new Error('This exploration link has too many connection pages.');
  const linkScans = Number(params.get('links') ?? 0);
  if (!Number.isInteger(linkScans) || linkScans < 0 || linkScans > MAX_LINK_SCANS) {
    throw new Error('This exploration link has too many cross-link checks.');
  }
  return { root, expanded: expanded.filter(id => id !== root), selected, filter,
    ...(pageCount ? { pages } : {}), ...(linkScans ? { linkScans } : {}) };

}

export function trailUrl(trail: Trail): string {
  const params = new URLSearchParams({ entity: trail.root });
  if (trail.expanded.length) params.set('expand', trail.expanded.join(','));
  if (trail.selected !== trail.root) params.set('selected', trail.selected);
  if (trail.filter !== 'all') params.set('filter', trail.filter);
  const pages = Object.entries(trail.pages ?? {}).map(([id,count]) => `${id}:${count}`);
  if (pages.length) params.set('pages', pages.join(','));
  if (trail.linkScans) params.set('links', String(trail.linkScans));
  return '?' + params.toString();
}

// Keep only expansions reachable from the root. Shared neighbors survive collapse.
export function buildSnapshot(trail: Trail, bundles: Record<string, Graph>): Snapshot {
  if (!bundles[trail.root]) throw new Error('The starting topic is unavailable.');
  const active = new Set([trail.root]);
  const visible = new Set(bundles[trail.root].nodes.map(n => n.id));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of trail.expanded) {
      if (visible.has(id) && !active.has(id) && bundles[id]) {
        active.add(id);
        for (const node of bundles[id].nodes) visible.add(node.id);
        changed = true;
      }
    }
  }
  if (visible.size > MAX_NODES) throw new Error('You reached the 100-topic limit. Collapse a branch or recenter to continue.');
  const expanded = trail.expanded.filter(id => active.has(id) && id !== trail.root);
  const selected = visible.has(trail.selected) ? trail.selected : trail.root;
  const { pages, linkScans: _linkScans, ...base } = trail;
  const visiblePages = Object.fromEntries(Object.entries(pages ?? {}).filter(([id]) => active.has(id)));
  return {
    trail: { ...base, expanded, selected, ...(Object.keys(visiblePages).length ? { pages: visiblePages } : {}) },
    bundles: Object.fromEntries([...active].map(id => [id, bundles[id]])),
  };
}

function combine(graphs: Graph[], root: string): Graph {
  const nodes = new Map<string, Entity>();
  const edges = new Map<string, { edge: Edge; saved: boolean }>();
  for (const graph of graphs) {
    const savedIds = new Set(graph.saved_edge_ids ?? []);
    for (const node of graph.nodes) {
      if (!nodes.has(node.id) || node.label !== node.id) nodes.set(node.id, node);
    }
    for (const edge of graph.edges) {
      const saved = savedIds.has(edge.id);
      if (!edges.has(edge.id) || !saved || edges.get(edge.id)?.saved) edges.set(edge.id, { edge, saved });
    }
  }
  return {
    root_id: root,
    nodes: [...nodes.values()],
    edges: [...edges.values()].map(({ edge }) => edge),
    saved_edge_ids: [...edges.values()].filter(({ saved }) => saved).map(({ edge }) => edge.id),
    offline: graphs.every(g => g.offline),
    truncated: graphs.some(g => g.truncated),
    fetched_at: graphs.map(g => g.fetched_at).sort()[0],
  };
}

export function mergeGraph(snapshot: Snapshot): Graph {
  const bundles = Object.values(snapshot.bundles);
  const links = (snapshot.links ?? []).map(scan => ({
    ...scan, nodes: [], root_id: snapshot.trail.root, truncated: false,
  }));
  return combine([...bundles, ...links], snapshot.trail.root);
}

export function mergePage(current: Graph, page: Graph): Graph {
  return { ...combine([current, page], current.root_id), next_offset: page.next_offset,
    total_statements: page.total_statements, truncated: page.truncated };
}
