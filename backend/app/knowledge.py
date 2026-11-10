import re
from pathlib import Path
from fastapi import HTTPException
from pydantic import BaseModel, Field

SEEDS = Path(__file__).resolve().parents[2] / "data" / "seeds"
PROPERTIES = {"P69": "educated at", "P101": "field of work", "P108": "employer", "P19": "place of birth", "P20": "place of death", "P27": "country of citizenship", "P106": "occupation", "P800": "notable work", "P737": "influenced by", "P361": "part of", "P279": "subclass of", "P50": "author", "P112": "founded by", "P159": "headquarters location", "P17": "country"}

class Entity(BaseModel):
    id: str
    label: str
    description: str
    source_url: str

class Edge(BaseModel):
    id: str
    source: str
    target: str
    property_id: str
    label: str
    references: list[dict]
    qualifiers: dict
    source_url: str

class Graph(BaseModel):
    nodes: list[Entity]
    edges: list[Edge]
    root_id: str
    truncated: bool
    offline: bool
    fetched_at: str
    next_offset: int | None = None
    total_statements: int | None = None
    saved_edge_ids: list[str] = Field(default_factory=list)

def validate(qid):
    if not re.fullmatch(r"Q[1-9][0-9]{0,11}", qid):
        raise HTTPException(422, "Use a valid Wikidata entity ID.")

def normalize(e):
    return Entity(id=e["id"], label=(e.get("labels", {}).get("en") or e.get("labels", {}).get("mul") or {}).get("value", e["id"]), description=e.get("descriptions", {}).get("en", {}).get("value", "No English description available."), source_url=f"https://www.wikidata.org/wiki/{e['id']}")

def extract(e):
    edges = []
    for prop, label in PROPERTIES.items():
        for claim in e.get("claims", {}).get(prop, []):
            snak = claim.get("mainsnak", {})
            value = snak.get("datavalue", {}).get("value", {})
            if claim.get("rank") == "deprecated" or snak.get("snaktype") != "value" or not isinstance(value, dict) or not value.get("id", "").startswith("Q"):
                continue
            edges.append(Edge(id=claim["id"], source=e["id"], target=value["id"], property_id=prop, label=label, references=claim.get("references", []), qualifiers=claim.get("qualifiers", {}), source_url=f"https://www.wikidata.org/wiki/{e['id']}#{prop}"))
    return edges

