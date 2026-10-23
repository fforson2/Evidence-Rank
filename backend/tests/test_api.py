import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models.store import store
from tests.test_ranking import ENGAGEMENT_ORDER, EVIDENCE_ORDER


@pytest.fixture
def client() -> TestClient:
    store.clear_events()
    return TestClient(app)


def test_model_rank_requires_an_api_key(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.config import settings

    monkeypatch.setattr(settings, "openai_api_key", "")
    response = client.post("/analysis/rank")
    assert response.status_code == 503
    assert response.json()["detail"]["error"] == "not_configured"


def test_model_rank_route_returns_formula_scores(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.data.fixtures import POSTS
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
    assert [post["id"] for post in body["posts"]] == [post.id for post in rank_posts(
        [post.model_copy(update={"evidence_status": "supported", "review_status": "approved"}) for post in POSTS],
        "evidence",
    )]
    assert body["posts"][0]["evidence_adjustment"] == pytest.approx(0.2)
    assert len(body["explanations"]) == len(body["posts"])


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_posts_include_text_and_video(client: TestClient) -> None:
    response = client.get("/posts")
    assert response.status_code == 200
    body = response.json()
    assert body["data_origin"] == "demo"
    posts = body["posts"]
    assert {post["type"] for post in posts} == {"text", "video"}
    text_post = next(post for post in posts if post["id"] == "post-001")
    assert text_post["video_url"] is None
    assert text_post["evidence_status"] == "contradicted"


def test_feed_modes(client: TestClient) -> None:
    engagement = client.get("/feed", params={"mode": "engagement"})
    evidence = client.get("/feed", params={"mode": "evidence"})
    assert engagement.status_code == 200
    assert evidence.status_code == 200
    assert [post["id"] for post in engagement.json()["posts"]] == ENGAGEMENT_ORDER
    assert [post["id"] for post in evidence.json()["posts"]] == EVIDENCE_ORDER
    assert engagement.json()["posts"][0]["rank"] == 1


def test_feed_rejects_unknown_mode(client: TestClient) -> None:
    response = client.get("/feed", params={"mode": "popular"})
    assert response.status_code == 422


def test_evidence_is_labeled_as_demo(client: TestClient) -> None:
    response = client.get("/posts/post-001/evidence")
    assert response.status_code == 200
    body = response.json()
    assert body["data_origin"] == "demo"
    assert body["claims"][0]["evidence_status"] == "contradicted"
    assert body["claims"][0]["sources"][0]["url"].startswith("https://example.com/")


def test_missing_post_evidence(client: TestClient) -> None:
    response = client.get("/posts/post-missing/evidence")
    assert response.status_code == 404
    assert response.json()["detail"] == {"error": "not_found", "message": "Post not found"}


def test_create_event(client: TestClient) -> None:
    response = client.post(
        "/events",
        json={"post_id": "post-002", "event_type": "like", "feed_mode": "evidence", "metadata": {}},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["post_id"] == "post-002"
    assert body["event_type"] == "like"
    assert body["id"]


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
