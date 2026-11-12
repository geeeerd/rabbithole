import json
from datetime import datetime, timezone
from functools import lru_cache
from typing import Annotated, Literal

import httpx
from fastapi import FastAPI, HTTPException, Query

from .articles import Article, wikipedia_intro
from .challenges import router as challenge_router
from .connections import (
    DEEP_ROUTE_CANDIDATES_PER_TOPIC, DEEP_ROUTE_MAX_STEPS, DEEP_ROUTE_MIDDLE_LIMIT, ROUTE_MAX_STEPS,
    WIKIMEDIA_ADMIN_PROPERTIES,
    GRAPH_LABELS, ITEM_ID, LINK_EDGE_LIMIT, LINK_SOURCE_LIMIT, PAGE_SIZE, IncomingPage, LinkRequest, LinkScan,
    RoutePath, TopicRoute, find_route, graph_statements, route_alternatives, route_candidates, route_statements,
    saved_links, varied_order,
)
from .facts import FACT_PAGE_SIZE, LABELS as FACT_LABELS, FactPage, recorded_facts
from .geography import Place, Places, coordinate, place_links, relationship_dates, saved_places
from .knowledge import SEEDS, Entity, Graph, extract, normalize, validate
from .stories import router as story_router
from .timeline import Timeline, events
from .wikidata import WikimediaClient

app = FastAPI(title="RabbitHole API", version="0.1.0")
wikidata = WikimediaClient()
request = wikidata.request


@lru_cache(maxsize=1)
def offline_search_items():
    return tuple(
        normalize(item)
        for file in sorted(SEEDS.glob("Q*.json"))
        for item in json.loads(file.read_text())["entities"].values()
    )


def seed_entities(ids):
    result = {}
    for qid in ids:
        file = SEEDS / f"{qid}.json"
        if file.exists():
            result.update(json.loads(file.read_text())["entities"])
    return result


async def entities(ids, *, include_claims=True):
    props = "labels|descriptions|claims" if include_claims else "labels|descriptions"
    try:
        result = await request({"action": "wbgetentities", "ids": "|".join(ids), "languages": "en|mul", "props": props})
        return result["entities"], False
    except (httpx.HTTPError, ValueError):
        return seed_entities(ids), True

@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}

@app.get("/api/search")
async def search(q: str = Query(min_length=2, max_length=100)):
    try:
        data = await request({"action": "wbsearchentities", "search": q, "language": "en", "limit": 8})
        return {"results": [Entity(id=e["id"], label=e.get("label", e["id"]), description=e.get("description", ""), source_url=f"https://www.wikidata.org/wiki/{e['id']}") for e in data["search"]], "offline": False}
    except (httpx.HTTPError, ValueError):
        items = offline_search_items()
        return {"results": [e for e in items if q.casefold() in e.label.casefold()][:8], "offline": True}

@app.get("/api/entities/{qid}", response_model=Entity)
async def entity(qid: str):
    validate(qid)
    data, offline = await entities([qid], include_claims=False)
    if qid not in data or "missing" in data[qid]:
        raise HTTPException(503 if offline else 404, "Entity unavailable. Try again shortly.")
    return normalize(data[qid])

@app.get("/api/entities/{qid}/background", response_model=Article)
async def background(qid: str):
    validate(qid)
    try:
        data = await request({"action": "wbgetentities", "ids": qid, "props": "sitelinks", "sitefilter": "enwiki"})
        item = data["entities"].get(qid, {})
        title = item.get("sitelinks", {}).get("enwiki", {}).get("title")
        if not isinstance(title, str) or not title:
            raise HTTPException(404, "This topic has no linked English Wikipedia article.")
        article = await wikipedia_intro(title)
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Wikipedia background is temporarily unavailable. Try again shortly.") from None
    if article is None:
        raise HTTPException(404, "There is no readable article introduction for this topic.")
    return article


@app.get("/api/entities/{qid}/neighbors", response_model=Graph)
async def neighbors(qid: str, offset: Annotated[int, Query(ge=0, le=10000)] = 0):
    return await graph(qid, offset)

@app.get("/api/entities/{qid}/timeline", response_model=Timeline)
async def entity_timeline(qid: str, offline: bool = False):
    validate(qid)
    data, saved = (seed_entities([qid]), True) if offline else await entities([qid])
    if qid not in data or "missing" in data[qid]:
        status = 404 if offline or not saved else 503
        raise HTTPException(status, "No timeline record is available for this topic in the selected source.")
    entries, truncated = events(data[qid])
    related_ids = list(dict.fromkeys(entry.related_id for entry in entries if entry.related_id))
    targets = seed_entities(related_ids)
    if related_ids and not saved:
        live_targets, fallback = await entities(related_ids, include_claims=False)
        targets.update(live_targets)
        saved = saved or fallback
    for entry in entries:
        if entry.related_id in targets and "missing" not in targets[entry.related_id]:
            entry.related_label = normalize(targets[entry.related_id]).label
    return Timeline(subject=normalize(data[qid]), entries=entries, offline=saved, truncated=truncated)


