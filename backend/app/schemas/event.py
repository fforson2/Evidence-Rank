from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import EventType, FeedMode


class InteractionEventCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    post_id: str | None = None
    event_type: EventType
    feed_mode: FeedMode
    metadata: dict[str, Any] = Field(default_factory=dict)


class InteractionEvent(BaseModel):
    id: str
    post_id: str | None
    event_type: EventType
    feed_mode: FeedMode
    metadata: dict[str, Any]
    created_at: datetime
