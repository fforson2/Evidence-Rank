# EvidenceRank API contract

Frontend and backend share this contract. If a field changes, update this document, the Pydantic models in `backend/app/schemas/`, and the TypeScript interfaces in `frontend/types/index.ts` in the same pull request.

The running demo serves **fixture data**. Responses include `data_origin: "demo"`. Those labels are not live fact-checks and are not model output.

Base URL in local development: `http://localhost:8000`

## Evidence statuses

| Value | Meaning |
| --- | --- |
| `supported` | An approved review found sources that support the post's main claim. |
| `missing_context` | An approved review found the post leaves out context that changes the meaning. |
| `source_mismatch` | An approved review found the cited material is about something else. |
| `contradicted` | An approved review found sources that contradict the post's main claim. |
| `unresolved` | A checkable claim does not yet have a matching source. |
| `not_checkable` | Opinion or other content that is not a factual claim. |

`review_status` is `pending` or `approved`.

## Ranking

Weights are configuration constants in `backend/app/services/ranking.py` (mirrored for the offline frontend fallback in `frontend/lib/ranking.ts`).

| Constant | Value |
| --- | --- |
| `like_weight` | 1 |
| `share_weight` | 2.5 |
| `supported_boost` | +0.20 |
| `missing_context_penalty` | −0.10 |
| `source_mismatch_penalty` | −0.25 |
| `contradicted_penalty` | −0.35 |

```text
engagement_score = likes * like_weight + shares * share_weight
evidence_adjustment = 0 in engagement mode, otherwise the matching constant above
score = engagement_score * (1 + evidence_adjustment)
```

`evidence_adjustment` is a fraction. `-0.35` means the engagement score is reduced by 35 percent.

Sort by `score` descending, then `id` ascending. `rank` starts at 1.

The evidence adjustment is based on the **post-level** `evidence_status` and `review_status`. Claim rows in the explanation can differ from that label. The v1 ranker does not aggregate claims.

A negative adjustment is applied only when `review_status` is `approved` and the label is `contradicted`, `source_mismatch`, or `missing_context`. An approved `supported` post receives the boost. `unresolved`, `not_checkable`, and any post that is still `pending` stay at the engagement score. Missing or unfinished evidence is not an automatic penalty.

Demo order with the fixture posts:

| Rank | Engagement feed | EvidenceRank feed |
| --- | --- | --- |
| 1 | `post-001` | `post-002` |
| 2 | `post-007` | `post-007` |
| 3 | `post-002` | `post-001` |
| 4 | `post-004` | `post-003` |
| 5 | `post-003` | `post-004` |
| 6 | `post-005` | `post-005` |
| 7 | `post-006` | `post-006` |

## Errors

Application errors:

```json
{
  "detail": {
    "error": "not_found",
    "message": "Post not found"
  }
}
```

Request validation errors use FastAPI's 422 shape:

```json
{
  "detail": [
    {
      "type": "missing",
      "loc": ["query", "mode"],
      "msg": "Field required",
      "input": null
    }
  ]
}
```

## `GET /health`

```json
{ "status": "ok" }
```

## `GET /posts`

Returns the fixture posts in stored order. This route does not rank them.

```json
{
  "data_origin": "demo",
  "disclaimer": "Demo data. These posts and evidence labels are fixtures for local development. They are not live fact-checks and were not produced by a model.",
  "posts": [
    {
      "id": "post-001",
      "type": "text",
      "author": "Maya Chen",
      "content": "In the Example County demo election, the clerk counted every mail ballot that arrived after 8 p.m.",
      "video_url": null,
      "likes": 500,
      "shares": 40,
      "evidence_status": "contradicted",
      "review_status": "approved"
    }
  ]
}
```

`type` is `text` or `video`. Video posts include an `https` `video_url`. Text posts send `video_url: null`.

## `GET /feed?mode=engagement`

`mode` is required and is either `engagement` or `evidence`.

```json
{
  "mode": "engagement",
  "data_origin": "demo",
  "disclaimer": "Demo data. These posts and evidence labels are fixtures for local development. They are not live fact-checks and were not produced by a model.",
  "posts": [
    {
      "id": "post-001",
      "type": "text",
      "author": "Maya Chen",
      "content": "In the Example County demo election, the clerk counted every mail ballot that arrived after 8 p.m.",
      "video_url": null,
      "likes": 500,
      "shares": 40,
      "evidence_status": "contradicted",
      "review_status": "approved",
      "rank": 1,
      "engagement_score": 600,
      "evidence_adjustment": 0,
      "score": 600
    }
  ]
}
```

`GET /feed?mode=evidence` uses the same post fields. The first fixture in that mode is `post-002` with `engagement_score` 495, `evidence_adjustment` 0.2, and `score` 594.

## `GET /posts/{post_id}/evidence`

```json
{
  "post_id": "post-001",
  "data_origin": "demo",
  "disclaimer": "Demo data. These posts and evidence labels are fixtures for local development. They are not live fact-checks and were not produced by a model.",
  "claims": [
    {
      "id": "claim-001a",
      "text": "The Example County demo clerk counted every mail ballot that arrived after 8 p.m.",
      "evidence_status": "contradicted",
      "review_status": "approved",
      "explanation": "The demo election handbook says mail ballots had to arrive by 8 p.m. on election day to be counted. This fixture marks the claim contradicted.",
      "sources": [
        {
          "id": "source-handbook",
          "title": "Example County Election Handbook (demo)",
          "url": "https://example.com/demo/example-county/election-handbook",
          "publisher": "Example County Elections Office (demo)"
        }
      ]
    }
  ]
}
```

Unknown posts return 404 with the application error shape. `sources` may be an empty array.

## `POST /events`

Records an interaction. In this milestone the event is stored in memory and does not change a post's like or share count.

```json
{
  "post_id": "post-002",
  "event_type": "like",
  "feed_mode": "evidence",
  "metadata": {}
}
```

`post_id` may be omitted for `feed_mode_change`. `event_type` is one of `view`, `like`, `share`, `evidence_open`, or `feed_mode_change`.

`201` response:

```json
{
  "id": "6f1c2c4e-1b2a-4f5e-9c0d-2a7b6e5d4c3a",
  "post_id": "post-002",
  "event_type": "like",
  "feed_mode": "evidence",
  "metadata": {},
  "created_at": "2026-10-23T05:00:00.000000Z"
}
```

An unknown `post_id` returns 404. A body that fails validation returns 422.
