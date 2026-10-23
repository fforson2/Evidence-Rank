from typing import Literal

from pydantic import BaseModel, Field


class EvidenceDimensionScore(BaseModel):
    score: float = Field(ge=0, le=100)
    weight: float = Field(ge=0, le=100)
    explanation: str | None = None
    source_ids: list[str] = Field(default_factory=list)


class EvidenceDimensions(BaseModel):
    source_quality: EvidenceDimensionScore
    relevance: EvidenceDimensionScore
    methodology: EvidenceDimensionScore
    corroboration: EvidenceDimensionScore


class EvidenceStrength(BaseModel):
    provenance: Literal["demo", "evaluated", "unavailable"] = "evaluated"
    overall_score: float | None = None
    dimensions: EvidenceDimensions | None = None
    note: str | None = None
