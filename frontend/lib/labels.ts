import type { EvidenceStrengthLevel } from "@/lib/evidence-strength";
import type { EvidenceScoreProvenance, EvidenceStatus, ReviewStatus } from "@/types";

export const EVIDENCE_STATUS_LABELS: Record<EvidenceStatus, string> = {
  supported: "Supported",
  missing_context: "Missing context",
  source_mismatch: "Source mismatch",
  contradicted: "Contradicted",
  unresolved: "Unresolved",
  not_checkable: "Not checkable",
};

export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  approved: "Reviewed",
  pending: "Not reviewed",
};

export function evidenceBadgeClass(status: EvidenceStatus): string {
  switch (status) {
    case "supported":
      return "bg-accent/10 text-accent-strong";
    case "missing_context":
      return "bg-warning/10 text-warning";
    case "source_mismatch":
      return "bg-copper/10 text-copper";
    case "contradicted":
      return "bg-danger/10 text-danger";
    case "unresolved":
      return "bg-foreground/5 text-muted";
    case "not_checkable":
      return "bg-foreground/5 text-muted";
    default: {
      const unreachable: never = status;
      return unreachable;
    }
  }
}

export const SCORE_PROVENANCE_LABELS: Record<EvidenceScoreProvenance, string> = {
  demo: "Demo score",
  evaluated: "Evaluated score",
  unavailable: "Not scored",
};

export type StrengthTone = {
  /** Applied as `currentColor` for rings and bars. */
  stroke: string;
  text: string;
  soft: string;
};

export const UNSCORED_TONE: StrengthTone = {
  stroke: "text-muted",
  text: "text-muted",
  soft: "bg-foreground/5",
};

export function strengthTone(level: EvidenceStrengthLevel): StrengthTone {
  switch (level) {
    case "strong":
      return { stroke: "text-accent", text: "text-accent-strong", soft: "bg-accent/10" };
    case "moderate":
      return { stroke: "text-warning", text: "text-warning", soft: "bg-warning/10" };
    case "limited":
      return { stroke: "text-copper", text: "text-copper", soft: "bg-copper/10" };
    case "insufficient":
      return { stroke: "text-danger", text: "text-danger", soft: "bg-danger/10" };
    default: {
      const unreachable: never = level;
      return unreachable;
    }
  }
}

export function formatScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function formatAdjustment(adjustment: number): string {
  const percent = Math.round(adjustment * 100);
  if (percent > 0) {
    return `+${percent}%`;
  }
  return `${percent}%`;
}