@app.get("/api/entities/{qid}/facts", response_model=FactPage)
async def entity_facts(qid: str, offset: Annotated[int, Query(ge=0, le=10000)] = 0):
    validate(qid)
    records, offline = await entities([qid])
    item = records.get(qid)
    if not item or "missing" in item:
        raise HTTPException(503 if offline else 404, "No fact record is available for this topic.")
    facts = recorded_facts(item)
    page = facts[offset:offset + FACT_PAGE_SIZE]
    identifiers = list(dict.fromkeys(
        key for fact in page for key in (fact.property_id if fact.property_id not in FACT_LABELS else None, fact.unit_id)
        if key is not None
    ))
    if identifiers and not offline:
        metadata, _ = await entities(identifiers, include_claims=False)
        for fact in page:
            prop = metadata.get(fact.property_id)
            unit = metadata.get(fact.unit_id)
            if prop and prop.get("labels"):
                fact.label = normalize(prop).label
            if unit and unit.get("labels"):
                fact.unit_label = normalize(unit).label
    next_offset = offset + FACT_PAGE_SIZE
    return FactPage(facts=page, next_offset=next_offset if next_offset < min(len(facts), 10000) else None,
                    total=len(facts), offline=offline)


@app.get("/api/entities/{qid}/places", response_model=Places)
async def entity_places(qid: str, offline: bool = False):
    validate(qid)
    if offline:
        records, saved = seed_entities([qid]), True
    else:
        records, saved = await entities([qid])
    if saved and qid in saved_places():
        records.setdefault(qid, saved_places()[qid])
    item = records.get(qid)
    if not item or "missing" in item:
        status = 404 if offline or not saved else 503
        raise HTTPException(status, "No place record is available for this topic in the selected source.")

    related, truncated = place_links(item)
    targets = {key: saved_places()[key] for key in related if key in saved_places()}
    targets.update(seed_entities(related))
    if related and not saved:
        live, fallback = await entities(list(related))
        targets.update({key: record for key, record in live.items() if "missing" not in record})
        saved = saved or fallback

    subject = normalize(item)
    points = []
    own = coordinate(item)
    if own:
        points.append(Place(entity=subject, coordinate=own, relationships=[]))
    missing = 0
    for key, relationships in related.items():
        target = targets.get(key)
        location = coordinate(target) if target else None
        if location:
            selected_links = relationships[:6]
            points.append(Place(entity=normalize(target), coordinate=location, relationships=selected_links,
                                relationship_dates=relationship_dates(selected_links)))
        else:
            missing += 1
    return Places(subject=subject, points=points, offline=saved, missing_count=missing, truncated=truncated)


@app.get("/api/entities/{qid}/incoming", response_model=IncomingPage)
async def incoming_connections(qid: str, cursor: Annotated[str | None, Query(max_length=180)] = None):
    validate(qid)
    params = {
        "action": "query", "list": "backlinks", "bltitle": qid, "blnamespace": 0,
        "bllimit": LINK_SOURCE_LIMIT, "blfilterredir": "nonredirects",
    }
    if cursor:
        params.update({"blcontinue": cursor, "continue": "-||"})
    try:
        index = await request(params)
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, "Wikidata incoming-link discovery is temporarily unavailable.") from None

    # The backlinks index suggests candidates. Only an actual directed statement becomes an edge.
    backlinks = index["query"].get("backlinks", [])
    candidates: dict[str, None] = {}
    for page in backlinks[:LINK_SOURCE_LIMIT] if isinstance(backlinks, list) else []:
        if not isinstance(page, dict):
            continue
        candidate = page.get("title")
        if isinstance(candidate, str) and candidate != qid and ITEM_ID.fullmatch(candidate):
            candidates[candidate] = None
    records, offline = await entities(list(candidates)) if candidates else ({}, False)
    if offline:
        raise HTTPException(503, "The incoming statement records could not be verified. Retry shortly.")
    edges = varied_order([
        edge for key in candidates if key in records and "missing" not in records[key]
        for edge in graph_statements(records[key]) if edge.target == qid and edge.source == key
    ])[:LINK_EDGE_LIMIT]
    edges = await resolve_property_labels(edges)
    nodes = [normalize(records[key]) for key in dict.fromkeys(edge.source for edge in edges)]
    continuation = index.get("continue")
    next_cursor = continuation.get("blcontinue") if isinstance(continuation, dict) else None
    return IncomingPage(nodes=nodes, edges=edges, checked=len(candidates),
                        next_cursor=next_cursor if isinstance(next_cursor, str) and next_cursor != cursor else None,
                        fetched_at=datetime.now(timezone.utc).isoformat())


