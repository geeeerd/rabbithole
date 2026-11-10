"""Check a fresh loopback release with concurrent saved-data requests."""

import argparse
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
import json
from math import ceil
from time import perf_counter
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import urlopen


def timed_get(url: str) -> tuple[int, float]:
    started = perf_counter()
    try:
        with urlopen(url, timeout=8) as response:
            assert response.read()
            status = response.status
    except HTTPError as error:
        status = error.code
        if status == 429:
            assert int(error.headers["Retry-After"]) >= 1
        error.close()
    return status, (perf_counter() - started) * 1000


def report(name: str, results: list[tuple[int, float]]) -> Counter:
    counts = Counter(status for status, _ in results)
    timings = sorted(timing for _, timing in results)
    p95 = timings[ceil(0.95 * len(timings)) - 1]
    print(f"{name}: {dict(sorted(counts.items()))}, p95 {p95:.1f} ms")
    return counts


def check(base: str) -> None:
    endpoint = urlsplit(base)
    if (endpoint.scheme != "http" or endpoint.hostname not in ("127.0.0.1", "localhost", "::1")
            or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment or endpoint.path not in ("", "/")):
        raise ValueError("Use the address of a fresh loopback release instance.")
    base = base.rstrip("/")
    with ThreadPoolExecutor(max_workers=8) as pool:
        pages = list(pool.map(timed_get, [base + "/"] * 64))
        assert report("Built homepage", pages) == {200: 64}
        timeline = base + "/api/entities/Q7251/timeline?offline=true"
        api = list(pool.map(timed_get, [timeline] * 48))
        counts = report("Saved timeline burst", api)
        assert set(counts) == {200, 429}
    with urlopen(base + "/api/health", timeout=5) as response:
        assert json.load(response)["status"] == "ok"
    print("Load check passed: bounded API traffic and healthy release after the burst.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    check(parser.parse_args().base)
