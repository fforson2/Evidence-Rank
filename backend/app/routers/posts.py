from fastapi import APIRouter

from app.models.store import store
from app.schemas.common import DEMO_DISCLAIMER
from app.schemas.feed import PostListResponse

router = APIRouter(tags=["posts"])


@router.get("/posts", response_model=PostListResponse)
def list_posts() -> PostListResponse:
    return PostListResponse(data_origin="demo", disclaimer=DEMO_DISCLAIMER, posts=store.list_posts())
