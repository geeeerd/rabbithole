# Architecture

React/TypeScript → Vite `/api` proxy → FastAPI → bounded HTTPX requests → Wikimedia Action API.

The graph renderer uses stable Q identifiers for nodes and statement IDs for edges. Data is normalized server-side. Property allowlisting excludes generic instance-of edges. Direction, references and qualifiers are preserved. The client merges by ID and limits visible nodes to 60. Responses return at most 12 relationships. No reverse relationships are invented.

Upstream responses are cached for an hour in a bounded process-local cache. On upstream failure, checked-in entity snapshots provide a small offline neighborhood. Cache and persistent storage are separate concerns: no database is needed yet. PostgreSQL migrations should be introduced when curated stories and challenges require durable records.

Search requests are cancelled when the query changes. Exploration responses use request tokens to prevent stale requests from overwriting newer navigation. Every edge is inspectable through both the graph and an accessible list.

## Exploration continuity

`frontend/src/exploration.ts` owns the typed trail model and URL codec. A trail has a root, up to eight expanded topics, selection and relationship filter. Each expanded topic owns a neighborhood bundle. Collapsing a branch rebuilds reachability from the root, preserving shared nodes and removing unreachable descendant expansions; cycles terminate through visited sets. Node and edge maps deduplicate stable IDs. The 60-node limit applies to the union before any state is committed.

`useExploration.ts` manages atomic loading, request cancellation and browser history snapshots. Branch updates push history entries; selection and filtering replace the current view. Back/Forward restore saved data without API calls. Fresh shared links fetch connected neighborhoods sequentially, respecting limits and failing visibly if a branch is no longer reconstructible. A failed expansion keeps the previous graph and retries the same operation. Going home aborts pending loads. Share links preserve exploration choices, not a permanent copy of Wikidata statements or graph positions.

## Connection Challenge

The challenge router builds a deterministic, versioned graph from the bundled Wikidata records, restricted to directed P69 (educated at) and P361 (part of) statements. It never performs live traversal. Breadth-first search validates solvability and chooses hints only within this finite graph. The daily starter uses Turing → King's College → Cambridge; the allowed property set excludes Turing's direct employer relationship, making the starter a two-step puzzle in the declared graph.

Progress is a signed, expiring token containing the fixed graph version, endpoints, actual statement IDs, hint count and expiry. Each action checks the signature, graph version, expiry and path continuity. Completion is derived server-side. HMAC keys come from `CHALLENGE_SIGNING_KEY` or a random process key. Local browser session storage retains only the token, which is revalidated on mount. Tokens can be replayed, and claims are not ranked against other users.

The challenge UI lives at `/challenge`, separate from exploration URL/history state. It supports dead-end recovery, hints, undo, restart, practice pairs, source review and copying a result. Existing tests cover expiry, altered tokens, reversed moves, invalid pairs, complete playthroughs without upstream calls, hint accounting, recovery and frontend submission behavior.

## Discovery Stories

`data/stories/catalog.json` stores publication status, narratives, ordered entities, exact transition statement IDs, additional source links and portrait attribution. `stories.py` validates that each transition belongs to its source and points to the next entity before exposing published content. Frontend chapters use `/stories?story=<id>&step=<zero-based-index>`, restore browser history, clamp invalid chapter indices and move keyboard focus to the chapter heading. Stories have a separate route so explorer history cannot overwrite their URLs.

Public-domain portraits are served locally with attribution rather than fetched at reading time. Wikidata descriptions, original editorial text and external institutional sources remain distinct. The challenge dataset is pinned to its own manifest so adding unrelated story seeds does not change the challenge graph or invalidate tokens.

## Frontend loading and accessibility

The application shell (`App.tsx`) owns routing and explorer composition. SearchBox owns an ARIA combobox with cancellable requests and keyboard selection. Cytoscape is isolated in a lazy GraphCanvas module; graph, story and challenge modules are not initial-page dependencies. Renderer instances persist across profile selection, and callbacks read current props. The graph keyboard handler and native topic lists share the same selection operation. A graph-specific error boundary preserves the lists if its module fails. Bundle-manifest checks enforce the initial-JavaScript budget. See `accessibility.md` for the scope and limits of validation.
