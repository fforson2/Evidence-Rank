from pydantic import BaseModel, Field

from app.schemas.common import DataOrigin, FeedMode
from app.schemas.post import Post, RankedPost


class PostListResponse(BaseModel):
    data_origin: DataOrigin
    disclaimer: str
    posts: list[Post]


class FeedResponse(BaseModel):
    mode: FeedMode
    data_origin: DataOrigin
    disclaimer: str
    posts: list[RankedPost]


class HealthResponse(BaseModel):
    status: str = Field(pattern="^ok$")
