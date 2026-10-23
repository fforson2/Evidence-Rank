import type { FeedMode, Post, RankedPost } from "@/types";

/**
 * Mirror of backend/app/services/ranking.py.
 * Used only when the API is unreachable. Connected sessions display the API scores.
 */
export const LIKE_WEIGHT = 1;
export const SHARE_WEIGHT = 2.5;
export const SUPPORTED_BOOST = 0.2;
export const MISSING_CONTEXT_PENALTY = 0.1;
export const SOURCE_MISMATCH_PENALTY = 0.25;
export const CONTRADICTED_PENALTY = 0.35;

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function evidenceAdjustment(post: Post): number {
  if (post.review_status !== "approved") {
    return 0;
  }

  switch (post.evidence_status) {
    case "supported":
      return SUPPORTED_BOOST;
    case "missing_context":
      return -MISSING_CONTEXT_PENALTY;
    case "source_mismatch":
      return -SOURCE_MISMATCH_PENALTY;
    case "contradicted":
      return -CONTRADICTED_PENALTY;
    case "unresolved":
    case "not_checkable":
      return 0;
    default: {
      const unreachable: never = post.evidence_status;
      return unreachable;
    }
  }
}

export function rankPosts(posts: Post[], mode: FeedMode): RankedPost[] {
  const scored = posts.map((post) => {
    const engagementScore = roundScore(post.likes * LIKE_WEIGHT + post.shares * SHARE_WEIGHT);
    const adjustment = mode === "evidence" ? evidenceAdjustment(post) : 0;
    return {
      ...post,
      engagement_score: engagementScore,
      evidence_adjustment: adjustment,
      score: roundScore(engagementScore * (1 + adjustment)),
      rank: 0,
    };
  });

  scored.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  return scored.map((post, index) => ({ ...post, rank: index + 1 }));
}
