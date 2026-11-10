from fastapi.testclient import TestClient

from app.limits import ApiLimits
from app.main import app
from app.production import create_production_app


def test_built_pages_and_api_are_served_without_route_fallbacks(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "images").mkdir()
    (tmp_path / "maps").mkdir()
    (tmp_path / "licenses").mkdir()
    (tmp_path / "index.html").write_text("<html><title>RabbitHole</title></html>")
    (tmp_path / "assets" / "main-hash.js").write_text("export {};")
    with TestClient(create_production_app(tmp_path)) as client:
        for path in ("/", "/stories?story=curie-and-paris&step=1", "/challenge", "/timeline?entity=Q7251", "/map?entity=Q7251"):
            page = client.get(path)
            assert page.status_code == 200
            assert "RabbitHole" in page.text
            assert page.headers["cache-control"] == "no-cache"
            assert "frame-ancestors 'none'" in page.headers["content-security-policy"]
        assert client.get("/assets/main-hash.js").headers["cache-control"].endswith("immutable")
        assert client.get("/assets/missing.js").status_code == 404
        assert client.get("/api/health").json()["status"] == "ok"
        assert client.get("/api/challenges/daily").headers["cache-control"] == "no-store"
        assert client.get("/api/nonexistent").status_code == 404


def test_rate_limit_ignores_untrusted_forwarded_headers():
    with TestClient(ApiLimits(app, capacity=2)) as client:
        # Invalid identifiers avoid any real upstream traffic.
        assert client.get("/api/graph?entity=bad").status_code == 422
        response = client.get("/api/graph?entity=bad", headers={"X-Forwarded-For": "203.0.113.5"})
        assert response.status_code == 429
        assert int(response.headers["retry-after"]) >= 1
        assert client.get("/api/health").status_code == 200


def test_limit_enforces_body_size_and_replays_valid_game_requests():
    with TestClient(ApiLimits(app, max_body=4096)) as client:
        response = client.post("/api/challenges/verify-path", content=iter([b"x" * 2048] * 3))
        assert response.status_code == 413
        game = client.get("/api/challenges/daily").json()
        response = client.post("/api/challenges/verify-path", json={"token": game["token"]})
        assert response.status_code == 200
        assert response.json()["current"]["id"] == game["current"]["id"]
