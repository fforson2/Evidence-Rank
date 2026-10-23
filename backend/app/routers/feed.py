from fastapi import APIRouter

from app.errors import http_error
from app.models.store import store
from app.schemas.common import LIVE_DISCLAIMER, FeedMode
from app.schemas.feed import FeedResponse
from app.services.live_feed import LiveFeedUnavailable
from app.services.ranking import rank_posts

router = APIRouter(tags=["feed"])


@router.get("/feed", response_model=FeedResponse)
def read_feed(mode: FeedMode) -> FeedResponse:
    try:
        store.ensure_ready()
    except LiveFeedUnavailable as exc:
        raise http_error(503, "not_configured", str(exc)) from exc
    return FeedResponse(
        mode=mode,
        data_origin="live",
        disclaimer=LIVE_DISCLAIMER,
        posts=rank_posts(store.list_posts(), mode),
    )
