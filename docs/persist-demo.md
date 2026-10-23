# Persist the demo

`POST /analysis/rank` already labels posts with OpenAI and the demo corpus. That route does not need logins or this migration. This document is the storage step that comes after it.

Replace the in-memory `DemoStore` with Supabase. The API keeps the same routes, JSON shapes, ranking, and `data_origin: "demo"` labels. Fixture rows live in Postgres. `POST /events` is written to `interaction_events` and survives a process restart.

Experiment assignment, authentication, and background jobs stay out of this change. The model rank route already has its own in-memory index.

## Done when

- `GET /posts`, `GET /feed`, and `GET /posts/{post_id}/evidence` read from Supabase and still match `docs/api-contract.md`.
- Feed order is unchanged: engagement `post-001` … `post-006`, evidence `post-002`, `post-007`, `post-001`, `post-003`, `post-004`, `post-005`, `post-006`.
- `POST /events` inserts a row. A later request in a new process can still see that the row exists. Like and share counts on the post stay as seeded.
- Unknown `post_id` still returns 404 with `{ "error": "not_found", "message": "Post not found" }`.
- Every list and evidence response still sends `data_origin: "demo"` and `DEMO_DISCLAIMER`.
- `pytest` passes without a live Supabase project, and one manual check passes against a real project.

## Current code

| Piece | Role today |
| --- | --- |
| `backend/app/models/store.py` | `DemoStore`: copies `POSTS`, looks up demo evidence, appends events in a list |
| `backend/app/data/fixtures.py` | Seven posts, eight claims, four sources |
| `backend/app/services/ranking.py` | Unchanged. It already ranks `list[Post]` |
| `backend/app/services/evidence.py` | Returns the fixture explanation. Ranking does not read claims |
| `backend/app/routers/posts.py`, `feed.py`, `evidence.py`, `events.py` | Call `store` only |
| `backend/app/config.py` | `supabase_url` and `supabase_service_role_key` exist and default to empty |
| `supabase/migrations/20261022000000_initial_schema.sql` | Tables exist. The app does not apply or query them |

Routers should keep calling a store. Ranking stays a pure function over posts the store returns.

## Schema mapping

Apply `supabase/migrations/20261022000000_initial_schema.sql` as-is. Leave `experiment_assignments` empty. Leave embedding columns for the retrieval milestone.

| API field | Table column |
| --- | --- |
| `Post.id` | `posts.id` |
| `Post.type` | `posts.type` |
| `Post.author` | `posts.author` |
| `Post.content` | `posts.content` |
| `Post.video_url` | `posts.video_url` |
| `Post.likes` | `posts.likes` |
| `Post.shares` | `posts.shares` |
| `Post.evidence_status` | `posts.evidence_status` |
| `Post.review_status` | `posts.review_status` |
| `Claim.id` | `claims.id` |
| `Claim.text` | `claims.claim_text` |
| `Claim.evidence_status` | `claims.evidence_status` |
| `Claim.review_status` | `claims.review_status` |
| `Claim.explanation` | `claims.explanation` |
| `Claim.sources` | `claim_evidence` joined to `evidence_sources` |
| `EvidenceSource.*` | `evidence_sources.id`, `title`, `url`, `publisher` |
| `InteractionEvent.id` | `interaction_events.id` (uuid from the database) |
| `InteractionEvent.post_id` | `interaction_events.post_id` (`null` for `feed_mode_change`) |
| `InteractionEvent.event_type` | `interaction_events.event_type` |
| `InteractionEvent.feed_mode` | `interaction_events.feed_mode` |
| `InteractionEvent.metadata` | `interaction_events.metadata` |
| `InteractionEvent.created_at` | `interaction_events.created_at` |

`data_origin` and `disclaimer` stay application constants in `backend/app/schemas/common.py`. They are not columns.

`GET /posts` returns posts in stored order. After seeding, that order is `post-001` through `post-007`. Select with `order=id.asc` so the order does not depend on insert timing.

`GET /posts/{post_id}/evidence` returns one explanation. `post-001` has two claims (`claim-001a`, `claim-001b`) that both point at `source-handbook`. Claim status can differ from the post status. The ranker keeps using the post row only.

## Seed

Add `supabase/seed.sql` that inserts the rows already defined in `backend/app/data/fixtures.py`.

Sources:

- `source-handbook`
- `source-turnout`
- `source-2012`
- `source-canvass`

