import pytest

from app.schemas.post import Post
from app.services.ranking import rank_posts
from app.data.fixtures import POSTS
from app.services.ai import EvidencePipeline


ENGAGEMENT_ORDER = [
    "post-001",
    "post-007",
    "post-002",
    "post-004",
    "post-003",
    "post-005",
    "post-006",
]

EVIDENCE_ORDER = [
    "post-002",
    "post-007",
    "post-001",
    "post-003",
    "post-004",
    "post-005",
    "post-006",
]


def test_engagement_order_uses_likes_and_shares_only() -> None:
    ranked = rank_posts(POSTS, "engagement")
    assert [post.id for post in ranked] == ENGAGEMENT_ORDER
    assert all(post.evidence_adjustment == 0 for post in ranked)


def test_evidence_order_boosts_supported_and_demotes_contradicted() -> None:
    ranked = rank_posts(POSTS, "evidence")
    assert [post.id for post in ranked] == EVIDENCE_ORDER

    by_id = {post.id: post for post in ranked}
    assert by_id["post-002"].evidence_adjustment == pytest.approx(0.2)
    assert by_id["post-001"].evidence_adjustment == pytest.approx(-0.35)
    assert by_id["post-004"].evidence_adjustment == pytest.approx(-0.25)
    assert by_id["post-005"].evidence_adjustment == pytest.approx(-0.1)
    assert by_id["post-003"].evidence_adjustment == 0
    assert by_id["post-006"].evidence_adjustment == 0
    assert by_id["post-007"].evidence_adjustment == 0
    assert by_id["post-002"].score == pytest.approx(by_id["post-002"].engagement_score * 1.2)


def test_unreviewed_contradicted_post_is_not_penalized() -> None:
    post = Post(
        id="post-pending",
        type="text",
        author="Demo",
        content="A contradicted label that has not been approved.",
        likes=80,
        shares=0,
        evidence_status="contradicted",
        review_status="pending",
    )
    engagement = rank_posts([post], "engagement")[0]
    evidence = rank_posts([post], "evidence")[0]
    assert evidence.evidence_adjustment == 0
    assert evidence.score == engagement.score


def test_supported_boost_requires_an_approved_review() -> None:
    post = Post(
        id="post-unreviewed-support",
        type="text",
        author="Demo",
        content="A supported label that has not been approved.",
        likes=40,
        shares=4,
        evidence_status="supported",
        review_status="pending",
    )
    evidence = rank_posts([post], "evidence")[0]
    assert evidence.evidence_adjustment == 0
    assert evidence.score == evidence.engagement_score


def test_ai_pipeline_does_not_invent_a_label() -> None:
    pipeline = EvidencePipeline()
    with pytest.raises(NotImplementedError):
        pipeline.classify_claim("Example County counted late ballots.", ["source-handbook"])
    with pytest.raises(NotImplementedError):
        pipeline.transcribe_video("https://example.com/demo/video.mp4")
