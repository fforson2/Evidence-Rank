from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.store import store
from app.schemas.post import Post

SEEDED = [
    Post(
        id="claim-low",
        type="text",
        author="USA.gov",
        content="In federal elections in the U.S., you cannot vote online.",
        video_url=None,
        likes=2,
        shares=0,
        evidence_status="unresolved",
        review_status="pending",
    ),
    Post(
        id="claim-high",
        type="text",
        author="Federal Election Commission",
        content="Committees file reports on a statutory schedule.",
        video_url=None,
        likes=0,
        shares=1,
        evidence_status="unresolved",
        review_status="pending",
    ),
]


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    store.begin_manual(SEEDED, counts_path=tmp_path / "counts.json")
    yield TestClient(app)
    store.reset()


def test_model_rank_requires_an_api_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "openai_api_key", "")
    response = client.post("/analysis/rank")
    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "not_configured"


def test_model_rank_route_returns_formula_scores(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.schemas.common import MODEL_DISCLAIMER
    from app.schemas.evidence import Claim, EvidenceExplanation
    from app.services.ranking import rank_posts

    class StubPipeline:
        def rank_feed(self, posts):
            labeled = [
                post.model_copy(update={"evidence_status": "supported", "review_status": "approved"})
                for post in posts
            ]
            ranked = rank_posts(labeled, "evidence")
            explanations = [
                EvidenceExplanation(
                    post_id=post.id,
                    data_origin="model",
                    disclaimer=MODEL_DISCLAIMER,
                    claims=[
                        Claim(
                            id=f"{post.id}-model",
                            text=post.content,
                            evidence_status="supported",
                            review_status="approved",
                            explanation="Stub label.",
                            sources=[],
                        )
                    ],
                )
                for post in ranked
            ]
            return ranked, explanations

    monkeypatch.setattr("app.routers.analysis.default_pipeline", lambda: StubPipeline())
    response = client.post("/analysis/rank")
    assert response.status_code == 200
    body = response.json()
    assert body["data_origin"] == "model"
    assert body["mode"] == "evidence"
    labeled = [
        post.model_copy(update={"evidence_status": "supported", "review_status": "approved"}) for post in SEEDED
    ]
    assert [post["id"] for post in body["posts"]] == [post.id for post in rank_posts(labeled, "evidence")]
    assert body["posts"][0]["evidence_adjustment"] == pytest.approx(0.2)
    assert len(body["explanations"]) == len(body["posts"])
    stored = store.get_post("claim-high")
    assert stored is not None
    assert stored.evidence_status == "supported"


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_posts_are_live_claims(client: TestClient) -> None:
    response = client.get("/posts")
    assert response.status_code == 200
    body = response.json()
    assert body["data_origin"] == "live"
    posts = body["posts"]
    assert {post["id"] for post in posts} == {"claim-low", "claim-high"}
    assert {post["type"] for post in posts} == {"text"}
    assert all(post["video_url"] is None for post in posts)


def test_feed_uses_live_counts(client: TestClient) -> None:
    engagement = client.get("/feed", params={"mode": "engagement"})
    evidence = client.get("/feed", params={"mode": "evidence"})
    assert engagement.status_code == 200
    assert evidence.status_code == 200
    assert engagement.json()["data_origin"] == "live"
    assert [post["id"] for post in engagement.json()["posts"]] == ["claim-high", "claim-low"]
    assert engagement.json()["posts"][0]["rank"] == 1
    assert [post["id"] for post in evidence.json()["posts"]] == ["claim-high", "claim-low"]


def test_like_changes_engagement_order(client: TestClient, tmp_path: Path) -> None:
    before = [post["id"] for post in client.get("/feed", params={"mode": "engagement"}).json()["posts"]]
    assert before == ["claim-high", "claim-low"]

    liked = client.post(
        "/events",
        json={"post_id": "claim-low", "event_type": "like", "feed_mode": "engagement", "metadata": {"delta": 1}},
    )
    assert liked.status_code == 201

    after = client.get("/feed", params={"mode": "engagement"}).json()["posts"]
    assert [post["id"] for post in after] == ["claim-low", "claim-high"]
    assert after[0]["likes"] == 3

    saved = (tmp_path / "counts.json").read_text(encoding="utf-8")
    assert '"likes": 3' in saved

    undone = client.post(
        "/events",
        json={"post_id": "claim-low", "event_type": "like", "feed_mode": "engagement", "metadata": {"delta": -1}},
    )
    assert undone.status_code == 201
    restored = [post["id"] for post in client.get("/feed", params={"mode": "engagement"}).json()["posts"]]
    assert restored == ["claim-high", "claim-low"]


def test_feed_rejects_unknown_mode(client: TestClient) -> None:
    response = client.get("/feed", params={"mode": "popular"})
    assert response.status_code == 422


def test_evidence_describes_the_live_page(client: TestClient) -> None:
    response = client.get("/posts/claim-low/evidence")
    assert response.status_code == 200
    body = response.json()
    assert body["data_origin"] == "live"
    assert body["claims"][0]["evidence_status"] == "unresolved"
    assert "allowlisted" in body["claims"][0]["explanation"]


def test_missing_post_evidence(client: TestClient) -> None:
    response = client.get("/posts/post-missing/evidence")
    assert response.status_code == 404
    assert response.json()["detail"] == {"error": "not_found", "message": "Post not found"}


def test_create_event(client: TestClient) -> None:
    response = client.post(
        "/events",
        json={"post_id": "claim-high", "event_type": "share", "feed_mode": "evidence", "metadata": {}},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["post_id"] == "claim-high"
    assert body["event_type"] == "share"
    assert body["id"]
    stored = store.get_post("claim-high")
    assert stored is not None
    assert stored.shares == 2


def test_event_without_post_and_unknown_post(client: TestClient) -> None:
    mode_change = client.post(
        "/events",
        json={"event_type": "feed_mode_change", "feed_mode": "engagement", "metadata": {"from": "evidence"}},
    )
    assert mode_change.status_code == 201
    assert mode_change.json()["post_id"] is None

    missing = client.post(
        "/events",
        json={"post_id": "post-missing", "event_type": "share", "feed_mode": "engagement"},
    )
    assert missing.status_code == 404

    invalid = client.post("/events", json={"event_type": "like"})
    assert invalid.status_code == 422
