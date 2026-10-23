from pydantic import BaseModel, Field

from app.schemas.common import DataOrigin, EvidenceStatus, ReviewStatus


class EvidenceSource(BaseModel):
    id: str
    title: str
    url: str
    publisher: str


class Claim(BaseModel):
    id: str
    text: str
    evidence_status: EvidenceStatus
    review_status: ReviewStatus
    explanation: str
    sources: list[EvidenceSource]


class EvidenceExplanation(BaseModel):
    post_id: str
    data_origin: DataOrigin
    disclaimer: str
    claims: list[Claim] = Field(min_length=1)
