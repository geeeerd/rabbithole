"""Short, attributed Wikipedia introductions for linked topics."""

from urllib.parse import urlencode

from pydantic import BaseModel

from .wikidata import WikimediaClient

WIKIPEDIA = "https://en.wikipedia.org"
LICENSE = "https://creativecommons.org/licenses/by-sa/4.0/"
wikipedia = WikimediaClient(WIKIPEDIA + "/w/api.php")


class Article(BaseModel):
    title: str
    excerpt: str
    article_url: str
    revision_url: str
    contributors_url: str
    license_url: str = LICENSE


async def wikipedia_intro(title: str) -> Article | None:
    result = await wikipedia.request({
        "action": "query", "prop": "extracts|info", "titles": title, "redirects": 1,
        "exintro": 1, "explaintext": 1, "exchars": 800, "formatversion": 2,
    })
    pages = result["query"].get("pages", [])
    if not isinstance(pages, list) or len(pages) != 1 or not isinstance(pages[0], dict):
        return None
    page = pages[0]
    excerpt, article_title = page.get("extract"), page.get("title")
    page_id, revision = page.get("pageid"), page.get("lastrevid")
    if (page.get("ns") != 0 or not isinstance(excerpt, str) or not excerpt.strip()
            or not isinstance(article_title, str) or not isinstance(page_id, int) or page_id <= 0
            or not isinstance(revision, int) or revision <= 0):
        return None
    return Article(
        title=article_title, excerpt=excerpt.strip(), article_url=f"{WIKIPEDIA}/?curid={page_id}",
        revision_url=f"{WIKIPEDIA}/wiki/Special:PermanentLink/{revision}",
        contributors_url=f"{WIKIPEDIA}/w/index.php?" + urlencode({"title": article_title, "action": "history"}),
    )
