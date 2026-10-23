"""Demo evidence lookups.

Ranking reads the post-level evidence_status. These records are the explanation
payload only. They are fixtures, not output from the evidence pipeline.
"""

from app.data.fixtures import evidence_for
from app.schemas.evidence import EvidenceExplanation


def get_demo_evidence(post_id: str) -> EvidenceExplanation | None:
    return evidence_for(post_id)
