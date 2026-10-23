"""Evidence labeling through retrieval and OpenAI.

The numeric rank still comes from the EvidenceRank formula. This module asks
the model for an evidence label, and only after retrieval returns a passage.
A missing key, an empty retrieval, or a label that cites nothing is left
unresolved or not-checkable. Those statuses do not change the engagement score.

Video posts are ranked from their captions. This phase does not download video.
"""

from typing import Protocol

from pydantic import BaseModel, Field

from app.config import settings
from app.schemas.common import MODEL_DISCLAIMER, EvidenceStatus
from app.schemas.evidence import Claim, EvidenceExplanation, EvidenceSource
from app.schemas.post import Post, RankedPost
from app.services.rag import EvidenceIndex, ScoredChunk, cached_index
from app.services.ranking import rank_posts

_GROUNDED_STATUSES = {"supported", "missing_context", "source_mismatch", "contradicted"}

_EXTRACT_INSTRUCTIONS = (
    "Extract the factual claims from a social post about a fictional Example County election. "
    "Return each distinct claim that the post states. Mark checkable false for opinions, "
    "advice, and predictions. Do not add facts that are not in the post. "
    "If the post has no checkable claim, return one claim with checkable set to false."
)

_CLASSIFY_INSTRUCTIONS = (
    "Label one claim using only the retrieved source passages. "
    "supported means the passages directly support the claim. "
    "contradicted means the passages directly contradict the claim. "
    "missing_context means the passages show the claim leaves out context that changes its meaning. "
    "source_mismatch means the passages are about a different event, year, or subject than the claim. "
    "unresolved means the passages do not contain enough information to label the claim. "
    "not_checkable means the claim is an opinion or other non-factual statement. "
    "Cite only source ids that appear in the passages. "
    "If you cannot cite a passage, use unresolved and an empty source_ids list. "
    "Do not use outside knowledge. The corpus is fictional demo material."
)


class PipelineNotConfigured(Exception):
    """The model route was called without OPENAI_API_KEY."""


class PipelineUnavailable(Exception):
    """A step cannot run, so it must not invent a label or an explanation."""


class PipelineError(Exception):
    """The model request failed or returned nothing usable."""


class ExtractedClaim(BaseModel):
    text: str
    checkable: bool


class ClaimExtraction(BaseModel):
    claims: list[ExtractedClaim] = Field(default_factory=list)


class PassageClassification(BaseModel):
    evidence_status: EvidenceStatus
    explanation: str
    source_ids: list[str] = Field(default_factory=list)


class EvidenceModel(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]:
        """Return one embedding per text."""

    def extract_claims(self, text: str) -> list[ExtractedClaim]:
        """Read claims from a post caption or body."""

    def classify(self, claim: str, passages: list[ScoredChunk]) -> PassageClassification:
        """Label a claim from retrieved passages."""


