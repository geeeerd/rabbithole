# Data sources

Live data and bundled snapshots use Wikidata structured data under CC0. API: https://www.wikidata.org/w/api.php. Access guidance: https://www.wikidata.org/wiki/Wikidata:Data_access.

Seed files contain original Wikidata responses and revision metadata. See `data/seeds/manifest.json` for snapshot date and source endpoints. Referenced claims are not equivalent to independent verification; users must review the statement and its sources. Missing references are disclosed in the interface.

Code license does not change the license of external content. The three bundled Commons portraits have file-specific public-domain metadata recorded in `data/stories/catalog.json`, including creator, file URL, license URL, download URL, retrieval date and display modification. Human-readable attribution is included with the images. Story narrative is original editorial text; it follows exact stored statement IDs and discloses missing references. Additional institutional sources appear in the Curie story. New media must retain these attribution fields. Google Fonts are loaded from their provider; fallback system fonts keep the interface usable offline.

## Geographic data

Place coordinates come from Earth `P625` statements in Wikidata. `data/places.json` bundles selected coordinate statements and associated entity labels for saved map examples. Related place links retain the original Wikidata property and statement ID. Coordinate precision and available relationship date qualifiers are shown in the place evidence.

The map uses public-domain Natural Earth 1:110m land polygons from its v5.1.2 repository tag. `frontend/public/maps/land.svg` projects the outlines into a simple longitude/latitude view. It displays present-day land and uses no political boundary dataset or external map tiles. [Land data](https://github.com/nvkelso/natural-earth-vector/blob/v5.1.2/geojson/ne_110m_land.geojson) · [Terms of use](https://www.naturalearthdata.com/about/terms-of-use/)

## Wikipedia background

Topic profiles resolve the English Wikipedia article through the topic’s Wikidata sitelink. Opening the background panel requests a short plain-text lead excerpt from the English Wikipedia API. The interface identifies the article, provides the reported revision and contributor history, and marks the excerpt as shortened. Excerpts are cached in memory and carry their own CC BY-SA 4.0 attribution. [Wikimedia developer attribution guidelines](https://foundation.wikimedia.org/wiki/Legal:Wikimedia_Developer_App_Guidelines)
