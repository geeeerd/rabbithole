"""Log process-local request totals without retaining identifiers or query strings."""

from dataclasses import dataclass
import json
import logging
import time

LOGGER = logging.getLogger("uvicorn.error")
DIRECT = {
    "/api/health": "health", "/api/search": "search", "/api/graph": "graph",
    "/api/graph/links": "cross-links", "/api/graph/route": "topic-route",
}
ENTITY_ROUTES = {"neighbors", "timeline", "places", "background", "facts", "incoming"}


def route_group(path: str) -> str:
    if path in DIRECT:
        return DIRECT[path]
    if path.startswith("/api/entities/"):
        parts = path.split("/", 4)
        suffix = parts[4] if len(parts) == 5 else ""
        return suffix if suffix in ENTITY_ROUTES else "entity"
    if path.startswith("/api/challenges/"):
        return "challenge"
    if path == "/api/stories" or path.startswith("/api/stories/"):
        return "stories"
    return "other"


@dataclass
class Totals:
    requests: int = 0
    limited: int = 0
    errors: int = 0
    total_ms: float = 0
    max_ms: float = 0


class RequestMetrics:
    def __init__(self, interval: float = 60):
        self.interval = interval
        self.started = time.monotonic()
        self.totals: dict[str, Totals] = {}

    def record(self, path: str, status: int, elapsed_ms: float) -> None:
        totals = self.totals.setdefault(route_group(path), Totals())
        totals.requests += 1
        totals.limited += status == 429
        totals.errors += status >= 500
        totals.total_ms += elapsed_ms
        totals.max_ms = max(totals.max_ms, elapsed_ms)
        now = time.monotonic()
        if now - self.started < self.interval:
            return
        groups = {
            group: {"requests": item.requests, "limited": item.limited, "server_errors": item.errors,
                    "mean_ms": round(item.total_ms / item.requests, 1), "max_ms": round(item.max_ms, 1)}
            for group, item in self.totals.items()
        }
        LOGGER.info("RabbitHole request summary %s", json.dumps({"seconds": round(now - self.started, 1), "groups": groups}))
        self.totals.clear()
        self.started = now