class OpenAIEvidenceModel:
    """Chat and embedding calls. Constructed only when an API key is set."""

    def __init__(self, api_key: str, chat_model: str, embedding_model: str) -> None:
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key, timeout=60.0)
        self._chat_model = chat_model
        self._embedding_model = embedding_model

    def embed(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        from openai import APIError

        try:
            response = self._client.embeddings.create(model=self._embedding_model, input=texts)
        except APIError as exc:
            raise PipelineError("The embedding request failed.") from exc
        ordered = sorted(response.data, key=lambda item: item.index)
        vectors = [list(item.embedding) for item in ordered]
        if len(vectors) != len(texts):
            raise PipelineError("The embedding response did not include every input.")
        return vectors

    def extract_claims(self, text: str) -> list[ExtractedClaim]:
        parsed = self._parse(
            [
                {"role": "system", "content": _EXTRACT_INSTRUCTIONS},
                {"role": "user", "content": text},
            ],
            ClaimExtraction,
            "The model did not return a claim list.",
        )
        return parsed.claims

    def classify(self, claim: str, passages: list[ScoredChunk]) -> PassageClassification:
        if not passages:
            raise PipelineUnavailable("Classification needs retrieved passages and will not invent a label.")
        return self._parse(
            [
                {"role": "system", "content": _CLASSIFY_INSTRUCTIONS},
                {"role": "user", "content": _classification_prompt(claim, passages)},
            ],
            PassageClassification,
            "The model did not return an evidence label.",
        )

    def _parse(self, messages: list[dict[str, str]], response_format: type[BaseModel], empty_message: str):
        from openai import APIError

        try:
            completion = self._client.chat.completions.parse(
                model=self._chat_model,
                messages=messages,
                response_format=response_format,
                temperature=0,
            )
        except APIError as exc:
            raise PipelineError("The model request failed.") from exc
        parsed = completion.choices[0].message.parsed
        if parsed is None:
            raise PipelineError(empty_message)
        return parsed


class EvidencePipeline:
    """Retrieve demo passages, ask the model for a label, then rank with the formula."""

    def __init__(self, model: EvidenceModel, index: EvidenceIndex, *, top_k: int, min_score: float) -> None:
        self._model = model
        self._index = index
        self._top_k = top_k
        self._min_score = min_score

    def transcribe_video(self, video_url: str) -> str:
        """Video ranking uses the caption. This phase does not download video_url."""

        raise PipelineUnavailable(
            "Video ranking uses the post caption. "
            f"Transcription is not part of this phase ({video_url})."
        )

    def extract_claims(self, text: str) -> list[str]:
        return [claim.text.strip() for claim in self._model.extract_claims(text) if claim.checkable and claim.text.strip()]

    def retrieve_evidence(self, claim: str) -> list[str]:
        seen: list[str] = []
        for hit in self._retrieve(claim):
            if hit.chunk.source_id not in seen:
                seen.append(hit.chunk.source_id)
        return seen

    def classify_claim(self, claim: str, source_ids: list[str]) -> str:
        passages = self._index.passages_for(source_ids)
        if not passages:
            raise PipelineUnavailable("classify_claim needs retrieved passages and will not invent a label.")
        return self._model.classify(claim, passages).evidence_status

    def generate_explanation(self, claim: str, evidence_status: str, source_ids: list[str]) -> str:
        passages = self._index.passages_for(source_ids)
        if not passages:
            raise PipelineUnavailable("generate_explanation needs retrieved passages and will not invent text.")
        classification = self._model.classify(claim, passages)
        if classification.evidence_status != evidence_status or not classification.explanation.strip():
            raise PipelineUnavailable("The model did not return an explanation for that evidence label.")
        return classification.explanation.strip()

    def rank_feed(self, posts: list[Post]) -> tuple[list[RankedPost], list[EvidenceExplanation]]:
        labeled: list[Post] = []
        explanations: dict[str, EvidenceExplanation] = {}
        for post in posts:
            updated, explanation = self._label_post(post)
            labeled.append(updated)
            explanations[post.id] = explanation
        ranked = rank_posts(labeled, "evidence")
        return ranked, [explanations[post.id] for post in ranked]

    def _label_post(self, post: Post) -> tuple[Post, EvidenceExplanation]:
        extracted = self._model.extract_claims(post.content)
        checkable = [claim for claim in extracted if claim.checkable and claim.text.strip()]
        if not checkable:
            text = next((claim.text.strip() for claim in extracted if claim.text.strip()), post.content)
            return self._pack(
                post,
                claim_text=text,
                status="not_checkable",
                explanation="The post did not contain a checkable factual claim, so it keeps its engagement score.",
                sources=[],
            )

        main = checkable[0]
        hits = self._retrieve(main.text)
        if not hits:
            return self._pack(
                post,
                claim_text=main.text.strip(),
                status="unresolved",
                explanation="No passage in the demo corpus matched this claim closely enough to classify it.",
                sources=[],
            )

        classification = self._model.classify(main.text, hits)
        retrieved_ids = {hit.chunk.source_id for hit in hits}
        cited_ids: list[str] = []
        for source_id in classification.source_ids:
            if source_id in retrieved_ids and source_id not in cited_ids:
                cited_ids.append(source_id)
        status = classification.evidence_status
        explanation = classification.explanation.strip()
        if status in _GROUNDED_STATUSES and (not cited_ids or not explanation):
            return self._pack(
                post,
                claim_text=main.text.strip(),
                status="unresolved",
                explanation="The model did not cite a retrieved source, so the claim stays unresolved.",
                sources=[],
            )
        if not explanation:
            explanation = "The model left this claim unresolved."
            status = "unresolved"
            cited_ids = []

        chunks_by_id = {hit.chunk.source_id: hit.chunk for hit in hits}
        sources = [
            EvidenceSource(
                id=source_id,
                title=chunks_by_id[source_id].title,
                url=chunks_by_id[source_id].url,
                publisher=chunks_by_id[source_id].publisher,
            )
            for source_id in cited_ids
        ]
        return self._pack(post, claim_text=main.text.strip(), status=status, explanation=explanation, sources=sources)

    def _retrieve(self, claim: str) -> list[ScoredChunk]:
        vectors = self._model.embed([claim])
        if len(vectors) != 1:
            raise PipelineError("The embedding response did not include the claim.")
        return self._index.search(vectors[0], k=self._top_k, min_score=self._min_score)

    def _pack(
        self,
        post: Post,
        *,
        claim_text: str,
        status: EvidenceStatus,
        explanation: str,
        sources: list[EvidenceSource],
    ) -> tuple[Post, EvidenceExplanation]:
        updated = post.model_copy(update={"evidence_status": status, "review_status": "approved"})
        explanation_body = EvidenceExplanation(
            post_id=post.id,
            data_origin="model",
            disclaimer=MODEL_DISCLAIMER,
            claims=[
                Claim(
                    id=f"{post.id}-model",
                    text=claim_text,
                    evidence_status=status,
                    review_status="approved",
                    explanation=explanation,
                    sources=sources,
                )
            ],
        )
        return updated, explanation_body


def default_pipeline() -> EvidencePipeline:
    if not settings.openai_api_key:
        raise PipelineNotConfigured("OPENAI_API_KEY is not set.")
    model = OpenAIEvidenceModel(
        api_key=settings.openai_api_key,
        chat_model=settings.openai_chat_model,
        embedding_model=settings.openai_embedding_model,
    )
    return EvidencePipeline(
        model,
        cached_index(model),
        top_k=settings.rag_top_k,
        min_score=settings.rag_min_score,
    )


def _classification_prompt(claim: str, passages: list[ScoredChunk]) -> str:
    blocks = []
    for hit in passages:
        chunk = hit.chunk
        blocks.append(f"Source id: {chunk.source_id}\nTitle: {chunk.title}\nPassage:\n{chunk.text[:2000]}")
    return f"Claim:\n{claim}\n\nRetrieved passages:\n\n" + "\n\n".join(blocks)
