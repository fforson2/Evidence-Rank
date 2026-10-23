import type { FeedMode } from "@/types";

export const FEED_MODES = ["engagement", "evidence"] as const satisfies readonly FeedMode[];

export const DEFAULT_FEED_MODE: FeedMode = "engagement";

export const FEED_MODE_DETAILS: Record<FeedMode, { label: string; hint: string; description: string }> = {
  engagement: {
    label: "Engagement",
    hint: "Likes and shares",
    description: "Posts are ordered using the existing engagement ranking.",
  },
  evidence: {
    label: "EvidenceRank",
    hint: "Engagement plus reviewed evidence",
    description:
      "Posts are ordered using the existing EvidenceRank ranking: engagement adjusted by approved review labels.",
  },
};

export function isFeedMode(value: unknown): value is FeedMode {
  return typeof value === "string" && (FEED_MODES as readonly string[]).includes(value);
}
