"""Exercise a built release over HTTP without relying on Wikimedia availability."""

import argparse
from html.parser import HTMLParser
import json
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.urls = []

    def handle_starttag(self, tag, attributes):
        for key, value in attributes:
            if tag in ("link", "script") and key in ("href", "src") and value and value.startswith("/assets/"):
                self.urls.append(value)


def smoke(base: str, wait: int) -> None:
    def get(path: str, data=None):
        if data is None:
            return urlopen(base + path, timeout=8)
        request = Request(base + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
        return urlopen(request, timeout=8)

    def api(path: str, data=None):
        with get(path, data) as response:
            assert response.headers["Cache-Control"] == "no-store"
            return json.load(response)

    deadline = time.monotonic() + wait
    while True:
        try:
            assert api("/api/health")["status"] == "ok"
            break
        except OSError as error:
            if isinstance(error, HTTPError) and error.code not in (502, 503, 504):
                raise
            if time.monotonic() >= deadline:
                raise
            time.sleep(0.25)

    for route in ("/", "/stories?story=curie-and-paris&step=2", "/challenge", "/timeline?entity=Q7251&saved=1"):
        with get(route) as response:
            page = response.read().decode()
            assert "RabbitHole" in page
            assert response.headers["Cache-Control"] == "no-cache"
            assert "default-src 'self'" in response.headers["Content-Security-Policy"]

    parser = Assets()
    parser.feed(page)
    assert parser.urls
    for path in parser.urls:
        with get(path) as response:
            assert response.read()
            assert "immutable" in response.headers["Cache-Control"]

    timeline = api("/api/entities/Q7251/timeline?offline=true")
    assert timeline["offline"] and any(entry["property_id"] == "P569" for entry in timeline["entries"])

    stories = api("/api/stories")
    assert len(stories) >= 3
    for card in stories:
        story = api("/api/stories/" + card["id"])
        assert len(story["entities"]) == len(story["transitions"]) + 1
        with get(story["image"]["url"]) as response:
            assert response.headers.get_content_type().startswith("image/")
            assert response.read(2) == b"\xff\xd8"

    game = api("/api/challenges/daily")
    for _ in range(game["max_steps"]):
        if game["complete"]:
            break
        game = api("/api/challenges/hint", {"token": game["token"]})
        game = api("/api/challenges/validate-move", {"token": game["token"], "edge_id": game["hint_edge_id"]})
    assert game["complete"]
    assert api("/api/challenges/verify-path", {"token": game["token"]})["complete"]

    for path in ("/api/missing", "/assets/missing.js", "/missing-page"):
        try:
            with get(path):
                raise AssertionError(f"Expected 404 for {path}")
        except HTTPError as error:
            assert error.code == 404
    print("Release smoke passed: deep links, assets, story sources, a complete challenge, and 404s.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", default="http://127.0.0.1:8000")
    parser.add_argument("--wait", type=int, default=20)
    args = parser.parse_args()
    smoke(args.base.rstrip("/"), args.wait)
