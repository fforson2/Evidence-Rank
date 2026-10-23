from app.services.evidence_strength import score_post, strength_from_status
from app.services.rag import Chunk, ScoredChunk


def _hit(source_id: str, url: str, score: float) -> ScoredChunk:
    return ScoredChunk(
        chunk=Chunk(
            id=f"{source_id}#1",
            source_id=source_id,
            title="Election Day",
            url=url,
            publisher="USA.gov",
            text="In federal elections you cannot vote online.",
            embed_text="Election Day",
        ),
        score=score,
    )


def _overall(strength) -> int:
    dimensions = strength.dimensions
    assert dimensions is not None
    parts = (
        dimensions.source_quality,
        dimensions.relevance,
        dimensions.methodology,
        dimensions.corroboration,
    )
    assert sum(part.weight for part in parts) == 100
    return round(sum(part.score * part.weight for part in parts) / 100)


def test_a_supported_government_page_scores_above_a_contradiction() -> None:
    hit = _hit("usa-election-day", "https://www.usa.gov/election-day", 0.82)
    supported = score_post(status="supported", hits=[hit], cited_ids=["usa-election-day"])
    contradicted = score_post(status="contradicted", hits=[hit], cited_ids=["usa-election-day"])

    assert _overall(supported) > _overall(contradicted)
    assert supported.dimensions.source_quality.score == 88
    assert supported.provenance == "evaluated"


def test_a_post_with_no_claim_scores_zero() -> None:
    strength = score_post(status="not_checkable", hits=[], cited_ids=[])
    assert _overall(strength) == 0
    assert strength.note is not None


def test_a_stored_label_still_has_all_four_metrics() -> None:
    strength = strength_from_status("supported")
    assert strength.dimensions is not None
    assert strength.dimensions.relevance.score > 0
    assert _overall(strength) > _overall(strength_from_status("unresolved"))
