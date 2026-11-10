"""Present Wikidata time values at their recorded precision and calendar."""

from calendar import month_name
import re

from pydantic import BaseModel

from .knowledge import Entity, extract

DIRECT_DATES = {
    "P569": "Birth", "P570": "Death", "P571": "Inception", "P576": "Dissolution",
    "P577": "Publication", "P580": "Start", "P582": "End", "P585": "Point in time",
}
RELATIONSHIP_DATES = {"P580": "Start", "P582": "End", "P585": "Recorded date"}
CALENDARS = {"Q1985727": "Gregorian", "Q1985786": "Julian"}
PRECISIONS = {7: "century", 8: "decade", 9: "year", 10: "month", 11: "day"}
TIMESTAMP = re.compile(r"([+-][0-9]{1,16})-([0-9]{2})-([0-9]{2})T[0-9]{2}:[0-9]{2}:[0-9]{2}Z")
MONTH_LENGTHS = (31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31)
MAX_ENTRIES = 40


class RecordedDate(BaseModel):
    label: str
    year: int
    month: int | None
    day: int | None
    precision: str
    calendar: str
    raw: str
    uncertain: bool


class Milestone(BaseModel):
    id: str
    label: str
    date: RecordedDate
    statement_id: str
    property_id: str
    source_url: str
    references_count: int
    related_id: str | None = None
    related_label: str | None = None
    relationship: str | None = None


class Timeline(BaseModel):
    subject: Entity
    entries: list[Milestone]
    offline: bool
    truncated: bool


def ordinal(value: int) -> str:
    suffix = "th" if 11 <= value % 100 <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value}{suffix}"


def recorded_date(snak: dict, qualifiers: dict) -> RecordedDate | None:
    datavalue = snak.get("datavalue", {})
    if snak.get("snaktype") != "value" or datavalue.get("type") != "time":
        return None
    value = datavalue.get("value")
    if not isinstance(value, dict) or not isinstance(value.get("time"), str):
        return None
    precision = value.get("precision")
    if not isinstance(precision, int) or precision not in PRECISIONS:
        return None
    calendar_uri = value.get("calendarmodel")
    calendar = CALENDARS.get(calendar_uri.rsplit("/", 1)[-1]) if isinstance(calendar_uri, str) else None
    match = TIMESTAMP.fullmatch(value["time"])
    if not match or not calendar:
        return None
    year, month, day = map(int, match.groups())
    if not 0 < abs(year) <= 999999:
        return None
    if precision >= 10 and not 1 <= month <= 12:
        return None
    if precision == 11 and not 1 <= day <= MONTH_LENGTHS[month - 1]:
        return None

    year_label = f"{abs(year)}" + (" BCE" if year < 0 else "")
    if precision == 7:
        label = f"{ordinal((abs(year) + 99) // 100)} century" + (" BCE" if year < 0 else "")
    elif precision == 8:
        decade = abs(year) // 10 * 10
        label = f"{decade}s" + (" BCE" if year < 0 else "") if decade else ("1–9 BCE" if year < 0 else "1–9 CE")
    elif precision == 10:
        label = f"{month_name[month]} {year_label}"
    elif precision == 11:
        label = f"{day} {month_name[month]} {year_label}"
    else:
        label = year_label

    uncertain = any(value.get(key) for key in ("before", "after")) or any(
        qualifiers.get(key) for key in ("P1480", "P1319", "P1326")
    )
    return RecordedDate(
        label=label, year=year, month=month if precision >= 10 else None,
        day=day if precision == 11 else None, precision=PRECISIONS[precision],
        calendar=calendar, raw=value["time"], uncertain=bool(uncertain),
    )


def events(item: dict) -> tuple[list[Milestone], bool]:
    direct = []
    for prop, label in DIRECT_DATES.items():
        for statement in item.get("claims", {}).get(prop, []):
            if statement.get("rank") == "deprecated" or not statement.get("id"):
                continue
            date = recorded_date(statement.get("mainsnak", {}), statement.get("qualifiers", {}))
            if date:
                direct.append(Milestone(
                    id=statement["id"], label=label, date=date, statement_id=statement["id"],
                    property_id=prop, source_url=f"https://www.wikidata.org/wiki/{item['id']}#{prop}",
                    references_count=len(statement.get("references", [])),
                ))

    related = []
    for edge in extract(item):
        for prop, label in RELATIONSHIP_DATES.items():
            for index, qualifier in enumerate(edge.qualifiers.get(prop, [])):
                date = recorded_date(qualifier, edge.qualifiers)
                if date:
                    related.append(Milestone(
                        id=f"{edge.id}:{prop}:{index}", label=label, date=date, statement_id=edge.id,
                        property_id=prop, source_url=edge.source_url, references_count=len(edge.references),
                        related_id=edge.target, relationship=edge.label,
                    ))

    def date_key(entry: Milestone):
        return (entry.date.year, entry.date.month or 0, entry.date.day or 0, entry.id)

    # Keep direct dates when a topic has many qualified relationships.
    chosen = (sorted(direct, key=date_key) + sorted(related, key=date_key))[:MAX_ENTRIES]
    return sorted(chosen, key=date_key), len(direct) + len(related) > MAX_ENTRIES
