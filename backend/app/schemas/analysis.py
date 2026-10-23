from typing import Literal

from pydantic import BaseModel

from app.schemas.evidence import EvidenceExplanation
from app.schemas.post import RankedPost


class ModelRankResponse(BaseModel):
    mode: Literal["evidence"]
    data_origin: Literal["model"]
    disclaimer: str
    posts: list[RankedPost]
    explanations: list[EvidenceExplanation]
