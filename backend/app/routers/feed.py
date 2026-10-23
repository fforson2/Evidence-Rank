from fastapi import APIRouter

from app.models.store import store
from app.schemas.common import DEMO_DISCLAIMER, FeedMode
from app.schemas.feed import FeedResponse
from app.services.ranking import rank_posts

router = APIRouter(tags=["feed"])


@router.get("/feed", response_model=FeedResponse)
def read_feed(mode: FeedMode) -> FeedResponse:
    return FeedResponse(
        mode=mode,
        data_origin="demo",
        disclaimer=DEMO_DISCLAIMER,
        posts=rank_posts(store.list_posts(), mode),
    )
