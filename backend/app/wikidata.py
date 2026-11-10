"""Bounded access to Wikimedia APIs with short deadlines and shared rate-limit cooldowns."""

import asyncio
from collections import OrderedDict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import json
import math
import os
import time

import httpx

ENDPOINT = "https://www.wikidata.org/w/api.php"
USER_AGENT = "RabbitHole/0.1 (https://github.com/geeeerd/rabbithole; open-source knowledge explorer)"
CACHE_ENTRIES = 64
CACHE_ITEM_BYTES = 128 * 1024
CACHE_TTL = 3600
REQUEST_DEADLINE = 7
RESPONSE_TYPES = {"wbsearchentities": ("search", list), "wbgetentities": ("entities", dict), "query": ("query", dict)}


class WikimediaClient:
    def __init__(self, endpoint: str = ENDPOINT):
        self.endpoint = endpoint
        self.cache: OrderedDict[str, tuple[float, bytes]] = OrderedDict()
        self.pending: dict[str, asyncio.Task] = {}
        self.concurrency = asyncio.Semaphore(3)
        self.cooldown_until = 0.0

    async def request(self, params: dict) -> dict:
        key = json.dumps(params, sort_keys=True)
        cached = self.cache.get(key)
        if cached and time.monotonic() - cached[0] < CACHE_TTL:
            self.cache.move_to_end(key)
            return json.loads(cached[1])

        task = self.pending.get(key)
        if task is None:
            task = asyncio.create_task(self.fetch(key, params))
            self.pending[key] = task

            def release(done: asyncio.Task) -> None:
                self.pending.pop(key, None)
                # A disconnected caller may no longer be around to read the error.
                if not done.cancelled():
                    done.exception()

            task.add_done_callback(release)
        return await asyncio.shield(task)

    async def fetch(self, key: str, params: dict) -> dict:
        try:
            async with asyncio.timeout(REQUEST_DEADLINE), self.concurrency:
                if time.monotonic() < self.cooldown_until:
                    raise ValueError("Wikidata has asked clients to retry later")
                headers = {"User-Agent": os.environ.get("WIKIMEDIA_USER_AGENT", USER_AGENT)}
                async with httpx.AsyncClient(timeout=4, headers=headers) as client:
                    response = await self.fetch_response(client, params)
                data = response.json()
                expected, expected_type = RESPONSE_TYPES[params["action"]]
                if not isinstance(data, dict) or not isinstance(data.get(expected), expected_type):
                    error = data.get("error") if isinstance(data, dict) else None
                    if isinstance(error, dict) and error.get("code") == "maxlag":
                        self.cooldown(response.headers.get("Retry-After"))
                    raise ValueError("Unexpected Wikidata response")
                if len(response.content) <= CACHE_ITEM_BYTES:
                    self.cache[key] = (time.monotonic(), response.content)
                    self.cache.move_to_end(key)
                    if len(self.cache) > CACHE_ENTRIES:
                        self.cache.popitem(last=False)
                return data
        except TimeoutError as error:
            raise ValueError("Wikidata request timed out") from error

    async def fetch_response(self, client: httpx.AsyncClient, params: dict) -> httpx.Response:
        query = {"format": "json", "maxlag": 5, **params}
        for attempt in range(2):
            if time.monotonic() < self.cooldown_until:
                raise ValueError("Wikidata has asked clients to retry later")
            try:
                response = await client.get(self.endpoint, params=query)
            except httpx.TransportError:
                if attempt:
                    raise
            else:
                retry_after = response.headers.get("Retry-After")
                if response.status_code == 429 or (response.status_code == 503 and retry_after):
                    self.cooldown(retry_after)
                elif response.status_code in (502, 503, 504) and not attempt:
                    await asyncio.sleep(0.25)
                    continue
                response.raise_for_status()
                return response
            await asyncio.sleep(0.25)
        raise ValueError("Wikidata request failed")

    def cooldown(self, retry_after: str | None) -> None:
        delay = 30.0
        if retry_after:
            try:
                delay = float(retry_after)
            except ValueError:
                try:
                    date = parsedate_to_datetime(retry_after)
                    delay = (date - datetime.now(timezone.utc)).total_seconds()
                except (TypeError, ValueError, OverflowError):
                    pass
        until = time.monotonic() + (max(1, delay) if math.isfinite(delay) else 30)
        self.cooldown_until = max(self.cooldown_until, until)
