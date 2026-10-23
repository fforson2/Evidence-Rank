"""Shared API literals.

Keep these aligned with frontend/types/index.ts and docs/api-contract.md.
"""

from typing import Literal

FeedMode = Literal["engagement", "evidence"]
PostType = Literal["text", "video"]
EvidenceStatus = Literal[
    "supported",
    "missing_context",
    "source_mismatch",
    "contradicted",
    "unresolved",
    "not_checkable",
]
ReviewStatus = Literal["pending", "approved"]
EventType = Literal["view", "like", "share", "evidence_open", "feed_mode_change"]
DataOrigin = Literal["demo", "live", "model"]

DEMO_DISCLAIMER = (
    "Demo data. These posts and evidence labels are fixtures for local development. "
    "They are not live fact-checks."
)

LIVE_DISCLAIMER = (
    "Live posts. These claims were extracted from allowlisted United States government pages. "
    "Likes and shares are counted in this app. Evidence labels are added when EvidenceRank runs."
)

MODEL_DISCLAIMER = (
    "Evidence labels come from passages in the allowlisted public pages, and the EvidenceRank formula "
    "turned those labels into scores. These labels are not human fact-checks."
)
