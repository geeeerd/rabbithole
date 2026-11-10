# Build and verify a RabbitHole release

The release serves the built React site and FastAPI from one origin. Story and challenge bookmarks work on a fresh request. Release startup requires the built site and its assets.

## Run locally with Docker

From the repository root:

```sh
docker build -t rabbithole:local .
docker run --rm -p 127.0.0.1:8000:8000 rabbithole:local
```

Open `http://127.0.0.1:8000`. In a second terminal, run `python3 scripts/smoke.py`. The smoke test checks bookmarked pages, built assets, the story catalog and portrait files, a complete challenge, and missing routes. It makes no live Wikidata requests.

## Run the same release without Docker

Build the frontend with `npm ci` and `npm run build` from `frontend/`. Then start the server from `backend/`:

```sh
uv sync --locked
uv run uvicorn app.production:production_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Run the same smoke test from the repository root. Development remains available with `app.main:app` and the Vite proxy. Interactive API docs are available in development.

## Host behind HTTPS

Use one worker initially. The cache, request counters, and upstream cooldown live in that worker and reset on restart. Set `CHALLENGE_SIGNING_KEY` to a persistent secret and configure `WIKIMEDIA_USER_AGENT` with a project URL and contact for the operator. Use `/api/health` for platform checks. The container listens on `PORT` when supplied.

If the service receives traffic through a reverse proxy, configure `FORWARDED_ALLOW_IPS` to the trusted proxy address or network and have that proxy replace client-supplied forwarding headers. Without trusted proxy configuration the rate limiter sees the connecting peer. The default trust list is loopback only.

The release caps expensive API traffic with a per-client burst of 30 tokens and a refill of 30 tokens per minute. Graph requests cost two tokens. A separate process-wide bucket also limits upstream-facing calls. Game submissions are limited to 24 KiB and have five seconds to send their bodies. The Wikidata client shares identical in-flight requests, uses a seven-second fetch deadline and observes upstream retry instructions. Bundled stories and challenges can still load when Wikidata is unavailable.

The default container command disables request access logs. If you enable proxy or host logging, configure retention and avoid retaining search query strings or challenge bodies. Monitoring and traffic limits across multiple workers depend on the hosting environment.
