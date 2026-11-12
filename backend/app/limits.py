"""Bound public API traffic without storing request bodies or identifiers on disk."""

import asyncio
import math
import time
from collections import OrderedDict
from dataclasses import dataclass
from urllib.parse import parse_qs

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


@dataclass
class Bucket:
    tokens: float
    updated: float

    def consume(self, now: float, cost: float, capacity: int, refill: float) -> int:
        self.tokens = min(capacity, self.tokens + (now - self.updated) * refill)
        self.updated = now
        if self.tokens >= cost:
            self.tokens -= cost
            return 0
        return max(1, math.ceil((cost - self.tokens) / refill))


class ApiLimits:
    def __init__(self, app: ASGIApp, *, capacity: int = 30, refill: float = 0.5,
                 max_clients: int = 4096, max_body: int = 24 * 1024):
        self.app = app
        self.capacity = capacity
        self.refill = refill
        self.max_clients = max_clients
        self.max_body = max_body
        self.clients: OrderedDict[str, Bucket] = OrderedDict()
        self.upstream = Bucket(30, time.monotonic())

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]
        upstream = path in ("/api/search", "/api/graph", "/api/graph/links", "/api/graph/route") or path.startswith("/api/entities/")
        writing = scope["method"] == "POST"
        if upstream or writing:
            address = (scope.get("client") or ("unknown", 0))[0]
            now = time.monotonic()
            bucket = self.clients.pop(address, Bucket(self.capacity, now))
            self.clients[address] = bucket
            if len(self.clients) > self.max_clients:
                self.clients.popitem(last=False)
            cost = 2 if path == "/api/graph" or path.endswith(("/neighbors", "/timeline", "/places", "/background", "/facts")) else 1
            if path == "/api/graph/links":
                cost = 4
            elif path.endswith("/incoming"):
                cost = 5
            elif path == "/api/graph/route":
                query = parse_qs(scope.get("query_string", b"").decode("latin-1"))
                cost = 9 if query.get("depth", [])[-1:] == ["deep"] else 6
            retry = bucket.consume(now, cost, self.capacity, self.refill)
            if not retry and upstream:
                retry = self.upstream.consume(now, cost, 30, 2)
            if retry:
                response = JSONResponse(
                    {"detail": "RabbitHole is receiving too many requests. Wait a moment and retry."},
                    status_code=429, headers={"Retry-After": str(retry)},
                )
                await response(scope, receive, send)
                return

        if not writing:
            await self.app(scope, receive, send)
            return

        # Count actual bytes, including bodies sent without Content-Length.
        body = bytearray()
        try:
            async with asyncio.timeout(5):
                while True:
                    message = await receive()
                    if message["type"] == "http.disconnect":
                        return
                    chunk = message.get("body", b"")
                    if len(body) + len(chunk) > self.max_body:
                        await JSONResponse({"detail": "Request body is too large."}, status_code=413)(scope, receive, send)
                        return
                    body.extend(chunk)
                    if not message.get("more_body", False):
                        break
        except TimeoutError:
            await JSONResponse({"detail": "Request body timed out."}, status_code=408)(scope, receive, send)
            return

        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay, send)
