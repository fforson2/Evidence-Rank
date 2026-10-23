from fastapi import APIRouter

from app.errors import http_error
from app.models.store import store
from app.schemas.event import InteractionEvent, InteractionEventCreate

router = APIRouter(tags=["events"])


@router.post("/events", response_model=InteractionEvent, status_code=201)
def create_event(payload: InteractionEventCreate) -> InteractionEvent:
    if payload.post_id is not None and store.get_post(payload.post_id) is None:
        raise http_error(404, "not_found", "Post not found")
    return store.add_event(payload)
