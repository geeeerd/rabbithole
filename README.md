# RabbitHole

**Everything is connected. Discover how.**

An open-source knowledge explorer built with React, TypeScript, Cytoscape.js and FastAPI. Start with a topic, inspect directed Wikidata relationships, and follow your curiosity.

## Run locally

Requires Node.js 22+ and Python 3.11+ with [uv](https://docs.astral.sh/uv/).

```sh
cd backend
uv sync --locked
uv run uvicorn app.main:app --reload
```

In another terminal:

```sh
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Vite forwards `/api` to port 8000. API docs: http://localhost:8000/docs.

Open `rabbithole.code-workspace` in VS Code; **Tasks → Run Task → Start RabbitHole** starts both services after dependencies are installed.

## Working now

- Debounced Wikidata search with keyboard autocomplete, announcements, no-results states and retry.
- Directed graph with broader Wikidata relationships, saved cross-links, zoom, pan, expansion, branch collapse and recentering. **More connections** adds another page for the selected topic. **Find cross-links** looks for additional statements between visible topics. **Find incoming connections** checks for statements pointing to the selected topic from other Wikidata items. Trace a route through the current graph from the topic profile.
- Branch chips and Back/Forward controls with graph snapshots for offline history navigation.
- Entity profiles with recorded facts, on-demand Wikipedia background, property filters and accessible topic/connection lists.
- Statement inspection including references, qualifiers and original source links.
- Shareable exploration URLs preserving the root, up to eight expanded branches, connection pages, the selected topic and the relationship filter.
- Keyboard graph controls, a skip link, accessible connection lists and locally remembered light/dark themes.
- Graph and secondary routes load on demand; builds enforce an initial JavaScript budget.
- TimeAtlas at `/timeline` shows recorded dates with original precision, calendar and statement sources. `/map` shows recorded places on a present-day land map with coordinate and relationship evidence.
- Save up to 30 explorations in the current browser. **Saved Trails** reopens a trail with its selected topic, branches, filter and requested connection pages using current graph data.
- **Inspect connections** searches loaded statements by topic, relationship or Wikidata ID. Filter for arrows pointing to or from the selected topic and open any result to see its evidence.
- **Compare topics** shows direct statements and shared neighbors between the selected topic and another one in the loaded graph, with links to the original statements.
- **Find a connection** searches for a second topic without replacing the graph. If the loaded trail has no route, RabbitHole checks the endpoints and up to 16 candidate records for routes of up to three connections. If that search finds no route, **Search deeper** checks up to 44 candidate records and can find routes of up to four connections. Open any topic or source from the resulting path, or choose **Follow statement arrows only**. Shared links and saved trails keep the destination and search settings and rerun the search when opened.
- **Look for more routes** runs the wider search after finding a route. Choose among up to three paths when the checked statements support different sequences of topics.
- **Focus selected topic** dims unrelated parts of the graph while keeping its immediate neighbors and any traced route visible.
- Discovery Stories at `/stories`: three guided journeys with validated statement sequences, chapter links, public-domain portraits, attribution and links into exploration.
- Connection Challenge at `/challenge`: three rotating daily puzzles, dated replay links, themed practice pairs, server-validated moves, hints, undo, signed progress recovery, source links and shareable results.
- Timeouts, bounded upstream concurrency, retries and a bounded one-hour in-memory cache.
- A real Wikidata snapshot around Alan Turing for offline exploration; fallback is visibly labeled.

## Checks

```sh
cd backend
uv run pytest -q
```

```sh
cd frontend
npm test
npm run build
```

CI runs the tests and builds a release container with a smoke test. Both package managers have committed lockfiles. [Build and verify the release](docs/release.md).

## Scope and limitations

Additional reviewed challenges and stories, persistent storage, a full accessibility audit and performance profiling remain on the roadmap. Shared links reconstruct neighborhoods from current Wikidata data or the offline collection. The graph pages through outgoing statements, checks incoming statements and can discover extra links between visible topics. A trail supports up to 100 topics, eight expanded branches, six additional outgoing pages and four incoming checks. Search and fallback support English. The offline collection covers a small group of bundled topics.

The daily rotation follows three reviewed routes from the Discovery Stories catalog. Dated links replay the same puzzle. Each practice collection has its own bundled topics and directed relationship types. Completed routes are compared with the shortest route in the same directed puzzle graph. Signed progress expires after 24 hours. Set `CHALLENGE_SIGNING_KEY` in the backend environment for progress to survive server restarts. Otherwise, the backend uses a temporary process key.

The release includes a same-origin site and API with request limits. Host configuration and verification are described in the [release guide](docs/release.md). Cached data timestamps indicate response assembly time. The seed manifest records snapshot time. In-memory caches reset on process restart.

## Data and license

Code: MIT. Structured entity snapshots: Wikidata CC0, not independently verified research. Statements without references are explicitly labeled. On-demand Wikipedia excerpts are credited separately under CC BY-SA 4.0. Three public-domain Commons portraits are bundled with file-specific attribution in `frontend/public/images/ATTRIBUTION.md`. See [data sources](docs/data-sources.md).

See [the original blueprint](docs/blueprint.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md) and [contribution guide](CONTRIBUTING.md).
- **Explore by category** on the homepage offers 24 Wikidata starting topics across eight subject areas.
- Choose **Connect two topics** on the homepage to start a connection search from a pair of topics.
