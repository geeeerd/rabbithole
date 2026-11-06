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

- Debounced Wikidata topic search and autocomplete.
- Directed, labeled graph with zoom, pan, progressive expansion, branch collapse, reset and recentering.
- Branch chips and Back/Forward controls with graph snapshots for offline history navigation.
- Entity profiles, property filters and accessible topic/connection lists.
- Statement inspection including references, qualifiers and original source links.
- Shareable exploration URLs preserving the root, up to eight expanded branches, selected topic and relationship filter.
- Light/dark themes.
- Discovery Stories at `/stories`: three guided journeys with validated statement sequences, chapter links, public-domain portraits, attribution and links into exploration.
- Connection Challenge at `/challenge`: daily starter puzzle, custom practice pairs, server-validated moves, hints, undo, signed progress recovery, source links and shareable results.
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

CI runs the same checks. Both package managers have committed lockfiles.

## Scope and limitations

This is the first vertical slice, not the full public beta. Additional reviewed challenges and stories, Wikipedia summaries, persistent storage, production rate limiting, a full accessibility audit and performance profiling remain on the roadmap. Shared links reconstruct neighborhoods from current Wikidata data or the offline collection; they are not immutable historical snapshots. The live API is an outbound neighborhood only, capped at 12 statements; the frontend caps the graph at 60 nodes and eight expanded branches. Search and fallback support English. The offline collection covers a small Turing neighborhood and may not support further expansions.

The starter daily challenge repeats the same reviewed two-step route; practice pairs are limited to the bundled graph, not arbitrary Wikidata topics. Challenges use only directed “educated at” and “part of” statements. Signed progress expires after 24 hours. Set `CHALLENGE_SIGNING_KEY` in the backend environment for progress to survive server restarts; without it, a temporary process key is used. There is no leaderboard or claim of a globally shortest route.

The backend is for local development. Before public deployment, configure an identifying Wikimedia User-Agent with contact information, request rate limiting, monitoring, a deployment proxy and persistent caching as needed. Cached data timestamps currently indicate response assembly time; the seed manifest records snapshot time. In-memory caches reset on process restart.

## Data and license

Code: MIT. Structured entity snapshots: Wikidata CC0, not independently verified research. Statements without references are explicitly labeled. No Wikipedia article text is redistributed. Three public-domain Commons portraits are bundled with file-specific attribution in `frontend/public/images/ATTRIBUTION.md`. See [data sources](docs/data-sources.md).

See [the original blueprint](docs/blueprint.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md) and [contribution guide](CONTRIBUTING.md).
