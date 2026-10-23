import { FEED_MODE_DETAILS } from "@/lib/feed-mode";
import type { FeedMode } from "@/types";

type RankingModeNoteProps = {
  mode: FeedMode;
  usingDemoFixtures: boolean;
  usingModel: boolean;
};

export function RankingModeNote({ mode, usingDemoFixtures, usingModel }: RankingModeNoteProps) {
  const details = FEED_MODE_DETAILS[mode];

  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">{details.label} mode</p>
        {usingDemoFixtures ? (
          <span className="rounded-md border border-dashed border-copper/60 bg-copper/5 px-1.5 py-0.5 text-[11px] font-semibold text-copper">
            Demo data
          </span>
        ) : null}
        {usingModel ? (
          <span className="rounded-md border border-accent/40 bg-accent/10 px-1.5 py-0.5 text-[11px] font-semibold text-accent-strong">
            gpt-4o-mini
          </span>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-foreground">{details.description}</p>

      <details className="group">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-accent underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          >
            <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          How the two modes differ
        </summary>
        <ul className="mt-2 space-y-2 pl-4.5 text-xs leading-5 text-muted">
          <li>
            <span className="font-medium text-foreground">Engagement</span> ranks by likes and shares.
          </li>
          <li>
            <span className="font-medium text-foreground">EvidenceRank</span> asks gpt-4o-mini for a label from the
            retrieved public pages, then applies the same adjustment for Supported, Contradicted, and the other review
            labels.
          </li>
          <li>
            The <span className="font-medium text-foreground">evidence strength</span> score on each card is
            informational. It does not change the order in either mode, and review labels are never converted into
            strength scores.
          </li>
        </ul>
      </details>
    </div>
  );
}
