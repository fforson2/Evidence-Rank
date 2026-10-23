import { FEED_MODE_DETAILS } from "@/lib/feed-mode";
import type { FeedMode } from "@/types";

type RankingModeNoteProps = {
  mode: FeedMode;
  usingDemoFixtures: boolean;
};

export function RankingModeNote({ mode, usingDemoFixtures }: RankingModeNoteProps) {
  const details = FEED_MODE_DETAILS[mode];
  const evidenceRank = mode === "evidence";

  return (
    <div
      className={`space-y-2.5 rounded-2xl border bg-card px-4 py-3 ${
        evidenceRank ? "border-accent/30" : "border-copper/30"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className={`text-xs font-semibold tracking-wide uppercase ${evidenceRank ? "text-accent-strong" : "text-copper"}`}>
          {details.label}
        </p>
        {usingDemoFixtures ? (
          <span className="rounded-md border border-dashed border-copper/60 bg-copper/5 px-1.5 py-0.5 text-[11px] font-semibold text-copper">
            Demo data
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-foreground">{details.description}</p>
      {evidenceRank ? (
        <p className="text-xs leading-5 text-muted">
          Final score is engagement plus the evidence bonus, minus the reviewed penalty. A source mismatch subtracts 25
          and missing context subtracts 10. The strength ring does not change this order.
        </p>
      ) : (
        <p className="text-xs leading-5 text-muted">
          Evidence labels, bonuses, and penalties stay off. A supported claim does not move up, and a contradicted claim
          does not move down.
        </p>
      )}
    </div>
  );
}
