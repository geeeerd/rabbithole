# Roadmap

The original product plan is preserved in `blueprint.md`.

- [x] Foundation: separate frontend/backend, health check, lockfiles, tests, CI, workspace and documentation.
- [x] Initial data engine: live search, ID validation, normalization, allowlist, references, bounded caching, retries and fallback snapshots.
- [x] First graph: Cytoscape, pan/zoom, expansion, ID deduplication, recentering, profiles and statement inspection.
- [x] Exploration continuity: branch collapse with shared-neighbor preservation, Back/Forward snapshots, URL serialization of expanded topics and view settings, and frontend interaction tests.
- [x] Explorer usability: accessible search, graph keyboard controls, renderer lifecycle tests, page-level axe checks and deferred graph/route bundles with a build-size budget.
- [x] Homepage browsing with 24 Wikidata starting points across the eight blueprint categories and a daily sourced discovery.
- [ ] Complete discovery MVP: real-browser contrast/screen-reader/mobile audit, device performance profiling and hosted deployment.
- [x] First Connection Challenge: versioned directed snapshot, typed APIs, signed move/path validation, hints, undo, progress recovery, result sharing and custom practice pairs.
- [x] Challenge rotation with computing, science and art puzzles, date-based replay links and themed practice collections with versioned graphs.
- [x] Completed challenges compare the submitted route with the shortest directed route in the same puzzle graph.
- [x] Expanded challenge coverage with an art and museums puzzle and practice collection.
- [x] Discovery Stories: three curated narratives, startup-validated statement sequences, chapter navigation/deep links, public-domain portraits, attribution and story-to-graph handoff.
- [x] Added an art and culture story with the Louvre’s collection record and independently attributed artwork.
- [x] Story proposal form and documented publication review workflow.
- [ ] Obtain independent review of the published story catalog.
- [x] Release build: same-origin container, API and upstream limits, GitHub Actions build and smoke test.
- [x] Render deployment blueprint and opt-in GitHub Actions health check for the hosted URL.
- [x] Data and privacy page and aggregate operational counts for cache use, upstream failures and rendering errors.
- [x] Contribution templates, source correction links and browser dependency notices verified at build time.
- [ ] Public beta: hosted deployment, alerting and representative traffic tests. The release checks include a controlled local burst.
- [x] Denser exploration with broader Wikidata statements, more connection pages, and live checks for incoming statements and links between visible topics.
- [x] Topic facts, attributed Wikipedia background and route tracing through visible statements.
- [x] Full topic profiles with Overview, Connections, Timeline and Explore Further tabs when records are available.
- [x] Search loaded connections and compare shared neighbors between visible topics.
- [x] Browser-local Saved Trails with shareable exploration links.
- [x] TimeAtlas timeline with recorded precision, calendar and statement evidence.
- [x] TimeAtlas geography with interactive place pins, saved coordinates and linked source statements.
- [x] TimeAtlas historical boundary view comparing two dated Census snapshots for Connecticut, with source, scope, license and uncertainty.

Do not call these phases complete until every acceptance criterion in the blueprint has been tested. No fabricated or unverified curated paths should ship as factual graph edges.
