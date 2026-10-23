"use client";

import { useState } from "react";
import { EvidencePanel } from "@/components/EvidencePanel";
import { TextPost } from "@/components/TextPost";
import { VideoPost } from "@/components/VideoPost";
import { recordEvent } from "@/lib/api";
import {
  evidenceBadgeClass,
  EVIDENCE_STATUS_LABELS,
  formatAdjustment,
  formatScore,
  REVIEW_STATUS_LABELS,
} from "@/lib/labels";
import type { FeedMode, RankedPost } from "@/types";

type PostCardProps = {
  post: RankedPost;
  feedMode: FeedMode;
  liked: boolean;
  onLike: () => void;
  onShare: () => void;
  shareNotice: string | null;
};

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

const AVATAR_COLORS = ["bg-accent", "bg-copper", "bg-[#315c7a]", "bg-[#5c4d7a]"];

function avatarColor(name: string): string {
  const sum = [...name].reduce((total, character) => total + character.charCodeAt(0), 0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

export function PostCard({ post, feedMode, liked, onLike, onShare, shareNotice }: PostCardProps) {
  const [evidenceOpen, setEvidenceOpen] = useState(false);

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
    <article className="overflow-hidden rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(28,36,48,0.04)]">
      <div className="flex items-center gap-3 px-4 pt-4">
        <span
          aria-hidden
          className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white ${avatarColor(post.author)}`}
        >
          {initials(post.author)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{post.author}</p>
          <p className="text-xs text-muted">
            {post.type === "video" ? "Video" : "Text"} · Rank {post.rank}
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        {post.type === "video" && post.video_url ? (
          <VideoPost src={post.video_url} caption={post.content} />
        ) : (
          <TextPost content={post.content} />
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-4">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${evidenceBadgeClass(post.evidence_status)}`}>
          {EVIDENCE_STATUS_LABELS[post.evidence_status]}
        </span>
        <span className="rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium text-muted">
          {REVIEW_STATUS_LABELS[post.review_status]}
        </span>
      </div>

      <p className="px-4 pt-3 text-xs text-muted">
        Engagement {formatScore(post.engagement_score)}
        {feedMode === "evidence"
          ? ` · Evidence adjustment ${formatAdjustment(post.evidence_adjustment)} · Score ${formatScore(post.score)}`
          : " · Evidence adjustment is off in this feed"}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 px-4">
        <button
          type="button"
          aria-pressed={liked}
          onClick={onLike}
          className={`rounded-full border px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
            liked ? "border-accent bg-accent/10 text-accent-strong" : "border-line text-foreground hover:bg-foreground/5"
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

      {evidenceOpen ? (
        <EvidencePanel post={post} feedMode={feedMode} onClose={() => setEvidenceOpen(false)} />
      ) : null}
    </article>
  );
}
