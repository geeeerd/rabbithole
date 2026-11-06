import asyncio
import json
import os
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from collections import OrderedDict
import httpx
from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel

app = FastAPI(title="RabbitHole API", version="0.1.0")
from .knowledge import SEEDS, PROPERTIES, Entity, Edge, Graph, validate, normalize, extract

cache = OrderedDict()
lock = asyncio.Semaphore(3)

async def request(params):
    key = json.dumps(params, sort_keys=True)
    if key in cache and time.monotonic() - cache[key][0] < 3600:
        return cache[key][1]
    async with lock:
        async with httpx.AsyncClient(timeout=10, headers={"User-Agent": os.getenv("WIKIMEDIA_USER_AGENT", "RabbitHole/0.1 (https://github.com/geeeerd/rabbithole; open-source knowledge explorer)")}) as client:
            for attempt in range(3):
                response = await client.get("https://www.wikidata.org/w/api.php", params={"format": "json", "maxlag": 5, **params})
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt < 2:
                        await asyncio.sleep(min(float(response.headers.get("Retry-After", 2 ** attempt)), 10))
                        continue
                response.raise_for_status()
                result = response.json()
                if "error" in result:
                    if attempt < 2 and result["error"].get("code") == "maxlag":
                        await asyncio.sleep(2 ** attempt)
                        continue
                    raise ValueError("Wikimedia API unavailable")
                cache[key] = (time.monotonic(), result)
                if len(cache) > 256:
                    cache.popitem(last=False)
                return result
    raise ValueError("Wikimedia API unavailable")

async def entities(ids):
    try:
        result = await request({"action": "wbgetentities", "ids": "|".join(ids), "languages": "en", "props": "labels|descriptions|claims"})
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
        items = [normalize(next(iter(json.loads(f.read_text())["entities"].values()))) for f in SEEDS.glob("Q*.json")]
        return {"results": [e for e in items if q.casefold() in e.label.casefold()][:8], "offline": True}

@app.get("/api/entities/{qid}", response_model=Entity)
async def entity(qid: str):
    validate(qid)
    data, offline = await entities([qid])
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
    targets, fallback = await entities(ids) if ids else ({}, False)
    nodes = {entity: normalize(data[entity])}
    nodes.update({k: normalize(v) for k, v in targets.items() if "missing" not in v})
    return Graph(nodes=list(nodes.values()), edges=[e for e in edges if e.target in nodes], root_id=entity, truncated=len(all_edges)>12, offline=offline or fallback, fetched_at=datetime.now(timezone.utc).isoformat())

from .challenges import router as challenge_router
app.include_router(challenge_router)
