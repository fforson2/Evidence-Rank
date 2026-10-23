from fastapi import APIRouter

from app.errors import http_error
from app.models.store import store
from app.schemas.evidence import EvidenceExplanation

router = APIRouter(tags=["evidence"])


@router.get("/posts/{post_id}/evidence", response_model=EvidenceExplanation)
def read_post_evidence(post_id: str) -> EvidenceExplanation:
    evidence = store.get_evidence(post_id)
    if evidence is None:
        raise http_error(404, "not_found", "Post not found")
    return evidence
