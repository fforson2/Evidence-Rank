"""Score a claim on the four evidence-strength metrics.

Weights match the frontend: source quality 30, relevance 25, methodology 25,
corroboration 20. The overall score is the weighted average. These are
retrieval measurements, not a validated scientific rating.
"""

from app.schemas.common import EvidenceStatus
from app.schemas.strength import EvidenceDimensionScore, EvidenceDimensions, EvidenceStrength
from app.services.rag import ScoredChunk

_WEIGHTS = {
    "source_quality": 30,
    "relevance": 25,
    "methodology": 25,
    "corroboration": 20,
}


def strength_from_status(status: EvidenceStatus) -> EvidenceStrength:
    """Score a post from its evidence label when retrieval details are not on hand."""

    if status == "not_checkable":
        return score_post(status=status, hits=[], cited_ids=[])
    cited = status != "unresolved"
    source_score = {"supported": 80, "missing_context": 70, "source_mismatch": 55, "contradicted": 45}.get(status, 20)
    source_text = (
        "No retrieved page is stored for this claim."
        if status == "unresolved"
        else "The stored label came from the public pages. The specific cited page was not kept with this score."
    )
    return _strength(
        source_quality=(source_score, source_text, []),
        relevance=(_default_relevance(status), _relevance_explanation(status, None, []), []),
        methodology=(_methodology_score(status, cited), _methodology_explanation(status, cited), []),
        corroboration=(
            _corroboration_score(status, 1 if status == "supported" else 0),
            _corroboration_explanation(status, 1 if status == "supported" else 0),
            [],
        ),
        note=None,
    )


def score_post(
    *,
    status: EvidenceStatus,
    hits: list[ScoredChunk],
    cited_ids: list[str],
) -> EvidenceStrength:
    cited = [hit for hit in hits if hit.chunk.source_id in cited_ids]
    best = _best(cited or hits)
    government = any(_is_government(hit) for hit in cited)
    distinct = len({hit.chunk.source_id for hit in cited})

    if status == "not_checkable":
        return _strength(
            source_quality=(0, "This post has no checkable claim to trace to a source.", []),
            relevance=(0, "There is no factual claim for a passage to support.", []),
            methodology=(0, "There is no claim whose method can be assessed.", []),
            corroboration=(0, "Nothing can corroborate a post that makes no checkable claim.", []),
            note="This post has no checkable claim, so every metric is 0.",
        )

    source_ids = [hit.chunk.source_id for hit in cited]
    if not cited:
        source = (
            12,
            "No retrieved page was cited, so the claim is not traced to a source.",
            [],
        )
    elif government:
        source = (
            88,
            "The cited page is a United States government source.",
            source_ids,
        )
    else:
        source = (
            62,
            "A page was cited, but it is not a United States government source.",
            source_ids,
        )

    similarity = 0.0 if best is None else max(0.0, min(1.0, best.score))
    relevance_score = _cap(_relevance_cap(status, cited), round(similarity * 100) if best else _default_relevance(status))
    relevance = (
        relevance_score,
        _relevance_explanation(status, best, cited),
        source_ids,
    )
    methodology = (_methodology_score(status, bool(cited)), _methodology_explanation(status, bool(cited)), source_ids)
    corroboration = (
        _corroboration_score(status, distinct),
        _corroboration_explanation(status, distinct),
        source_ids,
    )
    return _strength(
        source_quality=source,
        relevance=relevance,
        methodology=methodology,
        corroboration=corroboration,
        note=None,
    )


def _strength(
    *,
    source_quality: tuple[int, str, list[str]],
    relevance: tuple[int, str, list[str]],
    methodology: tuple[int, str, list[str]],
    corroboration: tuple[int, str, list[str]],
    note: str | None,
) -> EvidenceStrength:
    values = {
        "source_quality": source_quality,
        "relevance": relevance,
        "methodology": methodology,
        "corroboration": corroboration,
    }
    dimensions = {
        key: EvidenceDimensionScore(score=score, weight=_WEIGHTS[key], explanation=explanation, source_ids=source_ids)
        for key, (score, explanation, source_ids) in values.items()
    }
    return EvidenceStrength(
        provenance="evaluated",
        overall_score=None,
        dimensions=EvidenceDimensions(**dimensions),
        note=note,
    )


def _best(hits: list[ScoredChunk]) -> ScoredChunk | None:
    if not hits:
        return None
    return max(hits, key=lambda hit: hit.score)


def _is_government(hit: ScoredChunk) -> bool:
    url = hit.chunk.url.casefold()
    publisher = hit.chunk.publisher.casefold()
    return ".gov" in url or "federal election commission" in publisher or publisher.startswith("usa.gov")


def _relevance_cap(status: EvidenceStatus, cited: list[ScoredChunk]) -> int:
    if status == "supported" and cited:
        return 100
    if status == "missing_context":
        return 60
    if status == "source_mismatch":
        return 35
    if status == "contradicted":
        return 25
    if status == "unresolved":
        return 40 if cited else 20
    return 20


def _default_relevance(status: EvidenceStatus) -> int:
    if status == "supported":
        return 75
    if status == "missing_context":
        return 55
    if status == "source_mismatch":
        return 30
    if status == "contradicted":
        return 20
    return 20


def _cap(limit: int, score: int) -> int:
    return max(0, min(limit, score))


def _relevance_explanation(status: EvidenceStatus, best: ScoredChunk | None, cited: list[ScoredChunk]) -> str:
    if best is None:
        if status == "supported":
            return "The stored label is supported. Passage similarity was not available, so relevance uses that label."
        return "No passage was close enough to measure how directly it supports the claim."
    similarity = f"{best.score:.2f}"
    if status == "supported" and cited:
        return f"The closest cited passage matched the claim at similarity {similarity}, and the label is supported."
    if status == "contradicted":
        return f"A passage matched at similarity {similarity}, but the label is contradicted, so it does not support the claim as written."
    if status == "source_mismatch":
        return f"A passage matched at similarity {similarity}, but it is about a different situation than the claim."
    if status == "missing_context":
        return f"A passage matched at similarity {similarity}, and the label says the claim leaves out context."
    return f"The closest passage matched at similarity {similarity}, which is not enough to settle the claim."


def _methodology_score(status: EvidenceStatus, cited: bool) -> int:
    if not cited:
        return 15
    if status == "supported":
        return 58
    if status == "missing_context":
        return 42
    if status == "source_mismatch":
        return 28
    if status == "contradicted":
        return 22
    return 18


def _methodology_explanation(status: EvidenceStatus, cited: bool) -> str:
    if not cited:
        return "No cited page describes how the claim was established."
    if status == "supported":
        return "The cited text is public guidance. It does not describe a study design or a data-collection method."
    if status == "missing_context":
        return "The cited page is relevant, but the claim leaves out limits the page itself states."
    return "The way the claim uses the cited page does not match what the page says."


def _corroboration_score(status: EvidenceStatus, distinct: int) -> int:
    if status in {"contradicted", "source_mismatch"}:
        return 8
    if distinct >= 3:
        return 88
    if distinct == 2:
        return 68
    if distinct == 1:
        return 42
    return 5


def _corroboration_explanation(status: EvidenceStatus, distinct: int) -> str:
    if status in {"contradicted", "source_mismatch"}:
        return "The cited page does not independently confirm the claim."
    if distinct >= 2:
        return f"{distinct} different pages were cited."
    if distinct == 1:
        return "One page was cited. No second source confirmed the claim."
    return "No page was cited, so nothing corroborates the claim."
