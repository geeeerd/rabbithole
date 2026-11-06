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
    game = client.get('/api/challenges/daily').json()
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
    game = client.get('/api/challenges/daily').json()
    backward = next(e for e in challenges.EDGES.values() if e['source'] != game['current']['id'])
    assert post('validate-move',game,edge_id=backward['id']).status_code == 422
    assert post('validate-move',game,edge_id='invented').status_code == 422
    assert client.post('/api/challenges/verify-path',json={'token':'tampered'}).status_code == 422
    state = challenges.unseal(game['token'])
    state['expires'] = 0
    assert post('verify-path',{'token':challenges.seal(state)}).status_code == 422
    assert post('verify-path',{'token':game['token']+'x'}).status_code == 422


def test_dead_end_and_undo_keep_progress_and_hint_count():
    game = client.get('/api/challenges/daily').json()
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
    assert len(challenges.route('Q7251','Q35794')) == 2
