# Data sources

Live data and bundled snapshots use Wikidata structured data under CC0. API: https://www.wikidata.org/w/api.php. Access guidance: https://www.wikidata.org/wiki/Wikidata:Data_access.

Seed files contain original Wikidata responses and revision metadata. See `data/seeds/manifest.json` for snapshot date and source endpoints. Referenced claims are not equivalent to independent verification; users must review the statement and its sources. Missing references are disclosed in the interface.

Code license does not change the license of external content. Wikipedia summaries are deferred. The three bundled Commons portraits have file-specific public-domain metadata recorded in `data/stories/catalog.json`, including creator, file URL, license URL, download URL, retrieval date and display modification. Human-readable attribution is included with the images. Story narrative is original editorial text; it follows exact stored statement IDs and discloses missing references. Additional institutional sources appear in the Curie story. New media must retain these attribution fields. Google Fonts are loaded from their provider; fallback system fonts keep the interface usable offline.
