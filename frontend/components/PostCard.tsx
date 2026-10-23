"use client";

import { useState } from "react";
import { EvidencePanel } from "@/components/EvidencePanel";
import { EvidenceScoreButton } from "@/components/EvidenceScoreButton";
import { TextPost } from "@/components/TextPost";
import { VideoPost } from "@/components/VideoPost";
import { recordEvent } from "@/lib/api";
import {
  evidenceBadgeClass,
  EVIDENCE_STATUS_LABELS,
  formatScore,
  REVIEW_STATUS_LABELS,
} from "@/lib/labels";
import { evidenceTerms } from "@/lib/ranking";
import type { EvidenceExplanation, FeedMode, RankedPost } from "@/types";

type PostCardProps = {
  post: RankedPost;
  feedMode: FeedMode;
  explanation?: EvidenceExplanation | null;
  liked: boolean;
  onLike: () => void;
  onShare: () => void;
  shareNotice: string | null;
};

export function PostCard({ post, feedMode, explanation = null, liked, onLike, onShare, shareNotice }: PostCardProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const evidenceRank = feedMode === "evidence";
  const terms = evidenceTerms(post);

  function toggleEvidence() {
    const next = !evidenceOpen;
    setEvidenceOpen(next);
    if (next) {
      void recordEvent({
        post_id: post.id,
        event_type: "evidence_open",
        feed_mode: feedMode,
      });
    }
  }

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-card shadow-[0_1px_2px_rgba(28,36,48,0.04)] ${
        evidenceRank ? "border-accent/30" : "border-copper/30"
      }`}
    >
      <div className={`h-1 ${evidenceRank ? "bg-accent" : "bg-copper"}`} />
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <div className="flex min-w-[10rem] flex-1 items-center gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${
              evidenceRank ? "bg-accent" : "bg-copper"
            }`}
          >
            {post.rank}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{post.author}</p>
            <p className="truncate text-xs text-muted">
              {evidenceRank ? "EvidenceRank" : "Engagement rank"} · {post.type === "video" ? "Video" : "Text"}
            </p>
          </div>
        </div>
        {evidenceRank ? (
          <EvidenceScoreButton strength={post.evidence_strength} description={`${post.author}: ${post.content}`} />
        ) : (
          <p className="text-right">
            <span className="block text-lg font-semibold tabular-nums text-copper">{formatScore(post.score)}</span>
            <span className="block text-[11px] text-muted">Likes and shares</span>
          </p>
        )}
      </div>

      <div className="px-4 py-3">
        {post.type === "video" && post.video_url ? (
          <VideoPost src={post.video_url} caption={post.content} />
        ) : (
          <TextPost content={post.content} imageUrl={post.image_url} imageCredit={post.image_credit} />
        )}
      </div>

      {evidenceRank ? (
        <div className="flex flex-wrap items-center gap-2 px-4">
          <span className="text-[11px] font-medium tracking-wide text-muted uppercase">Review label</span>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${evidenceBadgeClass(post.evidence_status)}`}>
            {EVIDENCE_STATUS_LABELS[post.evidence_status]}
          </span>
          <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-muted">
            {REVIEW_STATUS_LABELS[post.review_status]}
          </span>
        </div>
      ) : null}

      {evidenceRank ? (
        <dl className="mx-4 mt-3 grid grid-cols-4 gap-2 rounded-xl bg-accent/5 px-3 py-2 text-center">
          <div>
            <dt className="text-[10px] tracking-wide text-muted uppercase">Engagement</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatScore(post.engagement_score)}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-wide text-muted uppercase">Bonus</dt>
            <dd className="text-sm font-semibold tabular-nums text-accent-strong">+{terms.bonus}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-wide text-muted uppercase">Penalty</dt>
            <dd className="text-sm font-semibold tabular-nums text-danger">−{terms.penalty}</dd>
          </div>
          <div>
            <dt className="text-[10px] tracking-wide text-muted uppercase">Final</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatScore(post.score)}</dd>
          </div>
        </dl>
      ) : (
        <p className="px-4 pt-3 text-xs text-muted">
          {post.likes} likes · {post.shares} shares · engagement score {formatScore(post.score)}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
        <button
          type="button"
          aria-pressed={liked}
          onClick={onLike}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            liked
              ? evidenceRank
                ? "border-accent bg-accent/10 text-accent-strong"
                : "border-copper bg-copper/10 text-copper"
              : "border-line text-foreground hover:bg-foreground/5"
          }`}
        >
          {liked ? "Liked" : "Like"} · {post.likes}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="rounded-full border border-line px-3 py-1.5 text-sm font-medium hover:bg-foreground/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Share · {post.shares}
        </button>
        {shareNotice ? <span className="text-xs text-muted">{shareNotice}</span> : null}
      </div>

      {evidenceRank ? (
        <div className="px-4 py-3">
          <button
            type="button"
            aria-expanded={evidenceOpen}
            onClick={toggleEvidence}
            className="text-left text-sm font-medium text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Why did this post&apos;s ranking change?
          </button>
        </div>
      ) : (
        <div className="h-3" />
      )}

      {evidenceRank && evidenceOpen ? (
        <EvidencePanel post={post} feedMode={feedMode} explanation={explanation} onClose={() => setEvidenceOpen(false)} />
      ) : null}
    </article>
  );
}
