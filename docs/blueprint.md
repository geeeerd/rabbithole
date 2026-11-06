# RABBITHOLE
## Complete Product Blueprint and Development Roadmap
**Project type:** Open-source interactive knowledge discovery platform  
**Working name:** RabbitHole  
**Product objective:** Make the world's interconnected knowledge visually explorable, understandable, and enjoyable.  
**Primary data sources:** Wikidata, Wikipedia, Wikimedia Commons  
**Development approach:** Incremental, modular, test-driven, and production-oriented  
**Initial platform:** Responsive web application  
**Long-term vision:** A public knowledge exploration platform combining graphs, historical timelines, geographic maps, and discovery games.

---

# 1. PROJECT MISSION

Build RabbitHole, an open-source web application that allows anyone to explore connections between knowledge, historical events, scientific discoveries, influential people, inventions, cultures, places, and ideas.

Rather than presenting knowledge as isolated articles or search results, RabbitHole should represent it as a connected universe.

A user should be able to enter a topic such as:

- Ancient Egypt
- Alan Turing
- The Roman Empire
- Artificial Intelligence
- The Silk Road
- Evolution
- The Printing Press
- Space Exploration

The application retrieves factual information and relationships from structured public datasets, displays them as an interactive network, and allows the user to explore further.

The fundamental question the application answers is:

**"How is this connected to everything else?"**

The product should turn discovery into the main experience, not simply visualize database records.

## Product principles

1. **Discovery first:** Users should discover interesting relationships without requiring technical knowledge.
2. **Evidence-based:** Every factual connection must trace back to an identifiable source.
3. **Visual exploration:** Knowledge should be navigable through interactive networks, not exclusively lists.
4. **Accessible:** Users should understand the application within seconds of opening it.
5. **Open source:** Code should be documented, reusable, and publicly available.
6. **Cost-conscious:** Prefer free and open-source infrastructure.
7. **Modular:** New visualization modes and data sources should not require rebuilding the core application.
8. **Responsive:** The website should work on desktop, tablet, and mobile devices.
9. **Transparent:** The interface should distinguish direct relationships, inferred connections, and editorial narratives.
10. **Sustainable:** The application should remain useful even when external APIs are temporarily unavailable.

---

# 2. CORE PRODUCT EXPERIENCE

## 2.1 Homepage

The homepage must immediately communicate the purpose of RabbitHole.

### Main visual

A visually appealing, subtly animated network of interconnected concepts.

The animation should be lightweight and should not interfere with reading, accessibility, or device performance.

### Main heading

"Everything is connected. Discover how."

### Supporting text

"Explore the hidden connections between history, science, people, places, and ideas."

### Primary interaction

A prominent search bar:

"Start with anything..."

Example suggestions:

- Cleopatra
- Black Holes
- The Internet
- Leonardo da Vinci
- Ancient Greece
- Artificial Intelligence

### Additional homepage elements

**Featured Connections**

Highlight curated and verified journeys through knowledge.

**Daily Discovery**

Present an intriguing, evidence-supported connection.

**Connection Challenge**

Invite users to connect two seemingly unrelated subjects.

**Explore by Category**

Allow browsing by:

- History
- Science
- Technology
- Art and Culture
- Geography
- Philosophy
- People
- Nature

### Acceptance criteria

- Homepage is useful without requiring an account.
- Users can initiate exploration within two interactions.
- Search supports autocomplete.
- Homepage works on small screens.
- Featured content has visible source attribution.
- The initial page remains lightweight and responsive.

---

# 3. FEATURE A — INTERACTIVE KNOWLEDGE GRAPH

This is the application's primary feature.

## 3.1 Graph interaction

When a user searches for a subject, RabbitHole displays that subject as the central node in an interactive graph.

Example:

**Alan Turing**

Possible directly supported connections:

- University of Cambridge — educated at
- Mathematics — field of work
- Computer science — field of work
- Bletchley Park — workplace
- Turing machine — notable concept associated with his work

The specific properties and connections must be verified against the source data.

Each node represents a recognized entity with a stable identifier.

Each edge represents an identifiable relationship.

## 3.2 Graph behavior

Users must be able to:

1. Select nodes to view descriptions.
2. Expand nodes to discover additional relationships.
3. Collapse expanded branches.
4. Recenter the graph around a selected entity.
5. Zoom and pan.
6. Search for another entity.
7. Navigate backward and forward through exploration history.
8. Filter relationships by type.
9. Reset the graph.
10. Share their current exploration using a URL.

## 3.3 Node presentation

Each node may contain:

- Entity title
- Small image or icon
- Entity category
- Short description
- Wikidata entity identifier
- Number of currently visible connections

Example categories:

- Person
- Place
- Scientific concept
- Invention
- Historical event
- Organization
- Artwork
- Natural phenomenon
- Political entity

Avoid relying exclusively on color to communicate categories.

## 3.4 Relationship presentation

Edges must have readable labels.

Examples:

- Educated at
- Influenced by
- Founded by
- Located in
- Part of
- Instance of
- Discovered by
- Field of work
- Capital of

Relationship direction matters.

For example, "founded by" must not be silently reversed into "founded" without transforming the wording correctly.

## 3.5 Relationship inspection

Clicking an edge opens a details panel displaying:

- Source entity
- Target entity
- Relationship label
- Relationship direction
- Supporting Wikidata statement/property
- Available references
- Link to original source
- Date qualifiers, when relevant
- Any data limitations

A Wikidata statement without a supporting reference should be labeled accordingly. It must not be represented as independently verified research.

## 3.6 Graph performance

Do not download enormous subgraphs by default.

Implement progressive expansion.

Suggested initial controls:

- Initial nodes: approximately 8–15
- Maximum new neighbors per expansion: approximately 10–20
- Configurable visible-node limit
- Lazy loading
- Node/edge deduplication
- Loading and retry indicators

These are preliminary design limits and should be adjusted through performance testing.

### Acceptance criteria

- Searching a valid entity displays a connected graph.
- Clicking a node expands related entities.
- Every edge has a traceable source.
- Duplicate nodes are not created.
- Cycles do not break navigation.
- Expansion does not freeze the browser.
- Users can access equivalent information through an accessible list or details view.

---

# 4. FEATURE B — CONNECTION CHALLENGE

This feature turns discovery into a knowledge game.

## 4.1 Objective

Users attempt to find a connection between two subjects.

Example:

**Starting topic:** Ancient Egypt  
**Destination topic:** Modern Computing

The application displays the starting entity and lets users navigate through actual connections until reaching the destination.

Example conceptual path:

Ancient Egypt → Mathematics → Algorithms → Computing

This is an illustrative thematic route, not a guaranteed sequence of direct Wikidata statements. Actual challenges must use validated graph edges.

## 4.2 Game mechanics

A challenge includes:

- Starting entity
- Destination entity
- Navigation history
- Number of steps taken
- Maximum available steps, if applicable
- Hint system
- Completion indicator
- Shareable result

## 4.3 Challenge modes

**Free Challenge**

Users choose any two entities.

**Daily Challenge**

Every visitor receives the same curated challenge for that date.

**Category Challenge**

Users select a subject area such as science or history.

**Shortest Path Challenge**

Users attempt to find the shortest connection under a clearly specified graph model.

The shortest-path feature must define which relationship types are included and whether the graph is directed or undirected.

## 4.4 Scoring

Possible scoring variables:

- Number of steps taken
- Number of hints used
- Completion status

Do not score players against a claimed globally shortest route unless an exact shortest path has been computed within a clearly defined graph.

## 4.5 Challenge validation

A challenge is valid only when:

1. Both entities exist.
2. An eligible path exists in the supported graph.
3. Every connection is traceable.
4. The destination can be reached through available navigation.
5. The challenge is not unintentionally trivial.

### Acceptance criteria

- Users can start and finish a challenge.
- Progress is displayed.
- Invalid moves are rejected.
- The displayed path is reproducible.
- Challenges remain solvable even when the external API is unavailable, if they have been precomputed and cached.

---

# 5. FEATURE C — DISCOVERY STORIES

Discovery Stories are guided journeys through connected knowledge.

Unlike the free graph explorer, each story follows a curated narrative.

Example story subjects:

- How mathematics shaped computing
- From the printing press to the modern internet
- The scientific discoveries that changed medicine
- Connections between ancient civilizations
- How astronomy transformed our understanding of Earth

## Story structure

A story consists of:

1. Introduction
2. Starting entity
3. A sequence of connected entities
4. Explanations of each transition
5. Related photographs or illustrations
6. Original source links
7. Final summary
8. Options to continue exploring

