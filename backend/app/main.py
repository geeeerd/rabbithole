import json
from datetime import datetime, timezone
from functools import lru_cache
from typing import Annotated

import httpx
from fastapi import FastAPI, HTTPException, Query

from .challenges import router as challenge_router
from .connections import (
    GRAPH_LABELS, LINK_EDGE_LIMIT, PAGE_SIZE, LinkRequest, LinkScan,
    graph_statements, saved_links, varied_order,
)
from .geography import Place, Places, coordinate, place_links, relationship_dates, saved_places
from .knowledge import SEEDS, Entity, Graph, extract, normalize, validate
from .stories import router as story_router
from .timeline import Timeline, events
from .wikidata import WikidataClient

app = FastAPI(title="RabbitHole API", version="0.1.0")
wikidata = WikidataClient()
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
    properties = list(dict.fromkeys(edge.property_id for edge in edges if edge.property_id not in GRAPH_LABELS))
    if properties and not offline:
        metadata, _ = await entities(properties, include_claims=False)
        edges = [
            edge.model_copy(update={"label": normalize(metadata[edge.property_id]).label})
            if edge.property_id in metadata and metadata[edge.property_id].get("labels") else edge
            for edge in edges
        ]
    return LinkScan(
        edges=edges, scanned_ids=scanned,
        saved_edge_ids=[edge.id for edge in edges] if offline else [],
        offline=offline, truncated=len(links) > LINK_EDGE_LIMIT,
        fetched_at=datetime.now(timezone.utc).isoformat(),
    )


app.include_router(challenge_router)
app.include_router(story_router)
