"""Reviewed narratives with transitions validated against bundled statement IDs."""
import json
from datetime import date, datetime, timezone
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from .knowledge import SEEDS, Entity, Edge, extract, normalize

router = APIRouter(prefix="/api/stories", tags=["stories"])
CATALOG = SEEDS.parent / "stories" / "catalog.json"


class Reference(BaseModel):
    title: str
    url: str


class Media(BaseModel):
    file_title: str
    url: str
    source_url: str
    artist: str
    license: str
    license_url: str
    modification: str
    retrieved_at: str


class Transition(BaseModel):
    heading: str
    text: str
    edge: Edge


class StorySummary(BaseModel):
    id: str
    title: str
    description: str
    category: str
    image: Media
    reviewed_at: str
    step_count: int


class Story(StorySummary):
    intro: str
    entities: list[Entity]
    transitions: list[Transition]
    summary: str
    sources: list[Reference]
    publication_status: str


class DailyDiscovery(BaseModel):
    day: date
    story_id: str
    source: Entity
    target: Entity
    edge: Edge


def validate_story(raw):
    if len(raw["entities"]) < 2 or len(raw["transitions"]) != len(raw["entities"]) - 1:
        raise ValueError("A story needs a contiguous sequence of transitions")
    entities = [json.loads((SEEDS / f"{qid}.json").read_text())["entities"][qid] for qid in raw["entities"]]
    transitions = []
    for index, transition in enumerate(raw["transitions"]):
        edge = next((e for e in extract(entities[index]) if e.id == transition["id"] and e.target == entities[index+1]["id"]), None)
        if not edge:
            raise ValueError(f"Unverifiable story transition: {transition['id']}")
        transitions.append(Transition(heading=transition["heading"], text=transition["text"], edge=edge))
    return Story(**{**raw, "entities": [normalize(entity) for entity in entities], "transitions": transitions, "step_count": len(entities)})


def load_stories():
    return {story.id: story for raw in json.loads(CATALOG.read_text()) if raw["publication_status"] == "published" for story in [validate_story(raw)]}


STORIES = load_stories()


@router.get("", response_model=list[StorySummary])
def list_stories():
    return list(STORIES.values())


@router.get("/daily-discovery", response_model=DailyDiscovery)
def daily_discovery(day: date | None = None):
    selected_day = day or datetime.now(timezone.utc).date()
    stories = list(STORIES.values())
    if not stories:
        raise HTTPException(404, "No daily discovery is available.")
    story = stories[selected_day.toordinal() % len(stories)]
    return DailyDiscovery(day=selected_day, story_id=story.id, source=story.entities[0],
                          target=story.entities[1], edge=story.transitions[0].edge)


@router.get("/{story_id}", response_model=Story)
def get_story(story_id: str):
    if story_id not in STORIES:
        raise HTTPException(404, "That story is unavailable. Choose a story from the library.")
    return STORIES[story_id]
