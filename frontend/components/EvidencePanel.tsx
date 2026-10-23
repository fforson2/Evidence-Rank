"use client";

import { useEffect, useState } from "react";
import { ApiError, getEvidence, type DataSource } from "@/lib/api";
import { evidenceBadgeClass, EVIDENCE_STATUS_LABELS, REVIEW_STATUS_LABELS } from "@/lib/labels";
import type { EvidenceExplanation, FeedMode, RankedPost } from "@/types";

type EvidencePanelProps = {
  post: RankedPost;
  feedMode: FeedMode;
  explanation?: EvidenceExplanation | null;
  onClose: () => void;
};

function adjustmentSummary(post: RankedPost, feedMode: FeedMode): string {
  if (feedMode === "engagement") {
    return "This feed ranks by engagement only, so the evidence label did not change the score.";
  }
  if (post.evidence_adjustment < 0) {
    return "An approved review recorded a negative evidence finding, so the engagement score was reduced.";
  }
  if (post.evidence_adjustment > 0) {
    return "An approved review found the post's evidence label supported, so the engagement score was increased.";
  }
  return "Unresolved claims, opinions, and posts without an approved review keep their engagement score.";
}

export function EvidencePanel({ post, feedMode, explanation = null, onClose }: EvidencePanelProps) {
  const [evidence, setEvidence] = useState<EvidenceExplanation | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (explanation) {
      setEvidence(explanation);
      setSource(explanation.data_origin === "model" ? "model" : "api");
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    getEvidence(post.id, controller.signal)
      .then((result) => {
        setEvidence(result.evidence);
        setSource(result.source);
        setError(null);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        const message = caught instanceof ApiError ? caught.message : "The evidence explanation could not be loaded.";
        setError(message);
        setEvidence(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [attempt, explanation, post.id]);

  return (
    <section className="border-t border-line bg-background/70 px-4 py-4" aria-label="Evidence explanation">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold">Why this ranking</h3>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Close
        </button>
      </div>
      <p className="mt-2 text-sm leading-6 text-foreground">{adjustmentSummary(post, feedMode)}</p>
      <p className="mt-1 text-xs text-muted">
        Rank {post.rank} uses the post-level label. Individual claims below can differ.
      </p>

      {loading ? (
        <div className="mt-4 space-y-2" aria-live="polite">
          <p className="text-sm text-muted">Loading evidence…</p>
          <div className="h-16 rounded-xl bg-foreground/5 motion-safe:animate-pulse" />
        </div>
      ) : null}

      {!loading && error ? (
        <div role="alert" className="mt-4 rounded-xl border border-danger/20 px-3 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              setAttempt((current) => current + 1);
            }}
            className="mt-2 text-sm font-medium text-accent underline-offset-2 hover:underline"
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loading && evidence ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-5 text-muted">{evidence.disclaimer}</p>
          {source === "demo" ? (
            <p className="text-xs text-muted">Loaded from local fixtures because the API was unreachable.</p>
          ) : null}
          {source === "model" ? (
            <p className="text-xs text-muted">Labeled by gpt-4o-mini from passages in the public pages.</p>
          ) : null}
          {evidence.claims.map((claim) => (
            <article key={claim.id} className="rounded-xl border border-line bg-card px-3 py-3">
              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${evidenceBadgeClass(claim.evidence_status)}`}
                >
                  {EVIDENCE_STATUS_LABELS[claim.evidence_status]}
                </span>
                <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-xs text-muted">
                  {REVIEW_STATUS_LABELS[claim.review_status]}
                </span>
              </div>
              <p className="mt-2 text-sm font-medium leading-6">{claim.text}</p>
              <p className="mt-1 text-sm leading-6 text-muted">{claim.explanation}</p>
              {claim.sources.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {claim.sources.map((sourceItem) => (
                    <li key={sourceItem.id}>
                      <a
                        href={sourceItem.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-accent underline-offset-2 hover:underline"
                      >
                        {sourceItem.title}
                      </a>
                      <p className="text-xs text-muted">{sourceItem.publisher}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted">
                  {evidence.data_origin === "model"
                    ? "No retrieved source was cited for this claim."
                    : "No source is attached to this demo claim."}
                </p>
              )}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
