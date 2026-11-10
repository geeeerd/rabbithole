from fastapi.testclient import TestClient

from app import main
from app.facts import recorded_facts


def statement(identifier, kind, value):
    return {'id': identifier, 'rank': 'normal', 'mainsnak': {'snaktype': 'value', 'datavalue': {'type': kind, 'value': value}}}


def test_quantities_keep_decimal_precision_units_and_bounds_without_item_edges():
    item = {'id': 'Q90', 'claims': {
        'P1082': [statement('population', 'quantity', {'amount': '+123.4567890', 'unit': 'http://www.wikidata.org/entity/Q5', 'lowerBound': '+123.4', 'upperBound': '+123.5'})],
        'P31': [statement('class', 'wikibase-entityid', {'id': 'Q515'})],
        'P856': [statement('unsafe', 'string', 'javascript:alert(1)')],
    }}
    facts = recorded_facts(item)
    assert len(facts) == 1
    assert facts[0].value == '123.4567890' and facts[0].unit_id == 'Q5'
    assert facts[0].note == 'Recorded range 123.4 to 123.5'
    assert facts[0].source_url.endswith('/Q90#P1082')


def test_fact_endpoint_returns_saved_dates_and_paginates_large_items(monkeypatch):
    async def unavailable(_params):
        raise ValueError('offline')

    monkeypatch.setattr(main, 'request', unavailable)
    with TestClient(main.app) as client:
        data = client.get('/api/entities/Q90/facts').json()
        assert data['offline'] and data['total'] >= len(data['facts']) > 0
        assert len(data['facts']) <= 20
        assert all(fact['id'] and fact['source_url'] for fact in data['facts'])
        if data['next_offset'] is not None:
            page = client.get('/api/entities/Q90/facts', params={'offset': data['next_offset']}).json()
            assert {fact['id'] for fact in data['facts']}.isdisjoint(fact['id'] for fact in page['facts'])
        assert client.get('/api/entities/Q90/facts?offset=-1').status_code == 422
