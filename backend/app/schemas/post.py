from pydantic import BaseModel, Field

from app.schemas.common import EvidenceStatus, PostType, ReviewStatus


class Post(BaseModel):
    id: str
    type: PostType
    author: str
    content: str
    video_url: str | None = None
    image_url: str | None = None
    image_credit: str | None = None
    likes: int = Field(ge=0)
    shares: int = Field(ge=0)
    evidence_status: EvidenceStatus
    review_status: ReviewStatus


class RankedPost(Post):
    rank: int = Field(ge=1)
    engagement_score: float
    evidence_adjustment: float
    score: float
