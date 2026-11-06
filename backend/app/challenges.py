"""Bounded, directed challenges over a versioned Wikidata snapshot."""
import base64
from collections import deque
from datetime import datetime, timezone
import hashlib
import hmac
import json
import os
import secrets
import time

from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .knowledge import SEEDS, Entity, Edge, extract, normalize

router = APIRouter(prefix="/api/challenges", tags=["challenges"])
SECRET = os.environ.get("CHALLENGE_SIGNING_KEY", "").encode() or secrets.token_bytes(32)
MAX_STEPS = 12
PROPERTIES = {"P69", "P361"}


def collection():
    manifest = json.loads((SEEDS.parent / "challenges" / "collection.json").read_text())
    raw = {key: value for qid in manifest["entities"] for key, value in json.loads((SEEDS / f"{qid}.json").read_text())["entities"].items()}
    nodes = {key: normalize(value).model_dump() for key, value in raw.items()}
    edges = {edge.id: edge.model_dump() for item in raw.values() for edge in extract(item) if edge.property_id in PROPERTIES and edge.target in nodes}
    version = hashlib.sha256(json.dumps({"nodes": nodes, "edges": edges}, sort_keys=True).encode()).hexdigest()[:16]
    return nodes, edges, version


NODES, EDGES, VERSION = collection()


def route(start, destination):
    queue = deque([(start, [])])
    visited = {start}
    while queue:
        node, path = queue.popleft()
        if node == destination:
            return path
        for edge in EDGES.values():
            if edge["source"] == node and edge["target"] not in visited:
                visited.add(edge["target"])
                queue.append((edge["target"], [*path, edge["id"]]))
    return None


def seal(state):
    payload = base64.urlsafe_b64encode(json.dumps(state, separators=(",", ":")).encode()).decode().rstrip("=")
    signature = hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return payload + "." + signature


def unseal(token):
    try:
        payload, signature = token.split(".")
        if not hmac.compare_digest(signature, hmac.new(SECRET, payload.encode(), hashlib.sha256).hexdigest()):
            raise ValueError()
        state = json.loads(base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)))
        if state["version"] != VERSION or state["expires"] < time.time():
            raise ValueError()
        return state
    except (ValueError, KeyError, TypeError):
        raise HTTPException(422, "This game has expired or changed. Start a new challenge.")


def validated_path(state):
    current = state["start"]
    path = []
    for edge_id in state["path"]:
        edge = EDGES.get(edge_id)
        if not edge or edge["source"] != current:
            raise HTTPException(422, "The path contains an invalid move.")
        path.append(edge)
        current = edge["target"]
    return current, path


def view(state):
    current, path = validated_path(state)
    complete = current == state["destination"]
    choices = [dict(edge=edge, entity=NODES[edge["target"]]) for edge in EDGES.values() if edge["source"] == current] if not complete and len(path) < MAX_STEPS else []
    return {"token": seal(state), "id": state["id"], "graph_version": VERSION, "start": NODES[state["start"]], "destination": NODES[state["destination"]], "current": NODES[current], "path": path, "visited": [NODES[state["start"]], *[NODES[e["target"]] for e in path]], "choices": choices, "steps": len(path), "hints_used": state["hints"], "complete": complete, "max_steps": MAX_STEPS, "hint_edge_id": state.get("hint_edge"), "model": "Directed snapshot; educated at (P69) and part of (P361).", "snapshot_date": "2026-11-06", "daily_date": state.get("daily_date")}


def new_game(start, destination, game_id, daily_date=None):
    solution = route(start, destination)
    if not solution or len(solution) > MAX_STEPS:
        raise HTTPException(422, "No eligible route exists between these topics in this collection. Choose another pair.")
    return view({"id": game_id, "version": VERSION, "start": start, "destination": destination, "path": [], "hints": 0, "hinted": [], "expires": int(time.time()) + 86400, "daily_date": daily_date})


class Choice(BaseModel):
    edge: Edge
    entity: Entity


class GameResponse(BaseModel):
    token: str
    id: str
    graph_version: str
    start: Entity
    destination: Entity
    current: Entity
    path: list[Edge]
    visited: list[Entity]
    choices: list[Choice]
    steps: int
    hints_used: int
    complete: bool
    max_steps: int
    hint_edge_id: str | None
    model: str
    snapshot_date: str
    daily_date: str | None


class CollectionResponse(BaseModel):
    entities: list[Entity]
    graph_version: str
    model: str


class TokenInput(BaseModel):
    token: str = Field(max_length=16000)


class MoveInput(TokenInput):
    edge_id: str = Field(max_length=200)


class CustomInput(BaseModel):
    start: str = Field(pattern=r"^Q[1-9][0-9]{0,11}$")
    destination: str = Field(pattern=r"^Q[1-9][0-9]{0,11}$")


@router.get("/daily", response_model=GameResponse)
def daily():
    date = datetime.now(timezone.utc).date().isoformat()
    # Stable starter puzzle, repeating daily until more reviewed puzzles are added.
    return new_game("Q7251", "Q35794", "turing-to-cambridge-v1", date)


@router.get("/collection", response_model=CollectionResponse)
def options():
    eligible = {edge["source"] for edge in EDGES.values()} | {edge["target"] for edge in EDGES.values()}
    return {"entities": [NODES[key] for key in sorted(eligible)], "graph_version": VERSION, "model": "Directed snapshot; educated at (P69) and part of (P361)."}


@router.post("/custom", response_model=GameResponse)
def custom(body: CustomInput):
    if body.start not in NODES or body.destination not in NODES:
        raise HTTPException(422, "Choose topics from the offline collection.")
    return new_game(body.start, body.destination, "practice-v1")


@router.post("/validate-move", response_model=GameResponse)
def move(body: MoveInput):
    state = unseal(body.token)
    current, path = validated_path(state)
    edge = EDGES.get(body.edge_id)
    if current == state["destination"] or len(path) >= MAX_STEPS or not edge or edge["source"] != current:
        raise HTTPException(422, "That move is not available from this topic.")
    state["path"].append(body.edge_id)
    state.pop("hint_edge", None)
    return view(state)


@router.post("/hint", response_model=GameResponse)
def hint(body: TokenInput):
    state = unseal(body.token)
    current, path = validated_path(state)
    remaining = route(current, state["destination"])
    if not remaining or len(path) + len(remaining) > MAX_STEPS:
        raise HTTPException(422, "No route remains from here. Undo your last move to try another branch.")
    marker = ",".join(state["path"])
    if marker not in state["hinted"]:
        state["hints"] += 1
        state["hinted"].append(marker)
    state["hint_edge"] = remaining[0]
    return view(state)


@router.post("/undo", response_model=GameResponse)
def undo(body: TokenInput):
    state = unseal(body.token)
    if not state["path"]:
        raise HTTPException(422, "You are already at the starting topic.")
    state["path"].pop()
    state.pop("hint_edge", None)
    return view(state)


@router.post("/verify-path", response_model=GameResponse)
def verify(body: TokenInput):
    return view(unseal(body.token))