## Data model

Each story should have:

- Unique ID
- Title
- Description
- Category
- Cover image
- Ordered entities
- Validated transitions
- Narrative text
- References
- Publication status
- Last-reviewed timestamp

Narratives may be manually curated or AI-assisted during content preparation, but published factual claims must be reviewed against sources.

### Acceptance criteria

- Stories follow a reproducible path.
- Every factual connection is verified.
- Users can move between story mode and graph exploration.
- Stories load without requiring large live graph queries.

---

# 6. FEATURE D — ENTITY PROFILES

Every explored entity should have an accessible, human-readable profile.

Example:

**Alan Turing**

Profile information:

- Name
- Short summary
- Image
- Categories
- Relevant dates
- Major relationships
- Connected subjects
- Wikipedia link
- Wikidata link
- Source information

## Profile tabs

**Overview**

Summary and key facts.

**Connections**

Direct relationships and relevant entities.

**Timeline**

Known events and dates associated with the entity.

**Explore Further**

Related stories, challenges, and suggested discoveries.

Only display a tab if sufficient information is available.

## Content handling

- Preserve source identifiers.
- Track data origin.
- Clearly indicate missing values.
- Avoid inventing biographies or descriptions.
- Respect Wikipedia text attribution requirements.
- Respect Wikimedia Commons file-specific licenses.
- Do not imply that every Wikidata statement has independent citations.

---

# 7. DATA STRATEGY

## 7.1 Wikidata — primary knowledge graph

Documentation:
https://www.wikidata.org/wiki/Wikidata:Data_access

Use Wikidata for:

- Entity identification
- Entity labels
- Entity descriptions
- Statements
- Relationship properties
- Entity types
- Dates
- Locations
- Stable identifiers

Wikidata structured data is generally available under CC0.

### Important design decision

Wikidata is not a perfectly curated semantic network.

Its relationships can be:

- Ambiguous
- Overly broad
- Missing
- Duplicated in effect
- Weakly referenced
- Highly connected through generic classes

Implement a curated relationship allowlist for the first MVP.

Avoid indiscriminately presenting every available property.

## 7.2 Wikipedia — narrative context

Use Wikipedia for:

- Article summaries
- Background context
- Relevant article links
- Human-readable explanations

Access using appropriate Wikimedia APIs.

Maintain attribution and comply with the relevant content licenses.

Wikipedia article text must not be treated as CC0 merely because Wikidata structured data is CC0.

## 7.3 Wikimedia Commons — media

Use Wikimedia Commons for:

- Historical portraits
- Scientific illustrations
- Maps
- Photographs
- Cultural artifacts

Record the following when provided:

- File identifier
- Artist/creator
- License
- Attribution
- Source URL
- Description
- Modification status

Build an attribution system early rather than retrofitting it later.

## 7.4 API integration rules

- Use documented endpoints.
- Provide an appropriate identifying User-Agent.
- Respect Wikimedia rate limits and usage policies.
- Implement server-side caching.
- Use retries with exponential backoff for transient failures.
- Apply request timeouts.
- Avoid uncontrolled parallel API requests.
- Limit expensive public SPARQL queries.
- Prefer targeted entity retrieval over enormous live graph queries.
- Store source identifiers and fetch timestamps.
- Do not assume that all source responses are complete or perfectly consistent.

A locally cached, curated dataset should support daily challenges and featured stories.

---

# 8. PROPOSED TECHNICAL ARCHITECTURE

Use a maintainable architecture with clear separation of concerns.

## 8.1 Frontend

**Recommended:**

- React
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Cytoscape.js for interactive graphs
- Lightweight state management such as Zustand

Cytoscape.js is the initial recommendation, not an irreversible constraint. Benchmark it against alternative graph renderers if necessary.

### Frontend responsibilities

- Search interface
- Graph rendering
- Node interactions
- Navigation history
- Filters
- Entity profile panels
- Challenge interface
- Story interface
- Responsive layouts
- Accessibility

## 8.2 Backend

**Recommended:**

- Python
- FastAPI
- Pydantic
- HTTPX
- PostgreSQL
- Redis or another suitable cache when needed

A Python backend aligns with future analytical and graph-processing development.

### Backend responsibilities

