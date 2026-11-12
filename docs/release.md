# Build and verify a RabbitHole release

The release serves the built React site and FastAPI from one origin. Story and challenge bookmarks work on a fresh request. Release startup requires the built site and its assets.

## Run locally with Docker

From the repository root:

```sh
docker build -t rabbithole:local .
docker run --rm -p 127.0.0.1:8000:8000 rabbithole:local
```

Open `http://127.0.0.1:8000`. In a second terminal, run `python3 scripts/smoke.py`. The smoke test checks bookmarked pages, built assets, the story catalog and portrait files, a complete challenge, and missing routes. It makes no live Wikidata requests. On a fresh local instance, `python3 scripts/load_check.py` checks concurrent page delivery and confirms that a burst against the saved timeline returns controlled 429 responses while health stays available. It reports local HTTP timing.

## Run the same release without Docker

Build the frontend with `npm ci` and `npm run build` from `frontend/`. Then start the server from `backend/`:

```sh
uv sync --locked
uv run uvicorn app.production:production_app --factory --host 127.0.0.1 --port 8000 --no-access-log
```

Run the same smoke test from the repository root. Development remains available with `app.main:app` and the Vite proxy. Interactive API docs are available in development.

## Host behind HTTPS

`render.yaml` defines a Docker web service on Render’s free preview tier. Import the repository as a Blueprint and supply a `WIKIMEDIA_USER_AGENT` value with the project URL and an operator contact. Render generates the challenge signing key. The preview tier can sleep after inactivity. Use the assigned HTTPS address for the first smoke check. [Blueprint reference](https://render.com/docs/blueprint-spec) · [Free tier behavior](https://render.com/docs/free)

After deployment, run `python3 scripts/smoke.py --base "$RABBITHOLE_PUBLIC_URL" --wait 90` from the repository root. Confirm that separate browsers can search and expand topics behind the platform’s proxy. Set the GitHub repository variable `RABBITHOLE_PUBLIC_URL` to the HTTPS base address and run **Hosted health** from Actions. That workflow checks `/api/health` every six hours when the URL is configured. Use the platform or repository notification settings to route failures to the operator.

Use one worker initially. The cache, request counters, and upstream cooldown live in that worker and reset on restart. Set `CHALLENGE_SIGNING_KEY` to a persistent secret and configure `WIKIMEDIA_USER_AGENT` with a project URL and contact for the operator. Use `/api/health` for platform checks. The container listens on `PORT` when supplied.

If the service receives traffic through a reverse proxy, configure `FORWARDED_ALLOW_IPS` to the trusted proxy address or network and have that proxy replace client-supplied forwarding headers. Without trusted proxy configuration the rate limiter sees the connecting peer. The default trust list is loopback only.

The release caps expensive API traffic with a per-client burst of 30 tokens and a refill of 30 tokens per minute. Graph requests cost two tokens. A separate process-wide bucket also limits upstream-facing calls. Game submissions are limited to 24 KiB and have five seconds to send their bodies. The Wikidata client shares identical in-flight requests, uses a seven-second fetch deadline and observes upstream retry instructions. Bundled stories and challenges can still load when Wikidata is unavailable.

The default container command disables request access logs. If you enable proxy or host logging, configure retention and avoid retaining search query strings or challenge bodies. The release logs per-process request counts, rate limits, server errors and response times grouped by route type. It excludes topic IDs, search terms, request bodies and client addresses. Under traffic, summaries appear about once a minute. Hosted alerts and traffic limits across multiple workers depend on the hosting environment.

The web build checks its browser dependency notices against the installed runtime packages and publishes them at `/licenses/THIRD_PARTY_NOTICES.txt`. The runtime container retains the Python distributions and their packaged license metadata. Data and media credits are tracked separately in [Data sources](data-sources.md).
