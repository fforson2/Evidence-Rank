type RankingModeNoteProps = {
  usingDemoFixtures: boolean;
  usingModel: boolean;
};

export function RankingModeNote({ usingDemoFixtures, usingModel }: RankingModeNoteProps) {
  return (
    <div className="space-y-2.5 rounded-2xl border border-line bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-xs font-semibold tracking-wide text-muted uppercase">EvidenceRank</p>
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
      <p className="text-sm leading-6 text-foreground">
        gpt-4o-mini labels each claim from the public pages. The EvidenceRank formula then adjusts the engagement
        score.
      </p>
      <p className="text-xs leading-5 text-muted">
        The ring is the weighted score from source quality, relevance, methodology, and corroboration. It does not
        change the order of the feed.
      </p>
    </div>
  );
}