- Wikimedia API integration
- Entity normalization
- Relationship extraction
- Relationship filtering
- Graph expansion
- Source tracking
- Caching
- Challenge generation
- Pathfinding
- Story delivery
- Rate limiting
- Validation

Do not add Redis, a job queue, or a graph database until actual workload justifies them.

For the initial MVP, a lightweight cache and PostgreSQL may be sufficient.

## 8.3 Initial system architecture

```text
                     USER
                      |
                      v
              React Frontend
                      |
        +-------------+-------------+
        |             |             |
        v             v             v
     Search        Graph UI      Challenges
        |             |             |
        +-------------+-------------+
                      |
                      v
                FastAPI Backend
                      |
       +--------------+---------------+
       |              |               |
       v              v               v
   Entity Service  Graph Service  Game Service
       |              |               |
       +--------------+---------------+
                      |
                      v
             Data Access Layer
                      |
       +--------------+---------------+
       |              |               |
       v              v               v
    Cache         PostgreSQL     Wikimedia APIs
                                    |
                           +--------+--------+
                           |        |        |
                        Wikidata Wikipedia Commons
```

## 8.4 API endpoints

Suggested initial internal API:

```text
GET /api/health

GET /api/search?q=...
GET /api/entities/{wikidata_id}
GET /api/entities/{wikidata_id}/neighbors
GET /api/graph?entity=...&depth=1

GET /api/stories
GET /api/stories/{story_id}

GET /api/challenges/daily
POST /api/challenges/validate-move
POST /api/challenges/verify-path
```

All endpoints should use typed response contracts and predictable error handling.

Sample normalized entity:

```json
{
  "id": "Q7251",
  "label": "Alan Turing",
  "description": "English mathematician and computer scientist",
  "types": [],
  "image": null,
  "source": "wikidata",
  "source_url": "https://www.wikidata.org/wiki/Q7251"
}
```

Example graph response:

```json
{
  "nodes": [],
  "edges": [],
  "root_id": "Q7251",
  "truncated": false,
  "fetched_at": null
}
```

Suggested edge structure:

```json
{
  "id": "unique-statement-id",
  "source": "Q...",
  "target": "Q...",
  "property_id": "P...",
  "label": "field of work",
  "direction": "forward",
  "references": [],
  "qualifiers": {},
  "provenance": "wikidata"
}
```

Replace placeholders with real verified data in implementation.

---

# 9. DATABASE MODEL

Start with the minimum entities needed.

## entities

- id
- wikidata_id
- label
- description
- entity_type
- image_url
- source_url
- fetched_at
- updated_at

## relationships

- id
- source_entity_id
- target_entity_id
- property_id
- relationship_label
- statement_id
- qualifiers_json
- references_json
- fetched_at

## stories

- id
- slug
- title
- description
- category
- image_url
- publication_status
- updated_at

## story_steps

- id
- story_id
- step_order
- entity_id
- explanation
- references_json

## challenges

- id
- challenge_date
- starting_entity_id
- destination_entity_id
- allowed_relationship_types
- known_solution_json
- graph_version
- publication_status

## saved_paths

Initially, store exploration paths client-side or encode them in shareable URLs.

User accounts and server-side saved-path storage are deferred until needed.

## Design requirements

- Keep original source IDs.
- Prevent duplicate entities.
- Preserve relationship direction.
- Support schema migrations.
- Index frequently searched identifiers.
- Record data freshness.
- Avoid storing unnecessary personal information.

---

# 10. GRAPH INTELLIGENCE

RabbitHole should eventually become more than a network viewer.

## 10.1 Relationship ranking

Prioritize meaningful connections.

A simple scoring model might consider:

- Relationship relevance
- Property specificity
- Node category
- Source completeness
- Graph diversity
- Whether the connection is already visible

Avoid giving excessive weight to generic relationships such as "instance of" or "subclass of."

A node with thousands of statements should not overwhelm the interface.

## 10.2 Pathfinding

Use graph algorithms to find connections between selected entities.

Potential algorithms:

- Breadth-first search
- Bidirectional breadth-first search
- Dijkstra's algorithm when using weighted edges

Start with bounded search over a locally available subgraph.

Do not attempt unlimited global shortest-path queries against public Wikidata infrastructure.

## 10.3 Discovery recommendations

Suggest interesting connections using:

