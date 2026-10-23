import pytest

from app.data.corpus import CORPUS
from app.data.fixtures import POSTS
from app.schemas.post import Post
from app.services.ai import (
    EvidencePipeline,
    ExtractedClaim,
    PassageClassification,
    PipelineNotConfigured,
    PipelineUnavailable,
    default_pipeline,
)
from app.services.rag import ScoredChunk, build_index
from tests.test_rag import AxisEmbedder


class ScriptedModel(AxisEmbedder):
    def __init__(self) -> None:
        self.classified: list[str] = []
        self.embedded_queries: list[str] = []
        self.force_uncited = False

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.embedded_queries.extend(texts)
        return super().embed(texts)

    def extract_claims(self, text: str) -> list[ExtractedClaim]:
        if text.lower().startswith("i think"):
            return [ExtractedClaim(text=text, checkable=False)]
        return [ExtractedClaim(text=text, checkable=True)]

    def classify(self, claim: str, passages: list[ScoredChunk]) -> PassageClassification:
        self.classified.append(claim)
        if self.force_uncited:
            return PassageClassification(
                evidence_status="contradicted",
                explanation="This should not be applied.",
                source_ids=["source-missing"],
            )
        source_id = passages[0].chunk.source_id
        if source_id == "source-handbook":
            status = "contradicted"
        elif source_id == "source-2012":
            status = "source_mismatch"
        elif source_id == "source-canvass":
            status = "missing_context"
        else:
            status = "supported"
        return PassageClassification(
            evidence_status=status,
            explanation=f"Labeled from {source_id}.",
            source_ids=[source_id, source_id],
        )


def _pipeline(model: ScriptedModel | None = None) -> tuple[ScriptedModel, EvidencePipeline]:
    scripted = model or ScriptedModel()
    index = build_index(CORPUS, AxisEmbedder())
    return scripted, EvidencePipeline(scripted, index, top_k=4, min_score=0.3)


def test_classify_without_passages_does_not_invent_a_label() -> None:
    _, pipeline = _pipeline()
    with pytest.raises(PipelineUnavailable):
        pipeline.classify_claim("Example County counted late ballots.", [])
    with pytest.raises(PipelineUnavailable):
        pipeline.transcribe_video("https://example.com/demo/video.mp4")


def test_model_labels_drive_the_evidence_formula() -> None:
    model, pipeline = _pipeline()
    posts = [post for post in POSTS if post.id in {"post-001", "post-002", "post-006"}]
    ranked, explanations = pipeline.rank_feed(posts)
    by_id = {post.id: post for post in ranked}

    assert by_id["post-001"].evidence_status == "contradicted"
    assert by_id["post-001"].evidence_adjustment == pytest.approx(-0.35)
    assert by_id["post-001"].review_status == "approved"
    assert by_id["post-002"].evidence_status == "supported"
    assert by_id["post-002"].evidence_adjustment == pytest.approx(0.2)
    assert by_id["post-006"].evidence_status == "not_checkable"
    assert by_id["post-006"].evidence_adjustment == 0
    assert [post.id for post in ranked] == ["post-002", "post-001", "post-006"]

    handbook = next(item for item in explanations if item.post_id == "post-001")
    assert handbook.data_origin == "model"
    assert [source.id for source in handbook.claims[0].sources] == ["source-handbook"]
    assert len(model.classified) == 2
    assert all(not query.lower().startswith("i think") for query in model.embedded_queries)


def test_a_claim_with_no_matching_passage_stays_unresolved() -> None:
    post = Post(
        id="post-oak",
        type="text",
        author="Demo",
        content="The Oak Street polling place moved the night before the election.",
        likes=100,
        shares=0,
        evidence_status="supported",
        review_status="approved",
    )
    model, pipeline = _pipeline()
    ranked, explanations = pipeline.rank_feed([post])
    assert ranked[0].evidence_status == "unresolved"
    assert ranked[0].evidence_adjustment == 0
    assert ranked[0].score == ranked[0].engagement_score
    assert explanations[0].claims[0].sources == []
    assert model.classified == []


def test_uncited_model_label_does_not_change_the_score() -> None:
    model, pipeline = _pipeline()
    model.force_uncited = True
    post = next(item for item in POSTS if item.id == "post-001")
    ranked, explanations = pipeline.rank_feed([post])
    assert ranked[0].evidence_status == "unresolved"
    assert ranked[0].evidence_adjustment == 0
    assert explanations[0].claims[0].sources == []
    assert "should not be applied" not in explanations[0].claims[0].explanation


def test_default_pipeline_requires_an_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "openai_api_key", "")
    with pytest.raises(PipelineNotConfigured):
        default_pipeline()
