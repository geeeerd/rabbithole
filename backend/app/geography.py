"""Map item coordinates from public Wikidata statements."""

from functools import lru_cache
import json
import math

from pydantic import BaseModel, Field

from .connections import graph_statements, varied_order
from .knowledge import Edge, Entity, SEEDS
from .timeline import RELATIONSHIP_DATES, recorded_date

LOCATION_PROPERTIES = {"P19", "P20", "P119", "P131", "P159", "P276", "P36"}
MAX_PLACES = 8


class Coordinate(BaseModel):
    latitude: float
    longitude: float
    precision: float | None
    statement_id: str
    source_url: str
    references_count: int


class Place(BaseModel):
    entity: Entity
    coordinate: Coordinate
    relationships: list[Edge]
    relationship_dates: dict[str, list[str]] = Field(default_factory=dict)


class Places(BaseModel):
    subject: Entity
    points: list[Place]
    offline: bool
    missing_count: int
    truncated: bool


def finite_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def coordinate(item: dict) -> Coordinate | None:
    claims = sorted(item.get("claims", {}).get("P625", []), key=lambda claim: claim.get("rank") != "preferred")
    for claim in claims:
        if claim.get("rank") == "deprecated" or not claim.get("id"):
            continue
        snak = claim.get("mainsnak", {})
        value = snak.get("datavalue", {}).get("value")
        if snak.get("snaktype") != "value" or not isinstance(value, dict):
            continue
        globe = value.get("globe", "")
        if not isinstance(globe, str) or globe.rsplit("/", 1)[-1] != "Q2":
            continue
        latitude, longitude = value.get("latitude"), value.get("longitude")
        if not finite_number(latitude) or not finite_number(longitude):
            continue
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            continue
        precision = value.get("precision")
        return Coordinate(
            latitude=latitude, longitude=longitude,
            precision=precision if finite_number(precision) and 0 < precision <= 360 else None,
            statement_id=claim["id"], source_url=f"https://www.wikidata.org/wiki/{item['id']}#P625",
            references_count=len(claim.get("references", [])),
        )
    return None


def place_links(item: dict) -> tuple[dict[str, list[Edge]], bool]:
    links = varied_order([edge for edge in graph_statements(item) if edge.property_id in LOCATION_PROPERTIES])
    grouped: dict[str, list[Edge]] = {}
    for edge in links:
        grouped.setdefault(edge.target, []).append(edge)
    return dict(list(grouped.items())[:MAX_PLACES]), len(grouped) > MAX_PLACES


def relationship_dates(relationships: list[Edge]) -> dict[str, list[str]]:
    dates = {}
    for edge in relationships:
        labels = []
        for property_id, label in RELATIONSHIP_DATES.items():
            for qualifier in edge.qualifiers.get(property_id, []):
                date = recorded_date(qualifier, edge.qualifiers)
                if date:
                    context = f" ({date.calendar})" if date.calendar == "Julian" else ""
                    if date.uncertain:
                        context += " · date has qualifiers or uncertainty"
                    labels.append(f"{label} {date.label}{context}")
        if labels:
            dates[edge.id] = labels
    return dates


@lru_cache(maxsize=1)
def saved_places() -> dict:
    return json.loads((SEEDS.parent / "places.json").read_text())["entities"]