- Graph neighborhoods
- Shared entities
- Category diversity
- Curated discovery lists
- Relationship specificity

Clearly distinguish algorithmic recommendations from established factual relationships.

## 10.4 Future intelligence features

Potential future additions:

- Semantic similarity
- Knowledge graph embeddings
- Personalized recommendations with user consent
- AI-generated explanatory summaries with citations
- Graph community detection
- Concept clustering

These are future enhancements, not MVP requirements.

---

# 11. USER INTERFACE DESIGN

## Visual direction

RabbitHole should look like a modern discovery product, not a traditional enterprise dashboard.

### Design characteristics

- Dark-first interface with light-mode support
- Minimal navigation
- Spacious layouts
- High-contrast typography
- Subtle motion
- Smooth graph transitions
- Contextual entity previews
- Distinct but restrained category colors
- Clear loading and error states

### Main application layout

```text
+--------------------------------------------------+
| RabbitHole       Search...       Explore   Games |
+--------------------------------------------------+
|                                                  |
|  CONTROLS                         ENTITY PANEL    |
|                                                  |
|  Categories        INTERACTIVE     Alan Turing    |
|  Filters           KNOWLEDGE       Image          |
|  Graph depth       NETWORK         Description    |
|  Layout options                    Facts          |
|                                    Connections    |
|                                    Sources        |
|                                                  |
+--------------------------------------------------+
| Exploration path / Breadcrumb navigation         |
+--------------------------------------------------+
```

On mobile, replace persistent side panels with accessible drawers or sheets.

### Essential usability requirements

- Keyboard navigation
- Accessible controls
- Reduced-motion support
- Screen-reader-readable entity details
- Responsive graph controls
- Visible source attribution
- Graceful empty states
- Useful errors instead of blank screens

---

# 12. REPOSITORY ORGANIZATION

Suggested structure:

```text
rabbithole/
|
+-- frontend/
|   +-- src/
|   |   +-- components/
|   |   +-- pages/
|   |   +-- features/
|   |   |   +-- search/
|   |   |   +-- graph/
|   |   |   +-- profiles/
|   |   |   +-- challenges/
|   |   |   +-- stories/
|   |   +-- hooks/
|   |   +-- services/
|   |   +-- types/
|   |   +-- utils/
|   +-- package.json
|
+-- backend/
|   +-- app/
|   |   +-- api/
|   |   +-- models/
|   |   +-- schemas/
|   |   +-- services/
|   |   +-- integrations/
|   |   +-- graph/
|   |   +-- database/
|   |   +-- config/
|   +-- tests/
|   +-- pyproject.toml
|
+-- data/
|   +-- seeds/
|   +-- samples/
|
+-- docs/
|   +-- architecture.md
|   +-- data-sources.md
|   +-- api.md
|   +-- roadmap.md
|   +-- contributing.md
|
+-- .github/
|   +-- workflows/
|
+-- .env.example
+-- README.md
+-- LICENSE
+-- docker-compose.yml
```

Keep real secrets, private environment files, and large generated datasets out of version control.

---

# 13. DEVELOPMENT ROADMAP

The project should be built in clearly separated phases.

Do not build all features simultaneously.

Each phase must produce a demonstrable improvement and pass explicit acceptance criteria before moving to the next.

## PHASE 0 — FOUNDATION

**Goal:** Establish a functioning, documented development environment.

### Tasks

- Initialize Git repository.
- Create frontend.
- Create backend.
- Configure local development.
- Configure environment variables.
- Set up formatting and linting.
- Establish API health endpoint.
- Add initial README.
- Set up automated tests.
- Create a simple continuous integration workflow.
- Establish dependency and license documentation.

### Deliverables

- Running React application.
- Running FastAPI application.
- Successful frontend/backend communication.
- Reproducible setup instructions.
- Basic CI pipeline.

### Acceptance criteria

- A new developer can run the project using documented steps.
- Application starts without critical errors.
- Health endpoint responds.
- Automated checks pass.

**Priority:** Critical  
**Estimated effort:** 1–3 focused development days

---

## PHASE 1 — KNOWLEDGE DATA ENGINE

**Goal:** Fetch, normalize, and return usable Wikidata entities and relationships.

### Tasks

