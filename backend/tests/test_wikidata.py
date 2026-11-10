import asyncio

import httpx
import pytest

from app import wikidata


def test_concurrent_identical_requests_share_one_upstream_fetch(monkeypatch):
    calls = 0

    async def handle(request):
        nonlocal calls
        calls += 1
        await asyncio.sleep(0)
        return httpx.Response(200, json={"search": []})

    client_class = httpx.AsyncClient
    monkeypatch.setattr(wikidata.httpx, "AsyncClient", lambda **kwargs: client_class(transport=httpx.MockTransport(handle), **kwargs))

    async def run():
        client = wikidata.WikidataClient()
        query = {"action": "wbsearchentities", "search": "Turing"}
        assert await asyncio.gather(*(client.request(query) for _ in range(10))) == [{"search": []}] * 10
        assert await client.request(query) == {"search": []}
        assert not client.pending

    asyncio.run(run())
    assert calls == 1


def test_throttling_prevents_retries_and_new_upstream_requests(monkeypatch):
    calls = 0

    async def handle(request):
        nonlocal calls
        calls += 1
        return httpx.Response(429, headers={"Retry-After": "Wed, 01 Jan 2098 00:00:00 GMT"})

    client_class = httpx.AsyncClient
    monkeypatch.setattr(wikidata.httpx, "AsyncClient", lambda **kwargs: client_class(transport=httpx.MockTransport(handle), **kwargs))

    async def run():
        client = wikidata.WikidataClient()
        with pytest.raises(httpx.HTTPStatusError):
            await client.request({"action": "wbsearchentities", "search": "Turing"})
        with pytest.raises(ValueError, match="retry later"):
            await client.request({"action": "wbsearchentities", "search": "Curie"})

    asyncio.run(run())
    assert calls == 1


def test_slow_upstream_has_a_total_deadline(monkeypatch):
    async def handle(request):
        await asyncio.Event().wait()

    client_class = httpx.AsyncClient
    monkeypatch.setattr(wikidata.httpx, "AsyncClient", lambda **kwargs: client_class(transport=httpx.MockTransport(handle), **kwargs))
    monkeypatch.setattr(wikidata, "REQUEST_DEADLINE", 0.01)

    async def run():
        client = wikidata.WikidataClient()
        with pytest.raises(ValueError, match="timed out"):
            await client.request({"action": "wbsearchentities", "search": "Turing"})
        assert not client.pending

    asyncio.run(run())
