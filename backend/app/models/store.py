"""Live posts extracted from public pages, with counts that survive a restart."""

from datetime import datetime, timezone
import json
from pathlib import Path
from threading import Lock
from uuid import uuid4

from app.data.corpus import CorpusDocument
from app.schemas.common import LIVE_DISCLAIMER, MODEL_DISCLAIMER
from app.schemas.event import InteractionEvent, InteractionEventCreate
from app.schemas.evidence import Claim, EvidenceExplanation, EvidenceSource
from app.schemas.post import Post, RankedPost
from app.services.live_feed import LiveFeedUnavailable, build_posts, is_stale, load_documents
from app.services.rag import EvidenceIndex, build_index

COUNTS_PATH = Path(__file__).resolve().parents[2] / "data" / "live_counts.json"


class LiveStore:
    """Posts for the running API. Tests can seed it and skip the network."""

    def __init__(self, counts_path: Path = COUNTS_PATH) -> None:
        self._lock = Lock()
        self._counts_path = counts_path
        self._posts: dict[str, Post] = {}
        self._origins: dict[str, CorpusDocument] = {}
        self._documents: list[CorpusDocument] = []
        self._saved: dict[str, dict] = {}
        self._explanations: dict[str, str] = {}
        self._events: list[InteractionEvent] = []
        self._manual = False
        self._ready = False
        self._fetched_at: datetime | None = None
        self._index: EvidenceIndex | None = None
        self._index_at: datetime | None = None
        self._load()

    def begin_manual(
        self,
        posts: list[Post],
        *,
        counts_path: Path | None = None,
        documents: list[CorpusDocument] | None = None,
    ) -> None:
        with self._lock:
            if counts_path is not None:
                self._counts_path = counts_path
            self._manual = True
            self._ready = True
            self._fetched_at = datetime.now(timezone.utc)
            self._posts = {post.id: post.model_copy() for post in posts}
            self._documents = list(documents or [])
            self._origins = {}
            self._index = None
            self._events = []

    def reset(self) -> None:
        with self._lock:
            self._manual = False
            self._ready = False
            self._posts = {}
            self._origins = {}
            self._documents = []
            self._events = []
            self._index = None
            self._fetched_at = None
            self._index_at = None
            self._counts_path = COUNTS_PATH
            saved = self._read_file(COUNTS_PATH)
            self._saved = saved
            self._explanations = {
                post_id: record["explanation"]
                for post_id, record in saved.items()
                if isinstance(record.get("explanation"), str)
            }

    def ensure_ready(self) -> None:
        if self._manual or (self._ready and not is_stale(self._fetched_at)):
            return
        with self._lock:
            if self._manual or (self._ready and not is_stale(self._fetched_at)):
                return
            documents = load_documents()
            posts, origins = build_posts(documents, _extract_claims, self._saved)
            self._documents = documents
            self._posts = posts
            self._origins = origins
            self._ready = True
            self._fetched_at = datetime.now(timezone.utc)
            self._index = None
            self._index_at = None

    def evidence_index(self, embedder) -> EvidenceIndex:
        self.ensure_ready()
        with self._lock:
            if self._index is None or self._index_at != self._fetched_at:
                self._index = build_index(self._documents, embedder)
                self._index_at = self._fetched_at
            return self._index

    def list_posts(self) -> list[Post]:
        return [post.model_copy() for post in self._posts.values()]

    def get_post(self, post_id: str) -> Post | None:
        post = self._posts.get(post_id)
        return post.model_copy() if post is not None else None

    def get_evidence(self, post_id: str) -> EvidenceExplanation | None:
        post = self._posts.get(post_id)
        if post is None:
            return None
        origin = self._origins.get(post_id)
        model_text = self._explanations.get(post_id, "").strip()
        if model_text:
            explanation = model_text
            data_origin = "model"
            disclaimer = MODEL_DISCLAIMER
        else:
            page = origin.title if origin is not None else "the allowlisted public pages"
            explanation = f"This claim was taken from {page}."
            data_origin = "live"
            disclaimer = LIVE_DISCLAIMER
        sources = []
        if origin is not None:
            sources.append(
                EvidenceSource(
                    id=origin.id,
                    title=origin.title,
                    url=origin.url,
                    publisher=origin.publisher,
                )
            )
        return EvidenceExplanation(
            post_id=post.id,
            data_origin=data_origin,
            disclaimer=disclaimer,
            claims=[
                Claim(
                    id=post.id,
                    text=post.content,
                    evidence_status=post.evidence_status,
                    review_status=post.review_status,
                    explanation=explanation,
                    sources=sources,
                )
            ],
        )

    def add_event(self, payload: InteractionEventCreate) -> InteractionEvent:
        if payload.event_type == "like" and payload.post_id is not None:
            self._adjust(payload.post_id, likes=_like_delta(payload.metadata))
        elif payload.event_type == "share" and payload.post_id is not None:
            self._adjust(payload.post_id, shares=1)
        event = InteractionEvent(
            id=str(uuid4()),
            post_id=payload.post_id,
            event_type=payload.event_type,
            feed_mode=payload.feed_mode,
            metadata=payload.metadata,
            created_at=datetime.now(timezone.utc),
        )
        self._events.append(event)
        return event

    def apply_labels(self, ranked: list[RankedPost], explanations: list) -> None:
        by_id = {item.post_id: item for item in explanations}
        with self._lock:
            for post in ranked:
                current = self._posts.get(post.id)
                if current is None:
                    continue
                explanation = by_id.get(post.id)
                text = ""
                if explanation is not None and explanation.claims:
                    text = explanation.claims[0].explanation
                updated = current.model_copy(
                    update={
                        "evidence_status": post.evidence_status,
                        "review_status": post.review_status,
                    }
                )
                self._posts[post.id] = updated
                if text.strip():
                    self._explanations[post.id] = text.strip()
                self._remember(updated, text)
            self._persist()

    def clear_events(self) -> None:
        self._events.clear()

    def _adjust(self, post_id: str, *, likes: int = 0, shares: int = 0) -> None:
        with self._lock:
            current = self._posts.get(post_id)
            if current is None:
                return
            updated = current.model_copy(
                update={
                    "likes": max(0, current.likes + likes),
                    "shares": max(0, current.shares + shares),
                }
            )
            self._posts[post_id] = updated
            self._remember(updated, self._explanations.get(post_id, ""))
            self._persist()

    def _remember(self, post: Post, explanation: str) -> None:
        record = self._saved.setdefault(post.id, {})
        record["likes"] = post.likes
        record["shares"] = post.shares
        record["evidence_status"] = post.evidence_status
        record["review_status"] = post.review_status
        if explanation.strip():
            record["explanation"] = explanation.strip()

    def _persist(self) -> None:
        self._counts_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"posts": self._saved}
        self._counts_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")

    def _load(self) -> None:
        self._saved = self._read_file(self._counts_path)
        self._explanations = {
            post_id: record["explanation"]
            for post_id, record in self._saved.items()
            if isinstance(record.get("explanation"), str)
        }

    @staticmethod
    def _read_file(path: Path) -> dict[str, dict]:
        if not path.exists():
            return {}
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        posts = payload.get("posts", {})
        if not isinstance(posts, dict):
            return {}
        return {key: value for key, value in posts.items() if isinstance(value, dict)}


def _extract_claims(text: str):
    from app.config import settings
    from app.services.ai import OpenAIEvidenceModel, PipelineNotConfigured

    if not settings.openai_api_key:
        raise LiveFeedUnavailable("OPENAI_API_KEY is not set.")
    model = OpenAIEvidenceModel(
        api_key=settings.openai_api_key,
        chat_model=settings.openai_chat_model,
        embedding_model=settings.openai_embedding_model,
    )
    try:
        return model.extract_claims(text)
    except PipelineNotConfigured as exc:
        raise LiveFeedUnavailable(str(exc)) from exc


def _like_delta(metadata: dict) -> int:
    raw = metadata.get("delta", 1)
    return -1 if raw == -1 else 1


store = LiveStore()