@app.get("/api/graph", response_model=Graph)
async def graph(entity: str = "Q7251", offset: Annotated[int, Query(ge=0, le=10000)] = 0):
    validate(entity)
    data, offline = await entities([entity])
    if entity not in data or "missing" in data[entity]:
        raise HTTPException(503 if offline else 404, "This topic is unavailable. Try Alan Turing or retry shortly.")

    known, reverse = saved_links()
    outgoing = graph_statements(data[entity])
    if offline:
        outgoing = [edge for edge in outgoing if edge.target in known]
    outgoing = varied_order(outgoing)
    incoming = varied_order(reverse.get(entity, []))
    ordered = outgoing[:16] + incoming[:8] + outgoing[16:] + incoming[8:]
    edges = ordered[offset:offset + PAGE_SIZE]
    next_offset = offset + PAGE_SIZE if offset + PAGE_SIZE < min(len(ordered), 10000) else None
    neighbors = list(dict.fromkeys(edge.target if edge.source == entity else edge.source for edge in edges))
    properties = list(dict.fromkeys(edge.property_id for edge in edges if edge.property_id not in GRAPH_LABELS))
    lookups = neighbors + properties
    if not lookups or offline:
        metadata, fallback = seed_entities(neighbors), False
    else:
        metadata, fallback = await entities(lookups, include_claims=False)

    nodes = {entity: normalize(data[entity])}
    for qid in neighbors:
        record = metadata.get(qid)
        if record and "missing" in record:
            continue
        if record:
            nodes[qid] = normalize(record)
        else:
            nodes[qid] = Entity(id=qid, label=qid, description="Label unavailable.", source_url=f"https://www.wikidata.org/wiki/{qid}")
    visible = [edge for edge in edges if edge.source in nodes and edge.target in nodes]
    cross_links = [
        edge for target in nodes if target != entity
        for edge in reverse.get(target, []) if edge.source != entity and edge.source in nodes
    ]
    visible.extend(varied_order(cross_links)[:PAGE_SIZE])
    visible = [edge.model_copy(update={"label": normalize(metadata[edge.property_id]).label})
               if edge.property_id in metadata and metadata[edge.property_id].get("labels") else edge for edge in visible]
    return Graph(
        nodes=list(nodes.values()), edges=visible, root_id=entity,
        truncated=next_offset is not None, offline=offline or fallback,
        fetched_at=datetime.now(timezone.utc).isoformat(), next_offset=next_offset,
        total_statements=len(ordered), saved_edge_ids=[edge.id for edge in visible if offline or edge.source != entity],
    )


async def resolve_property_labels(edges):
    properties = list(dict.fromkeys(edge.property_id for edge in edges if edge.property_id not in GRAPH_LABELS))
    if not properties:
        return edges
    metadata, _ = await entities(properties, include_claims=False)
    return [
        edge.model_copy(update={"label": normalize(metadata[edge.property_id]).label})
        if edge.property_id in metadata and metadata[edge.property_id].get("labels") else edge
        for edge in edges
    ]


