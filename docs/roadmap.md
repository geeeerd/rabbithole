# Roadmap

The original product plan is preserved in `blueprint.md`.

- [x] Foundation: separate frontend/backend, health check, lockfiles, tests, CI, workspace and documentation.
- [x] Initial data engine: live search, ID validation, normalization, allowlist, references, bounded caching, retries and fallback snapshots.
- [x] First graph: Cytoscape, pan/zoom, expansion, ID deduplication, recentering, profiles and statement inspection.
- [x] Exploration continuity: branch collapse with shared-neighbor preservation, Back/Forward snapshots, URL serialization of expanded topics and view settings, and frontend interaction tests.
- [x] Explorer usability: accessible search, graph keyboard controls, renderer lifecycle tests, page-level axe checks and deferred graph/route bundles with a build-size budget.
- [x] Homepage browsing with 24 Wikidata starting points across the eight blueprint categories.
- [ ] Complete discovery MVP: real-browser contrast/screen-reader/mobile audit, device performance profiling and hosted deployment.
- [x] First Connection Challenge: versioned directed snapshot, typed APIs, signed move/path validation, hints, undo, progress recovery, result sharing and custom practice pairs.
- [x] Challenge rotation: three reviewed routes, date-based replay links and themed practice collections with versioned graphs.
- [x] Completed challenges compare the submitted route with the shortest directed route in the same puzzle graph.
- [ ] Expand challenge coverage with additional reviewed routes and broader topic collections.
- [x] Discovery Stories: three curated narratives, startup-validated statement sequences, chapter navigation/deep links, public-domain portraits, attribution and story-to-graph handoff.
- [ ] Expand stories: broader subject coverage, further independent source review and a contribution/review workflow.
- [x] Release build: same-origin container, API and upstream limits, GitHub Actions build and smoke test.
- [x] Contribution templates, source correction links and browser dependency notices verified at build time.
- [ ] Public beta: hosted deployment, alerting and representative traffic tests. The release checks include a controlled local burst.
- [x] Denser exploration with broader Wikidata statements, more connection pages, and live checks for incoming statements and links between visible topics.
- [x] Topic facts, attributed Wikipedia background and route tracing through visible statements.
- [x] Search loaded connections and compare shared neighbors between visible topics.
- [x] Browser-local Saved Trails with shareable exploration links.
- [x] TimeAtlas timeline with recorded precision, calendar and statement evidence.
- [x] TimeAtlas geography with interactive place pins, saved coordinates and linked source statements.
- [ ] TimeAtlas historical boundary views with dated, attributed geometry.

Do not call these phases complete until every acceptance criterion in the blueprint has been tested. No fabricated or unverified curated paths should ship as factual graph edges.
