import type { FeedMode, Post, RankedPost } from "@/types";

/**
 * EvidenceRank adds a bonus or subtracts a reviewed penalty from the engagement score.
 * Engagement mode uses the engagement score alone.
 * Unverified claims, opinions, and posts that have not been reviewed stay unchanged.
 */
export const LIKE_WEIGHT = 1;
export const SHARE_WEIGHT = 2.5;
export const EVIDENCE_BONUS = 25;
export const CONTRADICTED_PENALTY = 50;
export const SOURCE_MISMATCH_PENALTY = 25;
export const MISSING_CONTEXT_PENALTY = 10;

function roundScore(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function evidenceTerms(post: Post): { bonus: number; penalty: number } {
  if (post.review_status !== "approved") {
    return { bonus: 0, penalty: 0 };
  }

  switch (post.evidence_status) {
    case "supported":
      return { bonus: EVIDENCE_BONUS, penalty: 0 };
    case "contradicted":
      return { bonus: 0, penalty: CONTRADICTED_PENALTY };
    case "source_mismatch":
      return { bonus: 0, penalty: SOURCE_MISMATCH_PENALTY };
    case "missing_context":
      return { bonus: 0, penalty: MISSING_CONTEXT_PENALTY };
    case "unresolved":
    case "not_checkable":
      return { bonus: 0, penalty: 0 };
    default: {
      const unreachable: never = post.evidence_status;
      return unreachable;
    }
  }
}

export function rankPosts(posts: Post[], mode: FeedMode): RankedPost[] {
  const scored = posts.map((post) => {
    const engagementScore = roundScore(post.likes * LIKE_WEIGHT + post.shares * SHARE_WEIGHT);
    const terms = mode === "evidence" ? evidenceTerms(post) : { bonus: 0, penalty: 0 };
    return {
      ...post,
      engagement_score: engagementScore,
      evidence_adjustment: terms.bonus - terms.penalty,
      score: roundScore(engagementScore + terms.bonus - terms.penalty),
      rank: 0,
    };
  });

  scored.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));

  return scored.map((post, index) => ({ ...post, rank: index + 1 }));
}
