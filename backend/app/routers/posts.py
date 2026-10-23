from fastapi import APIRouter

from app.errors import http_error
from app.models.store import store
from app.schemas.common import LIVE_DISCLAIMER
from app.schemas.feed import PostListResponse
from app.services.live_feed import LiveFeedUnavailable

router = APIRouter(tags=["posts"])


@router.get("/posts", response_model=PostListResponse)
def list_posts() -> PostListResponse:
    try:
        store.ensure_ready()
    except LiveFeedUnavailable as exc:
        raise http_error(503, "not_configured", str(exc)) from exc
    return PostListResponse(data_origin="live", disclaimer=LIVE_DISCLAIMER, posts=store.list_posts())
