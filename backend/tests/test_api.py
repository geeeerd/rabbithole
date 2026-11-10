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

def test_live_contract_with_mocked_upstream(monkeypatch):
    async def fixture_request(params):
        if params['action'] == 'wbsearchentities':
            return {'search': [{'id':'Q7251','label':'Alan Turing','description':'Computer scientist'}]}
        result = {}
        for qid in params['ids'].split('|'):
            f = main.SEEDS / f'{qid}.json'
            if f.exists():
                result.update(json.loads(f.read_text())['entities'])
        return {'entities': result}
    monkeypatch.setattr(main, 'request', fixture_request)
    assert client.get('/api/search?q=Turing').json()['offline'] is False
    graph = client.get('/api/graph?entity=Q7251').json()
    assert graph['offline'] is False
    assert len([edge for edge in graph['edges'] if 'Q7251' in (edge['source'], edge['target'])]) == 24
    assert len({edge['property_id'] for edge in graph['edges']}) > 8
    assert graph['next_offset'] == 24 and graph['truncated'] is True
    more = client.get('/api/graph?entity=Q7251&offset=24').json()
    first_page = {edge['id'] for edge in graph['edges'] if 'Q7251' in (edge['source'], edge['target'])}
    next_page = {edge['id'] for edge in more['edges'] if 'Q7251' in (edge['source'], edge['target'])}
    assert next_page and not first_page.intersection(next_page)
    assert graph['total_statements'] > len(first_page)
    assert client.get('/api/graph?entity=Q7251&offset=-1').status_code == 422
    assert client.get('/api/entities/Q7251').json()['label'] == 'Alan Turing'
    assert client.get('/api/entities/Q999999999999').status_code == 404


def test_cache_prevents_duplicate_upstream_calls(monkeypatch):
    calls = []
    class FakeClient:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, url, params):
            calls.append(params)
            return httpx.Response(200, json={'search': []}, request=httpx.Request('GET',url))
    import httpx
    monkeypatch.setattr(main.httpx, 'AsyncClient', FakeClient)
    main.wikidata.cache.clear()
    async def run():
        params = {'action':'wbsearchentities','search':'cache-test'}
        assert await main.request(params) == {'search': []}
        assert await main.request(params) == {'search': []}
    asyncio.run(run())
    assert len(calls) == 1
    main.wikidata.cache.clear()


def test_link_scan_checks_only_requested_visible_sources(monkeypatch):
    calls = []

    async def fixture_request(params):
        ids = params['ids'].split('|')
        calls.append(ids)
        return {'entities': main.seed_entities(ids)}

    monkeypatch.setattr(main, 'request', fixture_request)
    topics = ['Q7251', 'Q924289', 'Q35794']
    bad = client.post('/api/graph/links', json={'topics': topics, 'sources': ['Q1']})
    assert bad.status_code == 422 and not calls
    scan = client.post('/api/graph/links', json={'topics': topics, 'sources': ['Q924289']}).json()
    assert scan['scanned_ids'] == ['Q924289']
    assert calls[0] == ['Q924289']
    assert any(edge['source'] == 'Q924289' and edge['target'] == 'Q35794' for edge in scan['edges'])
    assert all(edge['source'] == 'Q924289' and edge['target'] in topics for edge in scan['edges'])
    assert not scan['offline'] and not scan['saved_edge_ids']