- Implement Wikimedia API client.
- Implement entity search.
- Implement Wikidata ID resolution.
- Implement entity retrieval.
- Normalize labels and descriptions.
- Extract a curated set of relationship types.
- Handle language fallback.
- Implement caching.
- Implement timeouts and error handling.
- Preserve source references.
- Add unit and integration tests with mocked responses.

### Deliverables

- Working search endpoint.
- Working entity endpoint.
- Working relationship endpoint.
- Consistent JSON schemas.

### Acceptance criteria

- Search returns matching entities.
- Entity retrieval resolves valid Wikidata IDs.
- Extracted relationships reference actual statements.
- API failures are handled gracefully.
- Repeated calls use the cache appropriately.
- Tests pass without relying on live external API availability.

**Priority:** Critical  
**Estimated effort:** 3–5 focused development days

---

## PHASE 2 — FIRST INTERACTIVE GRAPH

**Goal:** Turn structured knowledge into an explorable visual network.

### Tasks

- Integrate Cytoscape.js.
- Build graph canvas.
- Implement node rendering.
- Implement edge rendering.
- Connect frontend to backend.
- Add node expansion.
- Add pan and zoom.
- Add graph recentering.
- Add simple layout controls.
- Add an entity details panel.
- Add relationship labels.
- Implement graph size limits.

### Deliverables

- Users can search a topic.
- Users can inspect its connections.
- Users can expand into additional subjects.

### Acceptance criteria

- Graph displays real API-derived data.
- Nodes are uniquely identified.
- Edges preserve semantic direction.
- Node expansion works.
- Users can inspect sources.
- No major interface freezes occur in ordinary use.

**Priority:** Critical  
**Estimated effort:** 4–7 focused development days

---

## PHASE 3 — POLISHED DISCOVERY EXPERIENCE

**Goal:** Transform the technical prototype into a usable public-facing application.

### Tasks

- Design homepage.
- Implement autocomplete.
- Add featured topics.
- Add category filters.
- Add node previews.
- Implement navigation history.
- Improve responsive layouts.
- Add loading skeletons.
- Add friendly error states.
- Implement shareable exploration URLs.
- Add attribution components.
- Improve accessibility.

### Deliverables

- Complete homepage.
- Responsive graph explorer.
- Entity profile experience.
- Shareable links.

### Acceptance criteria

- A first-time visitor can understand the application.
- Search and discovery are intuitive.
- The site works on desktop and mobile.
- Sources and image licenses remain visible.
- Browser refresh preserves URL-based exploration.
- Keyboard-accessible alternatives exist.

**Priority:** High  
**Estimated effort:** 4–7 focused development days

---

## PHASE 4 — CONNECTION CHALLENGE

**Goal:** Create RabbitHole's first differentiated interaction.

### Tasks

- Build challenge interface.
- Implement start/end entity selection.
- Implement path tracking.
- Implement move validation.
- Add step counter.
- Implement completion state.
- Create curated test challenges.
- Add hints.
- Add daily challenge support.
- Add shareable results.

### Deliverables

- Free Challenge.
- Curated Daily Challenge.
- Challenge result screen.

### Acceptance criteria

- All published challenges are solvable.
- User moves correspond to valid relationships.
- Results cannot be falsified by changing frontend state alone.
- Challenges do not require unbounded public API traversal.
- Users can replay challenges.

**Priority:** High  
**Estimated effort:** 5–8 focused development days

---

## PHASE 5 — DISCOVERY STORIES

**Goal:** Introduce guided educational exploration.

### Tasks

- Create story data model.
- Create story API.
- Implement story viewer.
- Support entity transitions.
- Integrate photographs and illustrations.
- Add progress navigation.
- Build a small set of curated stories.
- Add source and attribution details.
- Link stories to free exploration.

### Deliverables

- Story browsing interface.
- Functional story player.
- At least three verified stories.

### Acceptance criteria

- Story transitions work.
- Sources are accessible.
- All required images display legally and correctly.
- Users can move from a story into the graph.
- Content is understandable without prior subject expertise.

**Priority:** Medium  
**Estimated effort:** 4–7 focused development days

---

## PHASE 6 — PUBLIC BETA

**Goal:** Release a stable free version to the public.

### Tasks

- Create production build.
- Configure deployment.
- Configure domain and HTTPS.
- Deploy frontend and backend.
- Configure database and caching.
- Add monitoring and error reporting.
- Test external API failures.
- Test rate limits and load behavior.
- Verify licensing and attribution.
- Complete accessibility audit.
- Add privacy policy where required.
- Add contribution guidelines.
- Add issue templates.
- Document limitations.
- Complete production smoke tests.

