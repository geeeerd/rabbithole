from fastapi.testclient import TestClient

from app import articles, main


def test_background_uses_the_linked_article_and_keeps_attribution(monkeypatch):
    async def wikidata(params):
        assert params['sitefilter'] == 'enwiki' and params['ids'] == 'Q7251'
        return {'entities': {'Q7251': {'sitelinks': {'enwiki': {'title': 'Alan Turing'}}}}}

    async def wikipedia(params):
        assert params['titles'] == 'Alan Turing' and params['exintro'] == 1 and params['explaintext'] == 1
        return {'query': {'pages': [{'title': 'Alan Turing', 'pageid': 10, 'lastrevid': 20,
                                    'ns': 0, 'extract': 'A test article introduction.'}]}}

    monkeypatch.setattr(main, 'request', wikidata)
    monkeypatch.setattr(articles.wikipedia, 'request', wikipedia)
    with TestClient(main.app) as client:
        data = client.get('/api/entities/Q7251/background').json()
        assert data['excerpt'] == 'A test article introduction.'
        assert data['article_url'] == 'https://en.wikipedia.org/?curid=10'
        assert data['revision_url'].endswith('/20') and 'action=history' in data['contributors_url']
        assert data['license_url'] == 'https://creativecommons.org/licenses/by-sa/4.0/'
        assert client.get('/api/entities/invalid/background').status_code == 422


def test_background_without_a_sitelink_never_guesses_an_article(monkeypatch):
    async def wikidata(_params):
        return {'entities': {'Q1': {}}}

    async def wikipedia(_params):
        raise AssertionError('The article title must come from the linked sitelink')

    monkeypatch.setattr(main, 'request', wikidata)
    monkeypatch.setattr(articles.wikipedia, 'request', wikipedia)
    assert TestClient(main.app).get('/api/entities/Q1/background').status_code == 404
