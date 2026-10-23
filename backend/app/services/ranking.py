from dataclasses import dataclass

from app.schemas.common import FeedMode
from app.schemas.post import Post, RankedPost


@dataclass(frozen=True)
class RankingWeights:
    """Configuration constants for the v1 ranker. These are not model outputs."""

    like_weight: float = 1.0
    share_weight: float = 2.5
    supported_boost: float = 0.20
    missing_context_penalty: float = 0.10
    source_mismatch_penalty: float = 0.25
    contradicted_penalty: float = 0.35


DEFAULT_WEIGHTS = RankingWeights()


def evidence_adjustment(post: Post, weights: RankingWeights = DEFAULT_WEIGHTS) -> float:
    """Return the fractional score change for an evidence-ranked feed.

    A penalty is applied only when an approved review recorded a negative
    finding (contradicted, source mismatch, or missing context). Supported
    posts with an approved review receive a boost.

    Unresolved claims, opinions (not_checkable), and posts that have not been
    approved are left unchanged. Missing or unfinished evidence is never an
    automatic penalty.
    """

    if post.review_status != "approved":
        return 0.0

    if post.evidence_status == "supported":
        return weights.supported_boost
    if post.evidence_status == "missing_context":
        return -weights.missing_context_penalty
    if post.evidence_status == "source_mismatch":
        return -weights.source_mismatch_penalty
    if post.evidence_status == "contradicted":
        return -weights.contradicted_penalty
    return 0.0


def rank_posts(
    posts: list[Post],
    mode: FeedMode,
    weights: RankingWeights = DEFAULT_WEIGHTS,
) -> list[RankedPost]:
    """Rank a copy of each post. Engagement mode ignores evidence labels."""

    scored: list[RankedPost] = []
    for post in posts:
        engagement_score = round(post.likes * weights.like_weight + post.shares * weights.share_weight, 4)
        adjustment = evidence_adjustment(post, weights) if mode == "evidence" else 0.0
        scored.append(
            RankedPost(
                **post.model_dump(),
                rank=1,
                engagement_score=engagement_score,
                evidence_adjustment=adjustment,
                score=round(engagement_score * (1 + adjustment), 4),
            )
        )

    scored.sort(key=lambda item: (-item.score, item.id))
    return [item.model_copy(update={"rank": index}) for index, item in enumerate(scored, start=1)]