Posts: `post-001` through `post-007`, including the video URL on `post-002` and `video_url` null on text posts.

Claims: `claim-001a`, `claim-001b`, `claim-002`, `claim-003`, `claim-004`, `claim-005`, `claim-006`, `claim-007`.

`claim_evidence` links:

| Claim | Source |
| --- | --- |
| `claim-001a` | `source-handbook` |
| `claim-001b` | `source-handbook` |
| `claim-002` | `source-turnout` |
| `claim-004` | `source-2012` |
| `claim-005` | `source-canvass` |

`claim-003`, `claim-006`, and `claim-007` have no source rows. Their `sources` arrays stay empty.

Use `insert ... on conflict do nothing` so re-running the seed is safe. Copy text from the fixtures. Do not paraphrase the demo explanations.

## Client

Use the Supabase service-role key from the backend only. Row-level security is enabled and no browser policies exist, so the anon key cannot read these tables.

1. Add `supabase` to `backend/requirements.txt`.
2. Read `settings.supabase_url` and `settings.supabase_service_role_key` from `backend/.env` (already listed in `backend/.env.example`).
3. Build one client in a small module, for example `backend/app/db.py`.
4. Fail startup with a clear error when either value is empty and the app is configured to use Supabase.

Keep `DemoStore` for tests. Add a second store class with the same methods:

- `list_posts() -> list[Post]`
- `get_post(post_id: str) -> Post | None`
- `get_evidence(post_id: str) -> EvidenceExplanation | None`
- `add_event(payload: InteractionEventCreate) -> InteractionEvent`

`get_evidence` returns `None` when the post row is missing, which the evidence router already turns into 404. Load claims and sources in one query (embed `evidence_sources` through `claim_evidence`) and map them into `Claim` and `EvidenceSource`. Attach `data_origin="demo"` and `DEMO_DISCLAIMER` in Python.

`add_event` checks `get_post` before insert when `post_id` is set, matching `backend/app/routers/events.py`. Insert the row and return the database `id` and `created_at`. Do not update `posts.likes` or `posts.shares`. The contract says an event does not change those counts in this milestone.

Select the store from settings: Supabase when both credentials are set, `DemoStore` otherwise. Tests keep calling `DemoStore` and `store.clear_events()` with no network.

## Tests

Existing tests in `backend/tests/test_api.py` and `backend/tests/test_ranking.py` stay on `DemoStore`. They must still pass with an empty `.env`.

Add store tests that fake the Supabase client (or a thin query wrapper) and assert:

- A post row maps onto `Post`, including `video_url: null` for text.
- `post-001` evidence returns both claims and the shared handbook source.
- A claim with no `claim_evidence` rows returns `sources: []`.
- A missing post returns `None` from `get_post` and `get_evidence`.
- `add_event` sends `post_id`, `event_type`, `feed_mode`, and `metadata`, and maps the returned uuid and timestamp onto `InteractionEvent`.
- `feed_mode_change` inserts `post_id` null.

Manual check against a real project, after `supabase db reset` or an equivalent migrate-and-seed:

1. `GET /health`
2. `GET /posts` returns seven posts and `data_origin: "demo"`.
3. `GET /feed?mode=engagement` and `GET /feed?mode=evidence` match the order in `docs/api-contract.md`.
4. `GET /posts/post-001/evidence` returns `claim-001a` and `claim-001b`.
5. `POST /events` for `post-002` / `like` returns 201. Confirm the row in `interaction_events`. Restart uvicorn and confirm the row is still there and `post-002` likes are still 420.
6. `POST /events` with `post_id: "post-missing"` returns 404.

## Work order

1. Write `supabase/seed.sql` from `backend/app/data/fixtures.py`.
2. Add the Supabase client and the persistent store behind the existing method list.
3. Point the routers at the selected store.
4. Add the mapping tests. Run `pytest`.
5. Apply the migration, run the seed, and do the manual check.
6. Update `README.md` only where it still says the backend does not connect to Supabase. Say the demo reads seeded rows when credentials are set, and still serves memory fixtures when they are not.

## Leave for later

- `experiment_assignments` and locking a participant to one feed mode.
- `EvidencePipeline` in `backend/app/services/ai.py`.
- Embedding columns and retrieval.
- Changing `data_origin` when a review comes from the pipeline.
- Authentication and review-approval writes.
- Updating `likes` and `shares` from events. That would change ranking inputs and the API contract.
