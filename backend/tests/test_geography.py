from fastapi.testclient import TestClient

from app.geography import coordinate
from app.main import app


def claim(identifier, latitude, longitude, globe='Q2', rank='normal'):
    return {'id': identifier, 'rank': rank, 'mainsnak': {'snaktype': 'value', 'datavalue': {'value': {
        'latitude': latitude, 'longitude': longitude, 'globe': 'http://www.wikidata.org/entity/' + globe,
        'precision': 0.01,
    }}}}


def test_coordinates_prefer_supported_earth_records():
    item = {'id': 'Q90', 'claims': {'P625': [
        claim('normal', 48.8, 2.3), claim('mars', 10, 20, 'Q111', 'preferred'),
        claim('invalid', 100, 20, rank='preferred'), claim('preferred', 48.85, 2.35, rank='preferred'),
    ]}}
    point = coordinate(item)
    assert point.statement_id == 'preferred' and point.precision == 0.01
    assert point.source_url.endswith('/Q90#P625')


def test_saved_map_links_coordinates_and_places_without_live_queries(monkeypatch):
    from app import main

    async def no_network(*_args, **_kwargs):
        raise AssertionError('Saved maps should not make live requests')

    monkeypatch.setattr(main, 'request', no_network)
    with TestClient(app) as client:
        data = client.get('/api/entities/Q7259/places?offline=true').json()
        assert data['offline'] and data['subject']['id'] == 'Q7259'
        london = next(point for point in data['points'] if point['entity']['id'] == 'Q84')
        assert london['coordinate']['statement_id']
        assert any(edge['property_id'] == 'P19' and edge['source'] == 'Q7259' for edge in london['relationships'])
        paris = client.get('/api/entities/Q90/places?offline=true').json()
        assert any(point['entity']['id'] == 'Q90' and not point['relationships'] for point in paris['points'])
