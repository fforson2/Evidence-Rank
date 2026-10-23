from fastapi import APIRouter

from app.errors import http_error
from app.models.store import store
from app.schemas.analysis import ModelRankResponse
from app.schemas.common import MODEL_DISCLAIMER
from app.services.ai import PipelineError, PipelineNotConfigured, PipelineUnavailable, default_pipeline
from app.services.live_feed import LiveFeedUnavailable

router = APIRouter(tags=["analysis"])


@router.post("/analysis/rank", response_model=ModelRankResponse)
def rank_with_model() -> ModelRankResponse:
    """Label live claims with retrieval plus gpt-4o-mini, then apply the evidence formula.

    No login. The OpenAI key stays on the server.
    """

    try:
        pipeline = default_pipeline()
        ranked, explanations = pipeline.rank_feed(store.list_posts())
        store.apply_labels(ranked, explanations)
    except (PipelineNotConfigured, LiveFeedUnavailable) as exc:
        raise http_error(503, "not_configured", str(exc)) from exc
    except (PipelineUnavailable, PipelineError) as exc:
        raise http_error(502, "model_error", str(exc)) from exc
    return ModelRankResponse(
        mode="evidence",
        data_origin="model",
        disclaimer=MODEL_DISCLAIMER,
        posts=ranked,
        explanations=explanations,
    )
