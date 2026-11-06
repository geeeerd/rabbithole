export type Entity = { id: string; label: string; description: string; source_url: string };
export type Edge = { id: string; source: string; target: string; label: string; property_id: string; references: unknown[]; qualifiers: Record<string, unknown>; source_url: string };
export type Graph = { nodes: Entity[]; edges: Edge[]; root_id: string; offline: boolean; truncated: boolean; fetched_at: string };
export type Trail = { root: string; expanded: string[]; selected: string; filter: string };
export type Snapshot = { trail: Trail; bundles: Record<string, Graph> };
export const MAX_NODES = 60;
export const MAX_BRANCHES = 8;
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
  return { root, expanded: expanded.filter(id => id !== root), selected, filter };
}

export function trailUrl(trail: Trail): string {
  const params = new URLSearchParams({ entity: trail.root });
  if (trail.expanded.length) params.set('expand', trail.expanded.join(','));
  if (trail.selected !== trail.root) params.set('selected', trail.selected);
  if (trail.filter !== 'all') params.set('filter', trail.filter);
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
  if (visible.size > MAX_NODES) throw new Error('You reached the 60-topic limit. Collapse a branch or recenter to continue.');
  const expanded = trail.expanded.filter(id => active.has(id) && id !== trail.root);
  const selected = visible.has(trail.selected) ? trail.selected : trail.root;
  return { trail: { ...trail, expanded, selected }, bundles: Object.fromEntries([...active].map(id => [id, bundles[id]])) };
}

export function mergeGraph(snapshot: Snapshot): Graph {
  const graphs = Object.values(snapshot.bundles);
  return {
    root_id: snapshot.trail.root,
    nodes: [...new Map(graphs.flatMap(g => g.nodes).map(n => [n.id, n])).values()],
    edges: [...new Map(graphs.flatMap(g => g.edges).map(e => [e.id, e])).values()],
    offline: graphs.some(g => g.offline), truncated: graphs.some(g => g.truncated),
    fetched_at: graphs.map(g => g.fetched_at).sort()[0],
  };
}
