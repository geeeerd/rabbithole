"""Source-linked literal values that do not belong on the connection graph."""

from collections import defaultdict, deque
import re
from urllib.parse import urlsplit

from pydantic import BaseModel, Field

from .connections import ITEM_ID, PROPERTY_ID
from .timeline import DIRECT_DATES, RELATIONSHIP_DATES, recorded_date

FACT_PAGE_SIZE = 20
NAMES = {"P1476": "Title", "P1448": "Official name", "P1705": "Native label", "P2561": "Name", "P1813": "Short name"}
LABELS = {**DIRECT_DATES, **NAMES, "P856": "Official website", "P1082": "Population", "P2046": "Area", "P2048": "Height", "P2044": "Elevation above sea level"}
DECIMAL = re.compile(r"[+-]?[0-9]+(?:\.[0-9]+)?")


class Fact(BaseModel):
    id: str
    property_id: str
    label: str
    value: str
    kind: str
    source_url: str
    references_count: int
    unit_id: str | None = None
    unit_label: str | None = None
    note: str | None = None
    dates: list[str] = Field(default_factory=list)


class FactPage(BaseModel):
    facts: list[Fact]
    next_offset: int | None
    total: int
    offline: bool


def describe_value(prop: str, snak: dict, qualifiers: dict) -> dict | None:
    datavalue = snak.get("datavalue", {})
    value = datavalue.get("value")
    kind = datavalue.get("type")
    if kind == "time":
        date = recorded_date(snak, qualifiers)
        if date:
            note = f"{date.calendar} · {date.precision} precision"
            if date.uncertain:
                note += " · date has qualifiers or uncertainty"
            return {"value": date.label, "kind": "date", "note": note}
    if kind == "quantity" and isinstance(value, dict):
        amount = value.get("amount")
        if not isinstance(amount, str) or len(amount) > 64 or not DECIMAL.fullmatch(amount):
            return None
        unit = value.get("unit")
        unit_id = unit.rsplit("/", 1)[-1] if isinstance(unit, str) else ""
        lower, upper = value.get("lowerBound"), value.get("upperBound")
        note = None
        if (isinstance(lower, str) and isinstance(upper, str) and len(lower) <= 64 and len(upper) <= 64
                and DECIMAL.fullmatch(lower) and DECIMAL.fullmatch(upper)):
            note = f"Recorded range {lower.removeprefix('+')} to {upper.removeprefix('+')}"
        return {"value": amount.removeprefix("+"), "kind": "quantity", "note": note,
                "unit_id": unit_id if ITEM_ID.fullmatch(unit_id) else None}
    if prop in NAMES:
        text = value.get("text") if isinstance(value, dict) else value
        if isinstance(text, str) and text.strip() and len(text) <= 500:
            language = value.get("language") if isinstance(value, dict) else None
            return {"value": text, "kind": "name", "note": f"Language {language}" if isinstance(language, str) else None}
    if prop == "P856" and isinstance(value, str) and len(value) <= 500:
        try:
            url = urlsplit(value)
        except ValueError:
            return None
        if url.scheme in ("https", "http") and url.hostname and not url.username and not url.password:
            return {"value": value, "kind": "website"}
    return None


def recorded_facts(item: dict) -> list[Fact]:
    groups = defaultdict(deque)
    for prop, statements in item.get("claims", {}).items():
        if not PROPERTY_ID.fullmatch(prop):
            continue
        for claim in sorted(statements, key=lambda statement: statement.get("rank") != "preferred"):
            if claim.get("rank") == "deprecated" or not claim.get("id"):
                continue
            snak = claim.get("mainsnak", {})
            if snak.get("snaktype") != "value":
                continue
            qualifiers = claim.get("qualifiers", {})
            value = describe_value(prop, snak, qualifiers)
            if not value:
                continue
            dates = []
            for key, label in RELATIONSHIP_DATES.items():
                for qualifier in qualifiers.get(key, []):
                    date = recorded_date(qualifier, qualifiers)
                    if date:
                        dates.append(f"{label} {date.label}" + (" (Julian)" if date.calendar == "Julian" else ""))
            groups[prop].append(Fact(
                id=claim["id"], property_id=prop, label=LABELS.get(prop, f"Property {prop}"),
                source_url=f"https://www.wikidata.org/wiki/{item['id']}#{prop}",
                references_count=len(claim.get("references", [])), dates=dates, **value,
            ))
    queue = deque(groups[key] for key in dict.fromkeys([*LABELS, *sorted(groups)]) if key in groups)
    facts = []
    while queue:
        group = queue.popleft()
        facts.append(group.popleft())
        if group:
            queue.append(group)
    return facts
