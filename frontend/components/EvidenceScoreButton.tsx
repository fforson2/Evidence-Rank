"use client";

import { useState } from "react";
import { EvidenceScoreRing } from "@/components/EvidenceScoreRing";
import { EvidenceStrengthBreakdown } from "@/components/EvidenceStrengthBreakdown";
import { EvidenceStrengthDialog } from "@/components/EvidenceStrengthDialog";
import { evidenceStrengthThreshold, resolveEvidenceStrength } from "@/lib/evidence-strength";
import { SCORE_PROVENANCE_LABELS, strengthTone, UNSCORED_TONE } from "@/lib/labels";

type EvidenceScoreButtonProps = {
  /** Raw evidence-strength data. Validated here, so API payloads can be passed through directly. */
  strength: unknown;
  /** Identifies the item in the dialog, e.g. the post author and text. */
  description: string;
};

export function EvidenceScoreButton({ strength, description }: EvidenceScoreButtonProps) {
  const [open, setOpen] = useState(false);
  const resolved = resolveEvidenceStrength(strength);

  const scored = resolved.status !== "unavailable";
  const score = scored ? resolved.overall : null;
  const threshold = scored ? evidenceStrengthThreshold(resolved.level) : null;
  const tone = scored ? strengthTone(resolved.level) : UNSCORED_TONE;
  const provenance = scored ? SCORE_PROVENANCE_LABELS[resolved.provenance] : "Not scored";

  const accessibleName = scored
    ? `Evidence strength ${score} out of 100, ${threshold?.label}, ${provenance.toLowerCase()}. Open breakdown`
    : "No evidence score. Open details";

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-label={accessibleName}
        title={
          scored
            ? `Evidence strength ${score}/100 (${provenance.toLowerCase()}). Open the breakdown.`
            : "No evidence-strength score. Open details."
        }
        onClick={() => setOpen(true)}
        className="group inline-flex shrink-0 items-center gap-2 rounded-xl border border-line bg-card py-1 pr-2.5 pl-1 text-left transition-colors hover:border-foreground/20 hover:bg-foreground/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <EvidenceScoreRing score={score} size={34} strokeWidth={3.5} toneClass={tone.stroke}>
          <span className={`text-[11px] font-semibold tabular-nums ${score === null ? "text-muted" : "text-foreground"}`}>
            {score ?? "—"}
          </span>
        </EvidenceScoreRing>
        <span className="flex flex-col leading-tight">
          <span className={`text-xs font-semibold ${tone.text}`}>{threshold?.shortLabel ?? "No score"}</span>
          <span className="text-[11px] text-muted group-hover:text-foreground">{provenance}</span>
        </span>
      </button>

      <EvidenceStrengthDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Evidence strength"
        description={description}
      >
        {open ? <EvidenceStrengthBreakdown strength={resolved} /> : null}
      </EvidenceStrengthDialog>
    </>
  );
}
