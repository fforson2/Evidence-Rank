from datetime import datetime, timezone
from uuid import uuid4

from app.data.fixtures import POSTS
from app.schemas.event import InteractionEvent, InteractionEventCreate
from app.schemas.evidence import EvidenceExplanation
from app.schemas.post import Post
from app.services.evidence import get_demo_evidence


class DemoStore:
    """In-memory stand-in for Supabase. Safe to reset between tests."""

    def __init__(self) -> None:
        self._events: list[InteractionEvent] = []

    def list_posts(self) -> list[Post]:
        return [post.model_copy() for post in POSTS]

    def get_post(self, post_id: str) -> Post | None:
        for post in POSTS:
            if post.id == post_id:
                return post.model_copy()
        return None

    def get_evidence(self, post_id: str) -> EvidenceExplanation | None:
        if self.get_post(post_id) is None:
            return None
        return get_demo_evidence(post_id)

    def add_event(self, payload: InteractionEventCreate) -> InteractionEvent:
        event = InteractionEvent(
            id=str(uuid4()),
            post_id=payload.post_id,
            event_type=payload.event_type,
            feed_mode=payload.feed_mode,
            metadata=payload.metadata,
            created_at=datetime.now(timezone.utc),
        )
        self._events.append(event)
        return event

    def clear_events(self) -> None:
        self._events.clear()


store = DemoStore()
