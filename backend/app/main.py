import json
from datetime import datetime, timezone
from functools import lru_cache

import httpx
from fastapi import FastAPI, HTTPException, Query

from .challenges import router as challenge_router
from .knowledge import SEEDS, Entity, Graph, extract, normalize, validate
from .stories import router as story_router
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


async def entities(ids, *, include_claims=True):
    props = "labels|descriptions|claims" if include_claims else "labels|descriptions"
    try:
        result = await request({"action": "wbgetentities", "ids": "|".join(ids), "languages": "en|mul", "props": props})
        return result["entities"], False
    except (httpx.HTTPError, ValueError):
        result = {}
        for qid in ids:
            file = SEEDS / f"{qid}.json"
            if file.exists():
                result.update(json.loads(file.read_text())["entities"])
        return result, True

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
async def neighbors(qid: str):
    return await graph(qid)

@app.get("/api/graph", response_model=Graph)
async def graph(entity: str = "Q7251"):
    validate(entity)
    data, offline = await entities([entity])
    if entity not in data or "missing" in data[entity]:
        raise HTTPException(503 if offline else 404, "This topic is unavailable. Try Alan Turing or retry shortly.")
    all_edges = extract(data[entity])
    edges = all_edges[:12]
    ids = list(dict.fromkeys(e.target for e in edges))
    targets, fallback = await entities(ids, include_claims=False) if ids else ({}, False)
    nodes = {entity: normalize(data[entity])}
    nodes.update({k: normalize(v) for k, v in targets.items() if "missing" not in v})
    return Graph(nodes=list(nodes.values()), edges=[e for e in edges if e.target in nodes], root_id=entity, truncated=len(all_edges)>12, offline=offline or fallback, fetched_at=datetime.now(timezone.utc).isoformat())

app.include_router(challenge_router)
app.include_router(story_router)
