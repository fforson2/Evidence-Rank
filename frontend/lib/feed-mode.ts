import type { FeedMode } from "@/types";

export const FEED_MODES = ["engagement", "evidence"] as const satisfies readonly FeedMode[];

export const DEFAULT_FEED_MODE: FeedMode = "engagement";

export const FEED_MODE_DETAILS: Record<FeedMode, { label: string; hint: string; description: string }> = {
  engagement: {
    label: "Engagement",
    hint: "Likes and shares",
    description: "Posts are ordered by likes and shares only.",
  },
  evidence: {
    label: "EvidenceRank",
    hint: "Bonus and penalty",
    description:
      "Adds 25 for a reviewed supported claim and subtracts 50 for a reviewed contradicted claim. Unverified claims keep their engagement score.",
  },
};

export function isFeedMode(value: unknown): value is FeedMode {
  return typeof value === "string" && (FEED_MODES as readonly string[]).includes(value);
}
