from fastapi.testclient import TestClient
from app.main import app
from app import challenges

client = TestClient(app)


def post(action, game, **kwargs):
    return client.post('/api/challenges/'+action, json={'token':game['token'],**kwargs})


def test_daily_is_offline_solvable_and_each_move_has_provenance(monkeypatch):
    import app.main as main
    async def unavailable(*args):
        raise AssertionError('Challenges must never need the network')
    monkeypatch.setattr(main,'request',unavailable)
    game = client.get('/api/challenges/daily?day=2026-11-10').json()
    assert game['steps'] == 0 and not game['complete']
    assert game['daily_date']
    assert all(choice['edge']['id'] and choice['edge']['source_url'] for choice in game['choices'])
    while not game['complete']:
        hinted = post('hint',game).json()
        # Repeated hints at this position are counted once.
        assert post('hint',hinted).json()['hints_used'] == hinted['hints_used']
        game = post('validate-move',hinted,edge_id=hinted['hint_edge_id']).json()
    assert game['steps'] == 2
    assert game['destination']['id'] == game['current']['id']
    assert post('verify-path',game).json()['complete'] is True
    assert post('validate-move',game,edge_id=game['path'][0]['id']).status_code == 422


def test_invalid_direction_tampering_and_expired_tokens():
    game = client.get('/api/challenges/daily?day=2026-11-10').json()
    backward = next(e for e in challenges.COLLECTIONS["classic"].edges.values() if e['source'] != game['current']['id'])
    assert post('validate-move',game,edge_id=backward['id']).status_code == 422
    assert post('validate-move',game,edge_id='invented').status_code == 422
    assert client.post('/api/challenges/verify-path',json={'token':'tampered'}).status_code == 422
    state = challenges.unseal(game['token'])
    state['expires'] = 0
    assert post('verify-path',{'token':challenges.seal(state)}).status_code == 422
    assert post('verify-path',{'token':game['token']+'x'}).status_code == 422


def test_dead_end_and_undo_keep_progress_and_hint_count():
    game = client.get('/api/challenges/daily?day=2026-11-10').json()
    hint = post('hint',game).json()
    choice = next(c for c in game['choices'] if c['entity']['id'] == 'Q2278254')
    dead_end = post('validate-move',hint,edge_id=choice['edge']['id']).json()
    assert not dead_end['choices'] and not dead_end['complete']
    assert post('hint',dead_end).status_code == 422
    undone = post('undo',dead_end).json()
    assert undone['current']['id'] == game['start']['id']
    assert undone['steps'] == 0 and undone['hints_used'] == 1
    assert post('undo',undone).status_code == 422


def test_practice_rejects_unsolvable_unknown_and_trivial_pairs():
    assert client.get('/api/challenges/collection').json()['entities']
    for start,destination in [('Q35794','Q7251'),('Q1','Q35794'),('Q7251','Q7251')]:
        assert client.post('/api/challenges/custom',json={'start':start,'destination':destination}).status_code == 422
    game = client.post('/api/challenges/custom',json={'start':'Q924289','destination':'Q35794'}).json()
    assert game['id'] == 'practice-v1' and game['daily_date'] is None
    assert len(challenges.COLLECTIONS['classic'].route('Q7251','Q35794')) == 2


def test_daily_rotation_replays_each_reviewed_puzzle_by_date():
    expected = [
        ('2026-11-10', 'classic', 'Q7251', 'Q35794', 2),
        ('2026-11-11', 'computing', 'Q7259', 'Q35794', 3),
        ('2026-11-12', 'science', 'Q7186', 'Q90', 2),
        ('2026-11-13', 'art', 'Q12418', 'Q90', 2),
    ]
    for day, category, start, destination, steps in expected:
        path = '/api/challenges/daily?day=' + day
        game = client.get(path).json()
        assert (game['daily_date'], game['collection'], game['start']['id'], game['destination']['id']) == (day, category, start, destination)
        replay = client.get(path).json()
        assert replay['id'] == game['id'] and replay['graph_version'] == game['graph_version']
        for _ in range(steps):
            game = post('hint', game).json()
            game = post('validate-move', game, edge_id=game['hint_edge_id']).json()
        assert game['complete'] and game['steps'] == steps
    assert client.get('/api/challenges/daily?day=invalid').status_code == 422


def test_new_collections_preserve_classic_progress_and_constrain_practice_pairs():
    classic = client.get('/api/challenges/daily?day=2026-11-06').json()
    assert classic['graph_version'] == '4a16ef7d7cf6a542'
    assert post('verify-path', classic).status_code == 200
    science = client.get('/api/challenges/collection?category=science').json()
    assert {item['id'] for item in science['categories']} == {'classic', 'computing', 'science', 'art'}
    assert science['default_start'] == 'Q7186'
    assert client.post('/api/challenges/custom', json={'category':'science','start':'Q7251','destination':'Q90'}).status_code == 422
    game = client.post('/api/challenges/custom', json={'category':'science','start':'Q7186','destination':'Q90'}).json()
    assert game['collection'] == 'science'


def test_completed_route_reports_the_snapshot_minimum_without_revealing_it_midgame():
    game = client.get('/api/challenges/daily?day=2026-11-11').json()
    for destination in ('Q46633', 'Q7259', 'Q46633', 'Q332342', 'Q35794'):
        assert game['shortest_steps'] is None
        choice = next(choice for choice in game['choices'] if choice['entity']['id'] == destination)
        game = post('validate-move', game, edge_id=choice['edge']['id']).json()
    assert game['complete'] and game['steps'] == 5 and game['shortest_steps'] == 3
    assert post('verify-path', game).json()['shortest_steps'] == 3
    assert post('undo', game).json()['shortest_steps'] is None
