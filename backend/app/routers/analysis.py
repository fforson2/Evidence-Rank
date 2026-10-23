from fastapi import APIRouter

from app.errors import http_error
from app.models.store import store
from app.schemas.analysis import ModelRankResponse
from app.schemas.common import MODEL_DISCLAIMER
from app.services.ai import PipelineError, PipelineNotConfigured, PipelineUnavailable, default_pipeline

router = APIRouter(tags=["analysis"])


@router.post("/analysis/rank", response_model=ModelRankResponse)
def rank_with_model() -> ModelRankResponse:
    """Label fixture posts with retrieval plus OpenAI, then apply the evidence formula.

    No login. The OpenAI key stays on the server. The demo feed routes do not call this.
    """

    try:
        ranked, explanations = default_pipeline().rank_feed(store.list_posts())
    except PipelineNotConfigured as exc:
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
