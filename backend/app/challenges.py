"""Bounded, directed challenges over a versioned Wikidata snapshot."""
import base64
from datetime import date, datetime, timezone
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from .challenge_collections import COLLECTIONS, COLLECTIONS_BY_VERSION, MAX_STEPS, PUZZLES, Collection, puzzle_for
from .knowledge import Entity, Edge

router = APIRouter(prefix="/api/challenges", tags=["challenges"])
SECRET = os.environ.get("CHALLENGE_SIGNING_KEY", "").encode() or secrets.token_bytes(32)
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
        if state["version"] not in COLLECTIONS_BY_VERSION or state["expires"] < time.time():
            raise ValueError()
        return state
    except (ValueError, KeyError, TypeError):
        raise HTTPException(422, "This game has expired or changed. Start a new challenge.")


def validated_path(state, collection):
    current = state["start"]
    path = []
    for edge_id in state["path"]:
        edge = collection.edges.get(edge_id)
        if not edge or edge["source"] != current:
            raise HTTPException(422, "The path contains an invalid move.")
        path.append(edge)
        current = edge["target"]
    return current, path


def view(state):
    collection = COLLECTIONS_BY_VERSION[state["version"]]
    current, path = validated_path(state, collection)
    complete = current == state["destination"]
    shortest_route = collection.route(state["start"], state["destination"]) if complete else None
    choices = []
    if not complete and len(path) < MAX_STEPS:
        choices = [
            {"edge": edge, "entity": collection.nodes[edge["target"]]}
            for edge in collection.edges.values() if edge["source"] == current
        ]
    return {
        "token": seal(state),
        "id": state["id"],
        "collection": collection.id,
        "graph_version": collection.version,
        "start": collection.nodes[state["start"]],
        "destination": collection.nodes[state["destination"]],
        "current": collection.nodes[current],
        "path": path,
        "visited": [collection.nodes[state["start"]], *[collection.nodes[edge["target"]] for edge in path]],
        "choices": choices,
        "steps": len(path),
        "hints_used": state["hints"],
        "complete": complete,
        "shortest_steps": len(shortest_route) if shortest_route is not None else None,
        "max_steps": MAX_STEPS,
        "hint_edge_id": state.get("hint_edge"),
        "model": collection.model,
        "snapshot_date": collection.snapshot_date,
        "daily_date": state.get("daily_date"),
    }


def new_game(collection: Collection, start: str, destination: str, game_id: str, daily_date=None):
    solution = collection.route(start, destination)
    if not solution or len(solution) > MAX_STEPS:
        raise HTTPException(422, "No eligible route exists between these topics in this collection. Choose another pair.")
    return view({
        "id": game_id, "version": collection.version, "start": start, "destination": destination,
        "path": [], "hints": 0, "hinted": [], "expires": int(time.time()) + 86400, "daily_date": daily_date,
    })


class Choice(BaseModel):
    edge: Edge
    entity: Entity


class GameResponse(BaseModel):
    token: str
    id: str
    graph_version: str
    collection: str
    start: Entity
    destination: Entity
    current: Entity
    path: list[Edge]
    visited: list[Entity]
    choices: list[Choice]
    steps: int
    hints_used: int
    complete: bool
    shortest_steps: int | None
    max_steps: int
    hint_edge_id: str | None
    model: str
    snapshot_date: str
    daily_date: str | None


class Category(BaseModel):
    id: str
    label: str


class CollectionResponse(BaseModel):
    categories: list[Category]
    default_start: str
    default_destination: str
    entities: list[Entity]
    graph_version: str
    model: str


class TokenInput(BaseModel):
    token: str = Field(max_length=16000)


class MoveInput(TokenInput):
    edge_id: str = Field(max_length=200)


class CustomInput(BaseModel):
    category: str = Field(default="classic", max_length=30)
    start: str = Field(pattern=r"^Q[1-9][0-9]{0,11}$")
    destination: str = Field(pattern=r"^Q[1-9][0-9]{0,11}$")


def get_collection(category: str) -> Collection:
    collection = COLLECTIONS.get(category)
    if collection is None:
        raise HTTPException(404, "Choose an available challenge collection.")
    return collection


@router.get("/daily", response_model=GameResponse)
def daily(day: date | None = None):
    day = day or datetime.now(timezone.utc).date()
    puzzle = puzzle_for(day)
    return new_game(COLLECTIONS[puzzle["collection"]], puzzle["start"], puzzle["destination"],
                    puzzle["id"], day.isoformat())


@router.get("/collection", response_model=CollectionResponse)
def options(category: str = "classic"):
    collection = get_collection(category)
    eligible = {edge["source"] for edge in collection.edges.values()} | {edge["target"] for edge in collection.edges.values()}
    puzzle = next(puzzle for puzzle in PUZZLES if puzzle["collection"] == category)
    return {
        "entities": sorted((collection.nodes[key] for key in eligible), key=lambda item: item["label"].casefold()),
        "categories": [{"id": item.id, "label": item.label} for item in COLLECTIONS.values()],
        "default_start": puzzle["start"], "default_destination": puzzle["destination"],
        "graph_version": collection.version, "model": collection.model,
    }


@router.post("/custom", response_model=GameResponse)
def custom(body: CustomInput):
    collection = get_collection(body.category)
    if body.start not in collection.nodes or body.destination not in collection.nodes:
        raise HTTPException(422, "Choose topics from the offline collection.")
    return new_game(collection, body.start, body.destination, "practice-v1")


@router.post("/validate-move", response_model=GameResponse)
def move(body: MoveInput):
    state = unseal(body.token)
    collection = COLLECTIONS_BY_VERSION[state["version"]]
    current, path = validated_path(state, collection)
    edge = collection.edges.get(body.edge_id)
    if current == state["destination"] or len(path) >= MAX_STEPS or not edge or edge["source"] != current:
        raise HTTPException(422, "That move is not available from this topic.")
    state["path"].append(body.edge_id)
    state.pop("hint_edge", None)
    return view(state)


@router.post("/hint", response_model=GameResponse)
def hint(body: TokenInput):
    state = unseal(body.token)
    collection = COLLECTIONS_BY_VERSION[state["version"]]
    current, path = validated_path(state, collection)
    remaining = collection.route(current, state["destination"])
    if not remaining or len(path) + len(remaining) > MAX_STEPS:
        raise HTTPException(422, "No route remains from here. Undo your last move to try another branch.")
    marker = ",".join(state["path"])
    if marker not in state["hinted"] and current not in state["hinted"]:
        state["hints"] += 1
        state["hinted"].append(current)
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