@app.get("/api/graph/route", response_model=TopicRoute)
async def graph_route(start: str, target: str, arrows_only: bool = False,
                      depth: Literal["quick", "deep"] = "quick"):
    validate(start)
    validate(target)
    if start == target:
        raise HTTPException(422, "Choose a different destination topic.")
    endpoints, offline = await entities([start, target])
    if any(key not in endpoints or "missing" in endpoints[key] for key in (start, target)):
        raise HTTPException(503 if offline else 404, "One of these topics is unavailable.")

    _, incoming = saved_links()
    live = {} if offline else endpoints
    saved = {edge.id: edge for key in (start, target) for edge in incoming.get(key, [])
             if edge.source not in live and edge.property_id not in WIKIMEDIA_ADMIN_PROPERTIES}
    statements = {edge.id: edge for item in endpoints.values() for edge in route_statements(item)}
    if offline:
        saved.update(statements)
    neighborhood = varied_order(list({**saved, **statements}.values()))
    expanded = neighborhood
    deep = depth == "deep"
    max_steps = DEEP_ROUTE_MAX_STEPS if deep else ROUTE_MAX_STEPS
    steps = find_route(neighborhood, start, target, arrows_only=arrows_only, max_steps=max_steps)
    records = dict(endpoints)
    partial = offline

    async def load_bridges(candidates: list[str], allowed: set[str] | None = None):
        nonlocal partial, saved
        fetched, fallback = await entities(candidates)
        bridges = {key: item for key, item in fetched.items() if key in candidates and "missing" not in item}
        records.update(bridges)
        partial = partial or fallback
        bridge_edges = {edge.id: edge for item in bridges.values() for edge in route_statements(item)
                        if allowed is None or edge.target in allowed}
        if fallback:
            saved.update(bridge_edges)
        else:
            saved = {key: edge for key, edge in saved.items() if edge.source not in bridges}
        return bridge_edges

    candidates = [] if steps and not deep else (
        route_candidates(neighborhood, start, target, DEEP_ROUTE_CANDIDATES_PER_TOPIC)
        if deep else route_candidates(neighborhood, start, target)
    )
    if candidates:
        allowed = set(candidates) | {start, target}
        bridge_edges = await load_bridges(candidates, None if deep else allowed)
        expanded = varied_order(list({**saved, **statements, **bridge_edges}.values()))
        steps = find_route(expanded, start, target, arrows_only=arrows_only, max_steps=max_steps)
        if deep and not steps:
            near_start = {edge.target for edge in neighborhood if edge.source == start}
            if not arrows_only:
                near_start.update(edge.source for edge in neighborhood if edge.target == start)
            middle = list(dict.fromkeys(
                edge.target for edge in varied_order(list(bridge_edges.values()))
                if edge.source in near_start and edge.target not in allowed
            ))[:DEEP_ROUTE_MIDDLE_LIMIT]
            if middle:
                middle_edges = await load_bridges(middle, allowed)
                expanded = varied_order(list({**saved, **statements, **bridge_edges, **middle_edges}.values()))
                steps = find_route(expanded, start, target, arrows_only=arrows_only, max_steps=max_steps)

    alternatives = route_alternatives(expanded, steps, start, target, arrows_only=arrows_only, max_steps=max_steps)
    paths = [steps, *alternatives]
    route_steps = [step for path in paths for step in path]
    ids = list(dict.fromkeys([start, target, *(step.to_id for step in route_steps)]))
    lookups = list(dict.fromkeys([
        *[key for key in ids if key not in records],
        *[step.edge.property_id for step in route_steps if step.edge.property_id not in GRAPH_LABELS],
    ]))
    checked = len(records)
    if lookups:
        metadata, _ = await entities(lookups, include_claims=False)
        records.update({key: item for key, item in metadata.items() if "missing" not in item})
    for step in route_steps:
        prop = records.get(step.edge.property_id)
        if prop and prop.get("labels"):
            step.edge = step.edge.model_copy(update={"label": normalize(prop).label})
    nodes = {key: normalize(records.get(key, {"id": key})) for key in ids}
    route_paths = [RoutePath(nodes=[nodes[start], *(nodes[step.to_id] for step in path)] if path
                            else [nodes[start], nodes[target]], steps=path) for path in paths]
    primary, *other_paths = route_paths
    return TopicRoute(nodes=primary.nodes, steps=primary.steps, alternatives=other_paths, checked=checked,
                      saved_edge_ids=list(dict.fromkeys(step.edge.id for step in route_steps if step.edge.id in saved)),
                      partial=partial, max_steps=max_steps)


@app.post("/api/graph/links", response_model=LinkScan)
async def graph_links(query: LinkRequest):
    visible = set(query.topics)
    sources = list(dict.fromkeys(query.sources))
    if len(visible) < 2 or not set(sources) <= visible:
        raise HTTPException(422, "Choose source topics already visible in the graph.")

    records, offline = await entities(sources)
    scanned = [key for key in sources if key in records and "missing" not in records[key]]
    if not scanned:
        raise HTTPException(503, "No records were available for these topics. Try again shortly.")
    links = varied_order([
        edge for key in scanned for edge in graph_statements(records[key])
        if edge.source in visible and edge.target in visible
    ])
    edges = links[:LINK_EDGE_LIMIT]
    if not offline:
        edges = await resolve_property_labels(edges)
    return LinkScan(
        edges=edges, scanned_ids=scanned,
        saved_edge_ids=[edge.id for edge in edges] if offline else [],
        offline=offline, truncated=len(links) > LINK_EDGE_LIMIT,
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )


app.include_router(challenge_router)
app.include_router(story_router)
