# API v0.1

`GET /api/health` — service status.

`GET /api/search?q=...` — 2–100 character English query; at most 8 entities and an offline flag.

`GET /api/entities/{QID}` — normalized entity, or 404 (missing live item), 503 (unavailable offline), 422 (invalid ID).

`GET /api/entities/{QID}/neighbors` and `GET /api/graph?entity=Q7251` — normalized graph, original statement IDs, references, qualifiers, source links, truncation/offline flags and response timestamp. At most 12 allowed relationships.

Interactive contracts: `/docs`. No authentication or write endpoints in this milestone.
