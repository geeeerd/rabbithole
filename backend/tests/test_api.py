import asyncio
import json
from fastapi.testclient import TestClient
from app import main

client = TestClient(main.app)

def test_health_and_validation():
    assert client.get("/api/health").json()["status"] == "ok"
    assert client.get("/api/graph?entity=invalid").status_code == 422
    assert client.get("/api/search?q=a").status_code == 422

def test_normalization_and_provenance():
    raw = json.loads((main.SEEDS / "Q7251.json").read_text())["entities"]["Q7251"]
    edges = main.extract(raw)
    assert edges and all(e.source == "Q7251" and e.id and e.source_url for e in edges)
    assert main.normalize(raw).label == "Alan Turing"
    assert len({e.id for e in edges}) == len(edges)

def test_offline_graph(monkeypatch):
    async def unavailable(params):
        raise ValueError("offline")
    monkeypatch.setattr(main, "request", unavailable)
    data = client.get("/api/graph").json()
    assert data["offline"] is True
    assert data["edges"]
    ids = [n["id"] for n in data["nodes"]]
    assert len(ids) == len(set(ids))
    assert all(e["target"] in ids for e in data["edges"])
    assert client.get("/api/search?q=Turing").json()["results"]

def test_unsupported_statements():
    assert main.extract({"id":"Q1", "claims":{"P69":[{"mainsnak":{"snaktype":"novalue"}}]}}) == []
