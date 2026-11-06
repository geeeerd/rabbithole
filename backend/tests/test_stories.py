import copy
import json
from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.stories import CATALOG, validate_story

client = TestClient(app)


def test_published_stories_have_reproducible_paths_and_media_attribution(monkeypatch):
    import app.main as main
    async def no_network(*args):
        raise AssertionError('Stories must load offline')
    monkeypatch.setattr(main,'request',no_network)
    stories = client.get('/api/stories').json()
    assert len(stories) >= 3
    for summary in stories:
        assert 'intro' not in summary
        story = client.get('/api/stories/'+summary['id']).json()
        assert len(story['entities']) == len(story['transitions'])+1 == summary['step_count']
        assert story['image']['artist'] and story['image']['license'] and story['image']['source_url']
        for i, transition in enumerate(story['transitions']):
            assert transition['edge']['source'] == story['entities'][i]['id']
            assert transition['edge']['target'] == story['entities'][i+1]['id']
            assert transition['edge']['id'] and transition['edge']['source_url']
        assert story['reviewed_at']


def test_broken_story_sequences_cannot_be_published():
    story = copy.deepcopy(json.loads(CATALOG.read_text())[0])
    story['transitions'][0]['id'] = 'invented-statement'
    with pytest.raises(ValueError,match='Unverifiable'):
        validate_story(story)
    story['transitions'] = []
    with pytest.raises(ValueError,match='contiguous'):
        validate_story(story)
    assert client.get('/api/stories/unknown').status_code == 404
