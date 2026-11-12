# Architecture

React/TypeScript → Vite `/api` proxy → FastAPI → bounded HTTPX requests → Wikimedia Action API.

The graph renderer uses stable Q identifiers for nodes and statement IDs for edges. Data is normalized server-side. Graph pages preserve direction, references and qualifiers for item-valued statements. The client merges by ID and limits visible nodes to 100. Incoming saved links retain the original direction.

Upstream responses are cached for an hour in a bounded process-local cache. On upstream failure, checked-in entity snapshots provide a small offline neighborhood. Cache and persistent storage are separate concerns: no database is needed yet. PostgreSQL migrations should be introduced when curated stories and challenges require durable records.

Search requests are cancelled when the query changes. Exploration responses use request tokens to prevent stale requests from overwriting newer navigation. Every edge is inspectable through both the graph and an accessible list.

## Exploration continuity

`frontend/src/exploration.ts` owns the typed trail model and URL codec. A trail has a root, up to eight expanded topics, selection and relationship filter. Each expanded topic owns a neighborhood bundle. Collapsing a branch rebuilds reachability from the root, preserving shared nodes and removing unreachable descendant expansions; cycles terminate through visited sets. Node and edge maps deduplicate stable IDs. The 100-node limit applies to the union before any state is committed. A shared trail can restore up to six extra pages as well as expanded branches.

`useExploration.ts` manages atomic loading, request cancellation and browser history snapshots. Branch updates push history entries; selection and filtering replace the current view. Back/Forward restore saved data without API calls. Fresh shared links fetch connected neighborhoods sequentially, respecting limits and failing visibly if a branch is no longer reconstructible. A failed expansion keeps the previous graph and retries the same operation. Going home aborts pending loads. Share links preserve exploration choices, not a permanent copy of Wikidata statements or graph positions.

## Connection Challenge

Each challenge collection builds a deterministic, versioned directed graph from bundled Wikidata records. A manifest defines its eligible topics and relationship types. Breadth-first search verifies that a daily puzzle takes at least two moves and computes hints within that collection. Startup checks the reviewed story endpoints and statement IDs against the graph. Dated UTC schedules in `data/challenges/rotation.json` preserve replay dates when new puzzles join the rotation. The classic graph retains its original version so existing progress can still verify with the same signing key.

Progress is a signed, expiring token containing the fixed graph version, endpoints, actual statement IDs, hint count and expiry. Each action checks the signature, graph version, expiry and path continuity. Completion is derived server-side. HMAC keys come from `CHALLENGE_SIGNING_KEY` or a random process key. Local browser session storage retains only the token, which is revalidated on mount. Tokens can be replayed, and claims are not ranked against other users.

The challenge UI lives at `/challenge`, separate from exploration URL/history state. It supports dead-end recovery, hints, undo, restart, practice pairs, source review and copying a result. Existing tests cover expiry, altered tokens, reversed moves, invalid pairs, complete playthroughs without upstream calls, hint accounting, recovery and frontend submission behavior.

## Discovery Stories

`data/stories/catalog.json` stores publication status, narratives, ordered entities, exact transition statement IDs, additional source links and portrait attribution. `stories.py` validates that each transition belongs to its source and points to the next entity before exposing published content. Frontend chapters use `/stories?story=<id>&step=<zero-based-index>`, restore browser history, clamp invalid chapter indices and move keyboard focus to the chapter heading. Stories have a separate route so explorer history cannot overwrite their URLs.

Public-domain portraits are served locally with attribution rather than fetched at reading time. Wikidata descriptions, original editorial text and external institutional sources remain distinct. The challenge dataset is pinned to its own manifest so adding unrelated story seeds does not change the challenge graph or invalidate tokens.

## Frontend loading and accessibility

The application shell (`App.tsx`) owns routing and explorer composition. SearchBox owns an ARIA combobox with cancellable requests and keyboard selection. Cytoscape is isolated in a lazy GraphCanvas module; graph, story and challenge modules are not initial-page dependencies. Renderer instances persist across profile selection, and callbacks read current props. The graph keyboard handler and native topic lists share the same selection operation. A graph-specific error boundary preserves the lists if its module fails. Bundle-manifest checks enforce the initial-JavaScript budget. See `accessibility.md` for the scope and limits of validation.

## Broader connection pages

The explorer uses all nondeprecated item-valued statements from a root. The first page prioritizes a mix of relationship types, then subsequent pages continue through the same order. Up to 24 root statements are loaded per page. Incoming links and connections between visible topics can also come from the bundled Wikidata records. These edges keep the source item, direction and statement ID, and are marked as saved in the evidence panel. Live property labels are resolved in the same bounded request as topic labels when available. Challenge and story rules continue to use their reviewed statement sets.

## Timeline

TimeAtlas extracts recorded dates and relationship qualifiers from a single item, preserving Gregorian or Julian calendar labels, BCE years and century-to-day precision. It flags sourcing qualifiers and uncertainty fields without interpreting them as exact historical dates. Direct topic dates are retained before relationship dates when the 40-entry cap applies. A saved-record mode can run without upstream access. See the [Wikidata date model](https://www.wikidata.org/wiki/Help:Dates).

An explicit cross-link check requests statements for up to eight visible topics at a time and keeps only edges whose endpoints are both visible. Up to four checks are saved in the trail URL. When a page or branch changes the node set, cross-link checks can run again against that set. If a check cannot be replayed, the shared trail still opens with its neighborhoods.
