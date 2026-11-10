"""Load and validate the finite graphs used by challenges."""

from collections import deque
from dataclasses import dataclass
from datetime import date
import hashlib
import json

from .knowledge import PROPERTIES, SEEDS, extract, normalize
from .stories import STORIES

MAX_STEPS = 12
DIRECTORY = SEEDS.parent / "challenges"


@dataclass(frozen=True)
class Collection:
    id: str
    label: str
    nodes: dict
    edges: dict
    version: str
    model: str
    snapshot_date: str

    def route(self, start: str, destination: str) -> list[str] | None:
        queue = deque([(start, [])])
        visited = {start}
        while queue:
            node, path = queue.popleft()
            if node == destination:
                return path
            for edge in self.edges.values():
                if edge["source"] == node and edge["target"] not in visited:
                    visited.add(edge["target"])
                    queue.append((edge["target"], [*path, edge["id"]]))
        return None


def load_collection(manifest: dict) -> Collection:
    raw = {}
    for qid in manifest["entities"]:
        raw.update(json.loads((SEEDS / f"{qid}.json").read_text())["entities"])
    properties = manifest["properties"]
    nodes = {key: normalize(item).model_dump() for key, item in raw.items()}
    edges = {
        edge.id: edge.model_dump()
        for item in raw.values() for edge in extract(item)
        if edge.property_id in properties and edge.target in nodes
    }
    serialized = json.dumps({"nodes": nodes, "edges": edges}, sort_keys=True).encode()
    version = hashlib.sha256(serialized).hexdigest()[:16]
    labels = ", ".join(f"{PROPERTIES[key]} ({key})" for key in properties)
    return Collection(manifest["id"], manifest["label"], nodes, edges, version,
                      f"Directed snapshot with {labels}.", manifest["snapshot_date"])


def load_rotation():
    rotation = json.loads((DIRECTORY / "rotation.json").read_text())
    classic = json.loads((DIRECTORY / "collection.json").read_text())
    classic.update(id="classic", label="Turing and Cambridge", snapshot_date="2026-11-06")
    collections = {item["id"]: load_collection(item) for item in [classic, *rotation["collections"]]}
    puzzles = rotation["puzzles"]
    if not puzzles or len({puzzle["id"] for puzzle in puzzles}) != len(puzzles):
        raise ValueError("The challenge rotation needs unique puzzles")
    for puzzle in puzzles:
        graph = collections[puzzle["collection"]]
        story = STORIES[puzzle["story"]]
        if story.entities[0].id != puzzle["start"] or story.entities[-1].id != puzzle["destination"]:
            raise ValueError(f"Puzzle endpoints disagree with the reviewed story: {puzzle['id']}")
        route = graph.route(puzzle["start"], puzzle["destination"])
        story_edges = [transition.edge.id for transition in story.transitions]
        if (not route or not 2 <= len(route) <= MAX_STEPS
                or len(story_edges) > MAX_STEPS or not set(story_edges) <= graph.edges.keys()):
            raise ValueError(f"Puzzle must follow its reviewed route in two or more moves: {puzzle['id']}")
    return collections, puzzles, date.fromisoformat(rotation["starts_on"])


COLLECTIONS, PUZZLES, START_DATE = load_rotation()
COLLECTIONS_BY_VERSION = {collection.version: collection for collection in COLLECTIONS.values()}


def puzzle_for(day: date) -> dict:
    offset = max(0, (day - START_DATE).days)
    return PUZZLES[offset % len(PUZZLES)]
