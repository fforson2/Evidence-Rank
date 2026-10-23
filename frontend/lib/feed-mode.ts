import type { FeedMode } from "@/types";

export const FEED_MODES = ["engagement", "evidence"] as const satisfies readonly FeedMode[];

export const DEFAULT_FEED_MODE: FeedMode = "engagement";

export const FEED_MODE_DETAILS: Record<FeedMode, { label: string; hint: string; description: string }> = {
  engagement: {
    label: "Engagement",
    hint: "Likes and shares",
    description: "Posts are ordered by the likes and shares counted in this app.",
  },
  evidence: {
    label: "EvidenceRank",
    hint: "gpt-4o-mini plus the formula",
    description:
      "gpt-4o-mini labels each claim from the public pages. The EvidenceRank formula then adjusts the engagement score.",
  },
};

export function isFeedMode(value: unknown): value is FeedMode {
  return typeof value === "string" && (FEED_MODES as readonly string[]).includes(value);
}
