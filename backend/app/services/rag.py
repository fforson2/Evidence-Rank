"""In-memory retrieval over the demo evidence corpus.

Chunk text is embedded by an injected embedder. Search ranks chunks by cosine
similarity and drops anything below the caller's minimum score. The index holds
vectors for the life of the process. It does not call OpenAI by itself.
"""

from dataclasses import dataclass
import math
import threading
from typing import Protocol

from app.data.corpus import CORPUS, CorpusDocument


class Embedder(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one vector per input, in the same order."""


@dataclass(frozen=True)
class Chunk:
    id: str
    source_id: str
    title: str
    url: str
    publisher: str
    text: str
    embed_text: str


@dataclass(frozen=True)
class ScoredChunk:
    chunk: Chunk
    score: float


class EvidenceIndex:
    def __init__(self, chunks: list[Chunk], vectors: list[list[float]]) -> None:
        if len(chunks) != len(vectors):
            raise ValueError("The embedder did not return one vector per chunk.")
        width = len(vectors[0]) if vectors else 0
        if any(len(vector) != width or width == 0 for vector in vectors):
            raise ValueError("Embedding vectors must be non-empty and the same length.")
        self._chunks = list(chunks)
        self._vectors = [list(vector) for vector in vectors]

    def search(self, query_vector: list[float], *, k: int, min_score: float) -> list[ScoredChunk]:
        scored = [
            ScoredChunk(chunk=chunk, score=_cosine(query_vector, vector))
            for chunk, vector in zip(self._chunks, self._vectors, strict=True)
        ]
        scored.sort(key=lambda item: (-item.score, item.chunk.id))
        return [item for item in scored if item.score >= min_score][:k]

    def passages_for(self, source_ids: list[str]) -> list[ScoredChunk]:
        grouped: dict[str, list[Chunk]] = {}
        for chunk in self._chunks:
            grouped.setdefault(chunk.source_id, []).append(chunk)
        hits: list[ScoredChunk] = []
        seen: set[str] = set()
        for source_id in source_ids:
            if source_id in seen:
                continue
            seen.add(source_id)
            for chunk in grouped.get(source_id, []):
                hits.append(ScoredChunk(chunk=chunk, score=1.0))
        return hits


def chunk_documents(documents: list[CorpusDocument]) -> list[Chunk]:
    chunks: list[Chunk] = []
    for document in documents:
        paragraphs = [part.strip() for part in document.text.split("\n\n") if part.strip()]
        if not paragraphs and document.text.strip():
            paragraphs = [document.text.strip()]
        for index, paragraph in enumerate(paragraphs, start=1):
            chunks.append(
                Chunk(
                    id=f"{document.id}#{index}",
                    source_id=document.id,
                    title=document.title,
                    url=document.url,
                    publisher=document.publisher,
                    text=paragraph,
                    embed_text=f"{document.title}\n{paragraph}",
                )
            )
    return chunks


def build_index(documents: list[CorpusDocument], embedder: Embedder) -> EvidenceIndex:
    chunks = chunk_documents(documents)
    if not chunks:
        return EvidenceIndex([], [])
    vectors = embedder.embed([chunk.embed_text for chunk in chunks])
    return EvidenceIndex(chunks, vectors)


_index_cache: EvidenceIndex | None = None
_index_lock = threading.Lock()


def cached_index(embedder: Embedder) -> EvidenceIndex:
    """Embed the demo corpus once per process."""

    global _index_cache
    with _index_lock:
        if _index_cache is None:
            _index_cache = build_index(CORPUS, embedder)
        return _index_cache


def clear_index_cache() -> None:
    global _index_cache
    with _index_lock:
        _index_cache = None


def _cosine(left: list[float], right: list[float]) -> float:
    if len(left) != len(right) or not left:
        raise ValueError("Embedding vectors must be non-empty and the same length.")
    dot = sum(x * y for x, y in zip(left, right, strict=True))
    left_norm = math.sqrt(sum(x * x for x in left))
    right_norm = math.sqrt(sum(y * y for y in right))
    if left_norm == 0 or right_norm == 0:
        return 0.0
    return dot / (left_norm * right_norm)
