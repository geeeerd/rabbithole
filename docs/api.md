# API v0.1

`GET /api/health` — service status.

`GET /api/search?q=...` — 2–100 character English query; at most 8 entities and an offline flag.

`GET /api/entities/{QID}` — normalized entity, or 404 (missing live item), 503 (unavailable offline), 422 (invalid ID).

`GET /api/entities/{QID}/neighbors` and `GET /api/graph?entity=Q7251` — normalized graph, original statement IDs, references, qualifiers, source links, truncation/offline flags and response timestamp. See connection pages below for pagination and saved links.

Interactive contracts: `/docs`. No user accounts; game writes validate signed, expiring progress tokens.

## Connection Challenge

All routes below have typed request/response contracts in `/docs`. Challenges use the bundled snapshot and make no live Wikimedia calls.

- `GET /api/challenges/daily` starts the puzzle for today in UTC. Pass `?day=YYYY-MM-DD` to replay a date.
- `GET /api/challenges/collection?category=classic` returns eligible practice entities, a suggested pair, the available collection list, the graph version and the relationship model.
- `POST /api/challenges/custom` accepts `{ "start": "Q7251", "destination": "Q35794", "category": "classic" }`. It rejects unknown, identical or unreachable pairs. Omitting `category` selects `classic`.
- `POST /api/challenges/validate-move`: `{ "token": "...", "edge_id": "..." }`. Requires an actual outgoing statement from the signed current position.
- `POST /api/challenges/hint`: `{ "token": "..." }`. Returns a suggested eligible edge from bounded breadth-first search and signs the hint count. Repeating a hint at the same topic counts once.
- `POST /api/challenges/undo`: `{ "token": "..." }`. Removes one move, preserving hint count.
- `POST /api/challenges/verify-path`: `{ "token": "..." }`. Rechecks signed progress and every directed edge; reports completion only at the destination.

Game responses include start/destination/current entities, choices with source statements, visited entities, path edges, step count, hints, completion, snapshot version, model and a replacement token. Always use the latest token. Invalid, altered, expired or obsolete tokens return 422. The 12-step cap is enforced by the server.

Tokens expire after 24 hours. `CHALLENGE_SIGNING_KEY` can be provided through the backend environment; an ephemeral random process key is used otherwise. Token replay is possible by design; there is no leaderboard, prize or competitive score. No tokens are included in share links.

## Discovery Stories

`GET /api/stories` returns published summaries with category, topic count, image attribution and review timestamp. `GET /api/stories/{id}` returns an ordered entity sequence, editorial text, transitions with exact source statements, additional source links and full media metadata. Unknown IDs return 404. Startup validation rejects missing or reversed transitions. These endpoints use bundled data and do not need external API access.

## Connection pages and timelines

`GET /api/graph?entity=Q7251&offset=0` and the entity neighbors endpoint return up to 24 root statements per page, plus saved cross-links among visible topics. Pass the returned `next_offset` to load another page. A null offset indicates the end of the available pages. `total_statements` counts root statements before metadata resolution. `saved_edge_ids` marks statements obtained from bundled records. Source and target IDs always follow the original direction.

`GET /api/entities/Q7251/timeline` returns up to 40 recorded dates, their original precision and calendar, uncertainty markers, references counts and source URLs. `?offline=true` selects the bundled records and skips live requests.

`POST /api/graph/links` accepts `topics` (2–100 visible item IDs) and `sources` (1–8 of those IDs). It returns up to 48 directed statements between those topics, with checked source IDs and saved-record provenance. It does not fetch arbitrary linked topics.

`GET /api/entities/Q7251/places` returns the topic’s recorded Earth coordinate when available and up to eight related places with usable coordinates. Each point includes precision, the coordinate statement, related place links and supported date qualifiers. `?offline=true` reads the saved coordinates and relationships without live requests.