### Deliverables

- Public beta website.
- Public source repository.
- Deployment documentation.
- Clear feedback and issue-reporting channel.

### Acceptance criteria

- Production site is accessible.
- Search and exploration work.
- No critical errors occur in main flows.
- External API failures are handled.
- Secrets are protected.
- Source attribution is correct.
- Deployment is reproducible.
- Licensing obligations have been reviewed.

**Priority:** Critical  
**Estimated effort:** 4–7 focused development days

---

# 14. ROADMAP SUMMARY

| Phase | Milestone | Priority | Estimated effort |
|---|---|---|---|
| 0 | Foundation | Critical | 1–3 days |
| 1 | Knowledge Data Engine | Critical | 3–5 days |
| 2 | Interactive Graph | Critical | 4–7 days |
| 3 | Discovery Experience | High | 4–7 days |
| 4 | Connection Challenge | High | 5–8 days |
| 5 | Discovery Stories | Medium | 4–7 days |
| 6 | Public Beta | Critical | 4–7 days |

**Total planning estimate:** 25–44 focused development days.

This assumes a single developer using established libraries and AI-assisted coding. It excludes prolonged API issues, major redesigns, and significant historical data curation.

## MVP boundaries

The first usable MVP consists of Phases 0–3.

The first differentiated beta adds Phase 4.

Phase 5 may be completed before launch or delivered in a later release if it threatens the stability of the main product.

---

# 15. LONG-TERM EXPANSION — TIMEATLAS

Once RabbitHole's data and graph architecture is stable, add historical exploration as a separate visualization mode.

This is the longer-term vision.

## 15.1 Historical timeline

Let users explore entities and events through time.

Examples:

- Discoveries during the 1800s
- Scientists alive during a particular period
- Empires associated with a century
- Inventions and their historical context

Start with dated entities and events rather than attempting full global border reconstruction.

## 15.2 Geographic exploration

Display historical entities on an interactive map when reliable coordinates are available.

Examples:

- Birthplaces of influential scientists
- Locations of historical inventions
- Important ancient cities
- Places connected to a historical event

Distinguish present-day coordinates from reconstructed historical geography.

## 15.3 Historical boundaries

Consider later integration with OpenHistoricalMap and historical GIS datasets.

Do not assume that borders are complete, universally agreed upon, or consistently dated.

Each historical polygon should include:

- Source
- Date or valid interval
- Geographic scope
- Uncertainty information
- Relevant license

## 15.4 Unified exploration

The eventual interface could support:

**Graph Mode** — Explore relationships.

**Timeline Mode** — Explore knowledge through time.

**Map Mode** — Explore knowledge geographically.

**Story Mode** — Follow curated narratives.

All modes should share stable entity identifiers where possible.

TimeAtlas must remain an optional expansion, not a dependency for launching RabbitHole.

---

# 16. QUALITY AND ENGINEERING STANDARDS

## Testing

Implement:

- Unit tests for normalization.
- API contract tests.
- Graph relationship validation.
- Search behavior tests.
- Duplicate-node tests.
- Challenge path validation.
- Integration tests with mocked Wikimedia responses.
- Frontend interaction tests.
- Accessibility checks.
- Production smoke tests.

## Security

- Never expose server secrets to the frontend.
- Validate user-supplied identifiers.
- Restrict query sizes.
- Apply sensible rate limiting.
- Avoid arbitrary URL fetching.
- Sanitize externally sourced content.
- Prevent script injection.
- Keep dependencies updated.
- Avoid collecting unnecessary personal data.

## Observability

Monitor:

- API error rates
- Response times
- Cache effectiveness
- External API failures
- Graph expansion latency
- Frontend errors

Keep analytics privacy-conscious and optional where possible.

## Licensing

Select an appropriate open-source code license before publishing.

Track code, data, text, and media licensing separately.

Verify third-party dependency licenses.

Document obligations for Wikipedia-derived text and Wikimedia Commons media.

---

# 17. TRACKING AND PROJECT MANAGEMENT

Maintain the following documents:

**README.md**  
Project overview, features, installation, and links.

**docs/architecture.md**  
Architecture and data flow.

