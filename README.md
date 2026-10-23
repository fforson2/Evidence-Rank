# EvidenceRank

EvidenceRank is a research prototype for an evidence-aware social feed. It compares two ways of ordering the same short posts:

- **Engagement** ranks by likes and shares.
- **EvidenceRank** starts from that engagement score and then applies a reviewed evidence adjustment.

The adjustment can lower a post only when an approved review recorded a negative finding (`contradicted`, `source_mismatch`, or `missing_context`). Supported posts can receive a small boost. Unresolved claims, opinions, and posts that have not been reviewed keep their engagement score.

The live feed extracts claims from allowlisted United States government pages and counts likes and shares in this app. EvidenceRank retrieves passages from those pages and asks gpt-4o-mini for a label, then applies the ranking formula. Both steps need `OPENAI_API_KEY` on the backend. There is no login.

The Example County fixtures remain in the repository for tests. They are not what the API serves.

## Repository layout

```text
frontend/     Next.js app (App Router, TypeScript, Tailwind)
backend/      FastAPI app
supabase/     SQL migration for a later database step
docs/         API contract shared by both apps
```

The apps are independent. The frontend falls back to local fixtures when the API is unreachable. The backend serves its own fixtures and does not read from the frontend.

## Prerequisites

- Node.js 20.9 or newer
- Python 3.11 or newer

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000.

The API base URL defaults to `http://localhost:8000`. To point elsewhere, copy the example env file and edit it:

```bash
cp .env.example .env.local
```

```text
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`NEXT_PUBLIC_` values are included in the browser bundle. Do not put secrets in them. The Supabase service-role key and the OpenAI key stay on the backend.

## Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

The API listens on http://localhost:8000. Interactive docs are at http://localhost:8000/docs.

Copy `backend/.env.example` to `backend/.env` only when you need to override CORS origins or store credentials for a later milestone. The demo starts with no `.env` file.

### Tests

From `backend`, with the virtual environment active:

```bash
pytest
```

## API

The contract, including example JSON and the ranking formula, is in [docs/api-contract.md](docs/api-contract.md).

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET` | `/posts` | Live claims, unranked |
| `GET` | `/feed?mode=engagement` | Engagement ranking |
| `GET` | `/feed?mode=evidence` | Evidence ranking of the stored labels |
| `GET` | `/posts/{post_id}/evidence` | Explanation for one claim |
| `POST` | `/events` | Record a like, share, evidence open, or mode change. A like can send `metadata.delta` of `-1`. |
| `POST` | `/analysis/rank` | Retrieve the public pages, label claims with gpt-4o-mini, then rank with the evidence formula |

## Supabase

`supabase/migrations/20261022000000_initial_schema.sql` creates `posts`, `claims`, `evidence_sources`, `claim_evidence`, `interaction_events`, and `experiment_assignments`. Row-level security is enabled and no browser policies are granted. The backend service role is the intended database client later.

Applying the migration is optional. Nothing in the local demo connects to Supabase. The model rank route keeps its embeddings in memory. `pgvector` is enabled in the migration for a later database-backed index. Embedding columns are not created yet.

## Evidence pipeline

`GET /posts` and `GET /feed` return claims extracted from the allowlisted pages in `backend/app/data/web_sources.py` and mark them `data_origin: "live"`. Likes and shares are stored in `backend/data/live_counts.json`, which is not committed.

`POST /analysis/rank` runs the model pipeline in `backend/app/services/ai.py`. It embeds those pages, retrieves the nearest passages, and asks gpt-4o-mini to label the main checkable claim. The score is still `engagement_score * (1 + evidence_adjustment)`. Labels are `data_origin: "model"`. A claim with no retrieved passage, or a label that cites no retrieved source, stays `unresolved` and keeps its engagement score.

## Deployment notes

- **Frontend:** Vercel, with the project root set to `frontend`. Set `NEXT_PUBLIC_API_URL` to the backend origin.
- **Backend:** Render, with the root set to `backend`. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
- Add the deployed frontend origin to the backend `CORS_ORIGINS` value.

Authentication, background jobs, and the experiment assignment flow are not built. The model rank route does not require a login.

## Contributing

Work on `main` through pull requests. Do not push directly to `main`.

Branch names:

```text
frontend/feature-name
backend/feature-name
```

Before opening a pull request:

1. Branch from the latest `main`.
2. Keep the frontend and backend runnable on their own.
3. If you change a request or response shape, update `docs/api-contract.md`, the Pydantic schema, and `frontend/types/index.ts` together.
4. If you change ranking weights, update both ranking modules, the contract, and the backend tests.
5. Keep demo labels labeled as demo data. Do not present fixture classifications as live fact-checks.
