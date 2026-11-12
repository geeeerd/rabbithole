"""Refresh the two dated Connecticut county-equivalent snapshots from TIGERweb."""

import json
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen


SNAPSHOTS = (
    ("2020", "2020 Census counties", "2020-01-01", "Census2020", 8),
    ("2023", "2023 planning regions", "2023-01-01", "ACS2023", 9),
)
OUTPUT = Path(__file__).resolve().parents[1] / "frontend/public/maps/connecticut-boundaries.json"


def snapshot(year, label, day, vintage, count):
    source = f"https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/tigerWMS_{vintage}/MapServer/82"
    params = urlencode({
        "where": "STATE='09'", "outFields": "NAME,GEOID,STATE", "returnGeometry": "true",
        "outSR": "4326", "maxAllowableOffset": "0.003", "geometryPrecision": "4", "f": "geojson",
    })
    with urlopen(f"{source}/query?{params}", timeout=25) as response:
        features = json.load(response)["features"]
    regions = []
    for feature in features:
        properties = feature["properties"]
        geometry = feature["geometry"]
        assert properties["STATE"] == "09" and geometry["type"] in {"Polygon", "MultiPolygon"}
        polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
        regions.append({"id": properties["GEOID"], "name": properties["NAME"], "polygons": polygons})
    assert len(regions) == count and len({region["id"] for region in regions}) == count
    return {"year": year, "label": label, "date": day, "source_url": source,
            "regions": sorted(regions, key=lambda region: region["name"])}


def main():
    dataset = {
        "scope": "Connecticut, United States",
        "source": "U.S. Census Bureau TIGERweb",
        "license": "U.S. government public domain",
        "license_url": "https://www2.census.gov/geo/pdfs/maps-data/data/tiger/tgrshp2021/TGRSHP2021_TechDoc.pdf#page=12",
        "notice_url": "https://www.federalregister.gov/documents/2022/06/06/2022-12063/change-to-county-equivalents-in-the-state-of-connecticut",
        "uncertainty": "These snapshots show Census statistical geography as of the listed dates. TIGERweb generalized the geometry for display. Use the source for detailed boundaries.",
        "snapshots": [snapshot(*entry) for entry in SNAPSHOTS],
    }
    OUTPUT.write_text(json.dumps(dataset, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
