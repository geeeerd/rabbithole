"""Find entity-valued Wikidata statements and prioritize a varied first page."""

from collections import defaultdict, deque
from functools import lru_cache
import json
import re

from typing import Annotated

from pydantic import BaseModel, Field

from .knowledge import Edge, PROPERTIES, SEEDS

PAGE_SIZE = 24
ITEM_ID = re.compile(r"Q[1-9][0-9]{0,11}")
PROPERTY_ID = re.compile(r"P[1-9][0-9]{0,11}")
# Established labels for useful connections when live property metadata is unavailable.
GRAPH_LABELS = {
    **PROPERTIES, "P31": "instance of", "P527": "has part", "P276": "location",
    "P131": "located in the administrative territorial entity", "P30": "continent",
    "P36": "capital", "P47": "shares border with", "P138": "named after",
    "P170": "creator", "P136": "genre", "P921": "main subject", "P144": "based on",
    "P155": "follows", "P156": "followed by", "P178": "developer", "P287": "designed by",
    "P61": "discoverer or inventor", "P119": "place of burial", "P366": "has use", "P2579": "studied by",
}


TopicId = Annotated[str, Field(pattern=r"^Q[1-9][0-9]{0,11}$")]
LINK_SOURCE_LIMIT = 8
LINK_EDGE_LIMIT = 48


class LinkRequest(BaseModel):
    topics: list[TopicId] = Field(min_length=2, max_length=100)
    sources: list[TopicId] = Field(min_length=1, max_length=LINK_SOURCE_LIMIT)


class LinkScan(BaseModel):
    edges: list[Edge]
    scanned_ids: list[str]
    saved_edge_ids: list[str]
    offline: bool
    truncated: bool
    fetched_at: str


def graph_statements(item: dict) -> list[Edge]:
    edges = []
    for prop, statements in item.get("claims", {}).items():
        if not PROPERTY_ID.fullmatch(prop):
            continue
        for statement in statements:
            if statement.get("rank") == "deprecated" or not statement.get("id"):
                continue
            snak = statement.get("mainsnak", {})
            value = snak.get("datavalue", {}).get("value")
            target = value.get("id", "") if isinstance(value, dict) else ""
            if snak.get("snaktype") != "value" or not isinstance(target, str) or not ITEM_ID.fullmatch(target):
                continue
            if target == item["id"]:
                continue
            edges.append(Edge(
                id=statement["id"], source=item["id"], target=target,
                property_id=prop, label=GRAPH_LABELS.get(prop, f"Property {prop}"),
                references=statement.get("references", []), qualifiers=statement.get("qualifiers", {}),
                source_url=f"https://www.wikidata.org/wiki/{item['id']}#{prop}",
            ))
    return list({edge.id: edge for edge in edges}.values())


def varied_order(edges: list[Edge]) -> list[Edge]:
    by_property = defaultdict(deque)
    for edge in edges:
        by_property[edge.property_id].append(edge)
    groups = deque(by_property[key] for key in dict.fromkeys([*GRAPH_LABELS, *sorted(by_property)]) if key in by_property)
    ordered = []
    while groups:
        group = groups.popleft()
        ordered.append(group.popleft())
        if group:
            groups.append(group)
    return ordered


@lru_cache(maxsize=1)
def saved_links() -> tuple[set[str], dict[str, list[Edge]]]:
    files = sorted(SEEDS.glob("Q*.json"))
    known = {file.stem for file in files}
    incoming = defaultdict(list)
    for file in files:
        item = json.loads(file.read_text())["entities"][file.stem]
        for edge in graph_statements(item):
            incoming[edge.target].append(edge)
    return known, incoming