**docs/roadmap.md**  
Development milestones and status.

**docs/data-sources.md**  
APIs, attribution, licensing, and known limitations.

**docs/decisions.md**  
Architectural decision records.

**docs/changelog.md**  
Completed changes and releases.

**docs/backlog.md**  
Outstanding tasks and future features.

Track individual tasks using:

- Task ID
- Phase
- Description
- Priority
- Dependencies
- Status
- Acceptance criteria
- Relevant files
- Verification result

Recommended statuses:

- Not started
- In progress
- Blocked
- Completed
- Verified

A task is not completed merely because code has been written. It must satisfy its acceptance criteria.

---

# 18. INITIAL DEVELOPMENT SPRINT

The first sprint should focus exclusively on proving the full data-to-visualization flow.

## Sprint objective

Make it possible to search for a subject and see real Wikidata relationships in a functioning browser-based graph.

## Sprint tasks

**RAB-001: Repository initialization**

Create frontend and backend structure.

**RAB-002: API health check**

Establish working backend communication.

**RAB-003: Wikidata search integration**

Search for entities through a documented API.

**RAB-004: Entity normalization**

Return standardized entity data.

**RAB-005: Relationship extraction**

Extract a small curated subset of supported relationships.

**RAB-006: Graph interface**

Display nodes and edges.

**RAB-007: Node expansion**

Allow users to expand neighboring entities.

**RAB-008: Source attribution**

Expose underlying Wikidata identifiers and original statements.

**RAB-009: Error handling**

Handle empty results, unavailable APIs, and malformed data.

**RAB-010: Automated verification**

Add tests for the complete core pipeline.

## Sprint completion definition

The sprint is successful when:

1. The application runs locally.
2. Searching for a known entity works.
3. The frontend displays that entity.
4. Real connected entities appear.
5. Every displayed relationship has a valid source.
6. Clicking a node expands the graph.
7. Basic tests pass.
8. The result is committed to version control.

---

# 19. INSTRUCTIONS TO CHATGPT WORK

You are acting as the technical architect, software engineer, and implementation partner for RabbitHole.

Treat this document as the product specification and initial development roadmap.

## Your responsibilities

1. Analyze the project architecture and identify important technical risks.
2. Inspect the existing workspace before creating or modifying files.
3. Establish a maintainable codebase.
4. Implement features in the defined phase order.
5. Produce functioning code, not merely conceptual suggestions.
6. Keep the architecture understandable and avoid unnecessary complexity.
7. Write tests alongside implementation.
8. Maintain project documentation.
9. Keep changes incremental and reversible.
10. Respect licensing, API restrictions, accessibility, and source provenance.
11. Keep the project deployable using low-cost infrastructure.
12. Report completed work accurately and distinguish tested functionality from assumptions.

## Operating rules

- Do not redesign the product without a concrete technical reason.
- Do not implement future phases prematurely.
- Do not invent data or source relationships.
- Do not claim a feature works without verifying it.
- Do not install unnecessary dependencies.
- Do not expose credentials.
- Do not overwrite existing work without inspecting it.
- Do not make irreversible external changes without authorization.
- Do not use placeholder data in the finished core graph unless explicitly labeled as sample data.
- Document external API assumptions.
- Prefer reliable, simple solutions over premature optimization.

## Required reporting after each completed task

Provide:

**Task ID:**  
**Objective:**  
**Files created or modified:**  
**Implementation summary:**  
**Tests performed:**  
**Results:**  
**Known limitations:**  
**Updated roadmap status:**  
**Next dependency:**

Keep reporting compact but verifiable.

## Initial execution request

Begin with **Phase 0 — Foundation**, then establish the smallest viable vertical slice for Phase 1.

First inspect the workspace and determine whether a RabbitHole repository already exists.

If it exists, inspect its current state before modification.

If it does not exist, initialize the project using the proposed structure.

Verify the local environment, establish the frontend and backend, configure development tooling, and implement the initial health check and Wikimedia API client.

Then verify that a real Wikidata entity can be searched and retrieved.

Record the results in the project documentation and update the roadmap.

Do not attempt to complete the entire application in a single uncontrolled implementation pass.

The desired end result is a polished, credible, open-source knowledge exploration application that ordinary people can use for free, while retaining a technically sound foundation for future graph intelligence and historical exploration.