"""Turn allowlisted pages into a capped set of claim posts."""

import hashlib
from datetime import datetime, timedelta, timezone

from app.config import settings
from app.data.corpus import CorpusDocument
from app.data.media import picture_for
from app.schemas.common import EvidenceStatus, ReviewStatus
from app.schemas.post import Post
from app.services.web_fetch import fetch_web_sources

MAX_CLAIMS = 10
_SKIP_PHRASES = (
    "not intended to replace the law",
    "does not create or confer any rights",
)


class LiveFeedUnavailable(Exception):
    """The public pages or the model could not produce a feed."""


def claim_post_id(text: str) -> str:
    normalized = " ".join(text.casefold().split())
    digest = hashlib.sha256(normalized.encode()).hexdigest()[:16]
    return f"claim-{digest}"


def is_stale(fetched_at: datetime | None, *, now: datetime | None = None) -> bool:
    if fetched_at is None:
        return True
    current = now or datetime.now(timezone.utc)
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)
    return current - fetched_at >= timedelta(seconds=settings.live_cache_seconds)


def build_posts(
    documents: list[CorpusDocument],
    extract_claims,
    saved: dict[str, dict],
) -> tuple[dict[str, Post], dict[str, CorpusDocument]]:
    """Keep up to MAX_CLAIMS checkable claims, spread across the pages."""

    if not documents:
        raise LiveFeedUnavailable("No allowlisted pages could be read.")
    per_page = max(1, MAX_CLAIMS // len(documents))
    posts: dict[str, Post] = {}
    origins: dict[str, CorpusDocument] = {}
    for document in documents:
        extracted = extract_claims(document.text[:6000])
        kept = 0
        for claim in extracted:
            text = claim.text.strip()
            if not claim.checkable or not text or _skipped(text):
                continue
            post_id = claim_post_id(text)
            record = saved.get(post_id, {})
            picture = picture_for(post_id)
            posts[post_id] = Post(
                id=post_id,
                type="text",
                author=document.publisher,
                content=text,
                video_url=None,
                image_url=picture.url,
                image_credit=picture.credit,
                likes=_nonnegative(record.get("likes", 0)),
                shares=_nonnegative(record.get("shares", 0)),
                evidence_status=_status(record.get("evidence_status"), "unresolved"),
                review_status=_review(record.get("review_status"), "pending"),
            )
            origins[post_id] = document
            kept += 1
            if kept >= per_page or len(posts) >= MAX_CLAIMS:
                break
        if len(posts) >= MAX_CLAIMS:
            break
    if not posts:
        raise LiveFeedUnavailable("The public pages did not yield a checkable claim.")
    return posts, origins


def load_documents() -> list[CorpusDocument]:
    return fetch_web_sources()


def _skipped(text: str) -> bool:
    lowered = text.casefold()
    return any(phrase in lowered for phrase in _SKIP_PHRASES)


def _nonnegative(value: object) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        return 0
    return max(0, value)


def _status(value: object, default: EvidenceStatus) -> EvidenceStatus:
    allowed = {
        "supported",
        "missing_context",
        "source_mismatch",
        "contradicted",
        "unresolved",
        "not_checkable",
    }
    if isinstance(value, str) and value in allowed:
        return value  # type: ignore[return-value]
    return default


def _review(value: object, default: ReviewStatus) -> ReviewStatus:
    if value in {"pending", "approved"}:
        return value  # type: ignore[return-value]
    return default
