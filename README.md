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
- Directed, labeled graph with zoom, pan, progressive expansion, reset and recentering.
- Entity profiles, property filters and accessible topic/connection lists.
- Statement inspection including references, qualifiers and original source links.
- Shareable root-topic URLs, browser navigation and light/dark themes.
- Timeouts, bounded upstream concurrency, retries and a bounded one-hour in-memory cache.
- A real Wikidata snapshot around Alan Turing for offline exploration; fallback is visibly labeled.

## Checks

```sh
cd backend
uv run pytest -q
```

```sh
cd frontend
npm run build
```

CI runs the same checks. Both package managers have committed lockfiles.

## Scope and limitations

This is the first vertical slice, not the full public beta. Challenges, stories, Wikipedia summaries, Commons media, persistent storage, production rate limiting, branch collapse and forward exploration history UI remain on the roadmap. Share links preserve the root topic, not all expanded branches. The live API is an outbound neighborhood only, capped at 12 statements; the frontend caps the graph at 60 nodes. Search and fallback support English. The offline collection covers a small Turing neighborhood and may not support further expansions.

The backend is for local development. Before public deployment, configure an identifying Wikimedia User-Agent with contact information, request rate limiting, monitoring, a deployment proxy and persistent caching as needed. Cached data timestamps currently indicate response assembly time; the seed manifest records snapshot time. In-memory caches reset on process restart.

## Data and license

Code: MIT. Structured entity snapshots: Wikidata CC0, not independently verified research. Statements without references are explicitly labeled. No Wikipedia article text or Commons media is redistributed. See [data sources](docs/data-sources.md).

See [the original blueprint](docs/blueprint.md), [architecture](docs/architecture.md), [roadmap](docs/roadmap.md) and [contribution guide](CONTRIBUTING.md).
