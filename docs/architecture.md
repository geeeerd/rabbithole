# Architecture

React/TypeScript → Vite `/api` proxy → FastAPI → bounded HTTPX requests → Wikimedia Action API.

The graph renderer uses stable Q identifiers for nodes and statement IDs for edges. Data is normalized server-side. Property allowlisting excludes generic instance-of edges. Direction, references and qualifiers are preserved. The client merges by ID and limits visible nodes to 60. Responses return at most 12 relationships. No reverse relationships are invented.

Upstream responses are cached for an hour in a bounded process-local cache. On upstream failure, checked-in entity snapshots provide a small offline neighborhood. Cache and persistent storage are separate concerns: no database is needed yet. PostgreSQL migrations should be introduced when curated stories and challenges require durable records.

Search requests are cancelled when the query changes. Exploration responses use request tokens to prevent stale requests from overwriting newer navigation. Every edge is inspectable through both the graph and an accessible list.
