import pytest

from app.data.corpus import CORPUS, CorpusDocument
from app.data.fixtures import POSTS, evidence_for
from app.services.rag import EvidenceIndex, build_index, chunk_documents


class AxisEmbedder:
    """Maps a few phrases onto orthogonal axes so retrieval tests stay deterministic."""

    def embed(self, texts: list[str]) -> list[list[float]]:
        return [_axis(text) for text in texts]


def _axis(text: str) -> list[float]:
    lowered = text.lower()
    if "2012" in lowered:
        return [0.0, 0.0, 1.0, 0.0]
    if "handbook" in lowered or "mail ballot" in lowered or "8 p.m." in lowered:
        return [1.0, 0.0, 0.0, 0.0]
    if "turnout report" in lowered or "64%" in lowered:
        return [0.0, 1.0, 0.0, 0.0]
    if "canvass" in lowered or "duplicate" in lowered:
        return [0.0, 0.0, 0.0, 1.0]
    return [0.0, 0.0, 0.0, 0.0]


def test_corpus_covers_every_fixture_source() -> None:
    source_ids: set[str] = set()
    for post in POSTS:
        evidence = evidence_for(post.id)
        assert evidence is not None
        for claim in evidence.claims:
            source_ids.update(source.id for source in claim.sources)
    assert source_ids == {document.id for document in CORPUS}


def test_paragraphs_become_separate_chunks() -> None:
    document = CorpusDocument(
        id="source-handbook",
        title="Handbook",
        url="https://example.com/demo/handbook",
        publisher="Demo",
        text="First rule.\n\nSecond rule.",
    )
    chunks = chunk_documents([document])
    assert [chunk.id for chunk in chunks] == ["source-handbook#1", "source-handbook#2"]
    assert chunks[0].text == "First rule."
    assert chunks[1].source_id == "source-handbook"


def test_search_returns_the_nearest_passage_above_the_cutoff() -> None:
    index = build_index(CORPUS, AxisEmbedder())
    mail = index.search(_axis("mail ballots must arrive by 8 p.m."), k=2, min_score=0.3)
    assert mail[0].chunk.source_id == "source-handbook"
    assert mail[0].score == pytest.approx(1.0)

    missing = index.search(_axis("Oak Street polling place"), k=4, min_score=0.3)
    assert missing == []


def test_index_rejects_a_short_embedding_batch() -> None:
    chunks = chunk_documents(CORPUS[:1])
    with pytest.raises(ValueError):
        EvidenceIndex(chunks, [])
