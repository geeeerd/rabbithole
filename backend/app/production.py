"""Serve the built web application and API on the same origin."""

import os
from time import perf_counter
from pathlib import Path

from fastapi import FastAPI
from starlette.middleware.gzip import GZipMiddleware
from starlette.responses import FileResponse
from starlette.staticfiles import StaticFiles
from starlette.types import ASGIApp, Receive, Scope, Send

from .limits import ApiLimits
from .main import app as api, wikidata
from .metrics import RequestMetrics

DEFAULT_DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
PAGE_ROUTES = ("/", "/stories", "/challenge", "/timeline", "/map", "/map/boundaries", "/profile", "/trails", "/privacy")
SECURITY_HEADERS = (
    (b"x-content-type-options", b"nosniff"),
    (b"referrer-policy", b"no-referrer"),
    (b"content-security-policy", (
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; "
        "object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    ).encode()),
)


def create_production_app(dist: Path, *, limits: bool = True) -> ASGIApp:
    index = dist / "index.html"
    if not index.is_file():
        raise RuntimeError(f"Frontend build missing at {index}. Run npm run build in frontend/.")

    web = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    web.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    web.mount("/images", StaticFiles(directory=dist / "images"), name="images")
    web.mount("/maps", StaticFiles(directory=dist / "maps"), name="maps")
    web.mount("/licenses", StaticFiles(directory=dist / "licenses"), name="licenses")

    async def page() -> FileResponse:
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    for route in PAGE_ROUTES:
        web.add_api_route(route, page, methods=["GET", "HEAD"], include_in_schema=False)

    protected_api = ApiLimits(api) if limits else api
    metrics = RequestMetrics(wikidata_totals=lambda: dict(wikidata.counts))

    async def dispatch(scope: Scope, receive: Receive, send: Send) -> None:
        path = scope.get("path", "")
        is_api = path.startswith("/api/")
        status = None

        async def send_headers(message):
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                headers = message.setdefault("headers", [])
                headers.extend(SECURITY_HEADERS)
                if is_api:
                    headers.append((b"cache-control", b"no-store"))
                elif path.startswith("/assets/") and message["status"] in (200, 304):
                    headers.append((b"cache-control", b"public, max-age=31536000, immutable"))
            await send(message)

        if scope["type"] == "lifespan":
            await api(scope, receive, send)
        elif is_api and scope["type"] == "http":
            started = perf_counter()
            try:
                await protected_api(scope, receive, send_headers)
            finally:
                if status is not None:
                    metrics.record(path, status, (perf_counter() - started) * 1000)
        else:
            await web(scope, receive, send_headers)

    return GZipMiddleware(dispatch, minimum_size=1024)


def production_app() -> ASGIApp:
    return create_production_app(Path(os.environ.get("RABBITHOLE_DIST", DEFAULT_DIST)))
