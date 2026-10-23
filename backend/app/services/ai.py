"""Placeholder interfaces for a later evidence pipeline.

The demo API does not construct or call these types. Implementations must not
invent an evidence label when a step is unavailable, and this milestone does
not call the OpenAI API.
"""


class EvidencePipeline:
    """Future pipeline. Each method is intentionally unimplemented."""

    def transcribe_video(self, video_url: str) -> str:
        """Turn a video into text that claim extraction can read."""
        raise NotImplementedError(_not_implemented("transcribe_video", video_url))

    def extract_claims(self, text: str) -> list[str]:
        """Pull checkable factual claims from a transcript or post body."""
        raise NotImplementedError(_not_implemented("extract_claims", text))

    def retrieve_evidence(self, claim: str) -> list[str]:
        """Return source identifiers relevant to a claim."""
        raise NotImplementedError(_not_implemented("retrieve_evidence", claim))

    def classify_claim(self, claim: str, source_ids: list[str]) -> str:
        """Assign one evidence status from the reviewed source set."""
        raise NotImplementedError(_not_implemented("classify_claim", claim or ",".join(source_ids)))

    def generate_explanation(self, claim: str, evidence_status: str, source_ids: list[str]) -> str:
        """Write the short explanation shown for a reviewed claim."""
        detail = f"{claim} [{evidence_status}] {','.join(source_ids)}"
        raise NotImplementedError(_not_implemented("generate_explanation", detail))


def _not_implemented(method_name: str, _detail: str) -> str:
    return (
        f"{method_name} is not implemented. The demo API serves labeled fixtures "
        "and does not call the OpenAI API."
    )
