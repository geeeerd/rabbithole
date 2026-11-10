from fastapi.testclient import TestClient

from app.main import app
from app.timeline import recorded_date


def snak(timestamp, precision, calendar="Q1985727", before=0):
    return {"snaktype": "value", "datavalue": {"type": "time", "value": {
        "time": timestamp, "precision": precision, "before": before, "after": 0,
        "calendarmodel": "http://www.wikidata.org/entity/" + calendar,
    }}}


def test_timeline_preserves_bce_coarse_dates_and_original_calendar():
    date = recorded_date(snak("-0458-00-00T00:00:00Z", 9, "Q1985786"), {})
    assert date.label == "458 BCE" and date.calendar == "Julian"
    assert date.month is None and date.day is None
    century = recorded_date(snak("+1800-01-01T00:00:00Z", 7), {"P1480": [{}]})
    assert century.label == "18th century" and century.uncertain
    month = recorded_date(snak("+1912-06-00T00:00:00Z", 10, before=1), {})
    assert month.label == "June 1912" and month.day is None and month.uncertain
    assert recorded_date(snak("+0000-01-01T00:00:00Z", 11), {}) is None
    assert recorded_date(snak("+1912-02-31T00:00:00Z", 11), {}) is None
    assert recorded_date(snak("+1912-06-23T00:00:00Z", 11, "Q1"), {}) is None


def test_saved_timeline_has_ordered_dates_and_sources_without_upstream(monkeypatch):
    from app import main

    async def forbid_network(*_args, **_kwargs):
        raise AssertionError("Saved timelines should never make a live request")

    monkeypatch.setattr(main, "request", forbid_network)
    with TestClient(app) as client:
        response = client.get("/api/entities/Q7251/timeline?offline=true")
        assert response.status_code == 200
        timeline = response.json()
        assert timeline["offline"] and timeline["subject"]["id"] == "Q7251"
        entries = timeline["entries"]
        assert any(entry["property_id"] == "P569" and entry["date"]["year"] == 1912 for entry in entries)
        assert [entry["date"]["year"] for entry in entries] == sorted(entry["date"]["year"] for entry in entries)
        assert all(entry["source_url"].startswith("https://www.wikidata.org/") and entry["statement_id"] for entry in entries)
        assert client.get("/api/entities/Q999999999999/timeline?offline=true").status_code == 404
        assert client.get("/api/entities/bad/timeline").status_code == 422
