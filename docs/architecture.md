# Architecture

React/TypeScript → Vite `/api` proxy → FastAPI → bounded HTTPX requests → Wikimedia Action API.

The graph renderer uses stable Q identifiers for nodes and statement IDs for edges. Data is normalized server-side. Property allowlisting excludes generic instance-of edges. Direction, references and qualifiers are preserved. The client merges by ID and limits visible nodes to 60. Responses return at most 12 relationships. No reverse relationships are invented.

Upstream responses are cached for an hour in a bounded process-local cache. On upstream failure, checked-in entity snapshots provide a small offline neighborhood. Cache and persistent storage are separate concerns: no database is needed yet. PostgreSQL migrations should be introduced when curated stories and challenges require durable records.

Search requests are cancelled when the query changes. Exploration responses use request tokens to prevent stale requests from overwriting newer navigation. Every edge is inspectable through both the graph and an accessible list.

## Exploration continuity

`frontend/src/exploration.ts` owns the typed trail model and URL codec. A trail has a root, up to eight expanded topics, selection and relationship filter. Each expanded topic owns a neighborhood bundle. Collapsing a branch rebuilds reachability from the root, preserving shared nodes and removing unreachable descendant expansions; cycles terminate through visited sets. Node and edge maps deduplicate stable IDs. The 60-node limit applies to the union before any state is committed.

`useExploration.ts` manages atomic loading, request cancellation and browser history snapshots. Branch updates push history entries; selection and filtering replace the current view. Back/Forward restore saved data without API calls. Fresh shared links fetch connected neighborhoods sequentially, respecting limits and failing visibly if a branch is no longer reconstructible. A failed expansion keeps the previous graph and retries the same operation. Going home aborts pending loads. Share links preserve exploration choices, not a permanent copy of Wikidata statements or graph positions.
