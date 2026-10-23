from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analysis, events, evidence, feed, posts
from app.schemas.feed import HealthResponse

app = FastAPI(
    title="EvidenceRank API",
    version="0.1.0",
    summary="Demo API for the EvidenceRank research prototype.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origin_list(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(posts.router)
app.include_router(feed.router)
app.include_router(evidence.router)
app.include_router(events.router)
app.include_router(analysis.router)


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health() -> HealthResponse:
    return HealthResponse(status="ok")
