import type { CSSProperties, ReactNode } from "react";
import { EvidenceScoreRing } from "@/components/EvidenceScoreRing";
import {
  EVIDENCE_DIMENSION_KEYS,
  EVIDENCE_DIMENSIONS,
  EVIDENCE_STRENGTH_THRESHOLDS,
  evidenceStrengthThreshold,
  type EvidenceStrengthLevel,
  type ResolvedDimension,
  type ResolvedEvidenceStrength,
} from "@/lib/evidence-strength";
import { formatScore, SCORE_PROVENANCE_LABELS, strengthTone, UNSCORED_TONE } from "@/lib/labels";
import type { EvidenceScoreProvenance } from "@/types";

type EvidenceStrengthBreakdownProps = {
  strength: ResolvedEvidenceStrength;
};

const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

const UNAVAILABLE_MESSAGES: Record<Extract<ResolvedEvidenceStrength, { status: "unavailable" }>["reason"], string> = {
  not_provided: "No evidence score has been recorded for this post yet.",
  not_scored: "This post was not scored.",
  invalid: "The evidence score data for this post is incomplete or invalid, so no score is shown.",
};

export function EvidenceStrengthBreakdown({ strength }: EvidenceStrengthBreakdownProps) {
  return (
    <div className="space-y-5">
      <ScoreSummary strength={strength} />
      {strength.status !== "unavailable" ? <ProvenanceNotice provenance={strength.provenance} /> : null}

      {strength.status === "breakdown" ? (
        <>
          {strength.note ? <p className="text-sm leading-6 text-muted">{strength.note}</p> : null}
          <DimensionList dimensions={strength.dimensions} />
          <CalculationDetails strength={strength} />
        </>
      ) : (
        <BreakdownUnavailable strength={strength} />
      )}

      <p className="border-t border-line pt-4 text-xs leading-5 text-muted">
        This score describes evidence strength only. It does not change the feed ranking, which uses the reviewed
        evidence label.
      </p>
    </div>
  );
}

function StrengthBars({ level }: { level: EvidenceStrengthLevel | null }) {
  const filled = level === null ? 0 : 4 - EVIDENCE_STRENGTH_THRESHOLDS.findIndex((item) => item.level === level);
  return (
    <span aria-hidden className="inline-flex items-end gap-0.5">
      {[0, 1, 2, 3].map((index) => (
        <span
          key={index}
          className={`w-1 rounded-sm ${index < filled ? "bg-current" : "bg-current opacity-25"}`}
          style={{ height: 5 + index * 2.5 }}
        />
      ))}
    </span>
  );
}

function ProvenanceBadge({ provenance }: { provenance: EvidenceScoreProvenance }) {
  const style =
    provenance === "demo"
      ? "border-dashed border-copper/60 bg-copper/5 text-copper"
      : provenance === "evaluated"
        ? "border-accent/40 bg-accent/5 text-accent-strong"
        : "border-line bg-foreground/5 text-muted";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${style}`}
    >
      {SCORE_PROVENANCE_LABELS[provenance]}
    </span>
  );
}

function ScoreSummary({ strength }: { strength: ResolvedEvidenceStrength }) {
  const scored = strength.status !== "unavailable";
  const score = scored ? strength.overall : null;
  const level = scored ? strength.level : null;
  const tone = level ? strengthTone(level) : UNSCORED_TONE;
  const label = level ? evidenceStrengthThreshold(level).label : "No evidence score";

  let origin: string;
  if (strength.status === "breakdown") {
    origin =
      strength.overallOrigin === "calculated"
        ? "Weighted average of four evidence dimensions."
        : "Overall score provided with this post and shown unchanged.";
  } else if (strength.status === "score_only") {
    origin = "Overall score provided with this post.";
  } else {
    origin = strength.note ?? UNAVAILABLE_MESSAGES[strength.reason];
  }

  return (
    <div className="flex flex-wrap items-center gap-4 sm:gap-5">
      <EvidenceScoreRing score={score} size={104} strokeWidth={9} toneClass={tone.stroke}>
        {score === null ? (
          <span className="text-2xl font-semibold text-muted">—</span>
        ) : (
          <>
            <span className="text-3xl font-semibold leading-none tracking-tight tabular-nums">{score}</span>
            <span className="mt-1 text-[11px] font-medium text-muted">of 100</span>
          </>
        )}
      </EvidenceScoreRing>
      <div className="min-w-[10rem] flex-1 space-y-2">
        <p className="sr-only">{score === null ? "No evidence score." : `Evidence score: ${score} out of 100.`}</p>
        <p
          className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-sm font-semibold ${tone.soft} ${tone.text}`}
        >
          <StrengthBars level={level} />
          {label}
        </p>
        <div>
          <ProvenanceBadge provenance={scored ? strength.provenance : "unavailable"} />
        </div>
        <p className="text-xs leading-5 break-words text-muted">{origin}</p>
      </div>
    </div>
  );
}

function ProvenanceNotice({ provenance }: { provenance: Exclude<EvidenceScoreProvenance, "unavailable"> }) {
  if (provenance === "evaluated") {
    return (
      <p className="rounded-xl border border-accent/25 bg-accent/5 px-3 py-2.5 text-xs leading-5 text-foreground">
        <span className="font-semibold">Evaluated score.</span> Supplied with this post by the EvidenceRank API.
      </p>
    );
  }
  return (
    <p className="rounded-xl border border-dashed border-copper/50 bg-copper/5 px-3 py-2.5 text-xs leading-5 text-foreground">
      <span className="font-semibold">Demo values.</span> These scores are hand-written fixtures for interface
      development. They are not a verified research assessment of this post.
    </p>
  );
}

function DimensionList({ dimensions }: { dimensions: ResolvedDimension[] }) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <h3 className="text-sm font-semibold">Evidence dimensions</h3>
        <p className="text-xs text-muted">Score out of 100</p>
      </div>
      <ul className="mt-3 space-y-3">
        {dimensions.map((dimension) => (
          <DimensionRow key={dimension.key} dimension={dimension} />
        ))}
      </ul>
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: ResolvedDimension }) {
  const tone = strengthTone(dimension.level);
  return (
    <li className="rounded-xl border border-line bg-card p-3 transition-colors hover:border-foreground/20 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-sm font-semibold">{dimension.label}</h4>
          <p className="mt-0.5 text-xs text-muted">
            {formatScore(dimension.weight)}% weight · adds {formatScore(roundTenth(dimension.contribution))} points
          </p>
        </div>
        <p className="shrink-0 text-right">
          <span className="text-lg font-semibold tabular-nums">{formatScore(dimension.score)}</span>
          <span className="text-xs text-muted">/100</span>
        </p>
      </div>

      <div
        role="meter"
        aria-label={`${dimension.label} score`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={dimension.score}
        aria-valuetext={`${formatScore(dimension.score)} out of 100, ${evidenceStrengthThreshold(dimension.level).shortLabel.toLowerCase()}`}
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-foreground/10"
      >
        <div
          className={`h-full rounded-full bg-current ${tone.stroke} w-(--fill) motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out motion-safe:starting:w-0`}
          style={{ "--fill": `${dimension.score}%` } as CSSProperties}
        />
      </div>

      {dimension.explanation ? (
        <p className="mt-2.5 text-sm leading-6 break-words text-foreground">{dimension.explanation}</p>
      ) : (
        <p className="mt-2.5 text-sm leading-6 text-muted italic">No explanation was provided for this dimension.</p>
      )}

      {dimension.sourceIds.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted">
            {dimension.sourceIds.length === 1 ? "Source ID" : "Source IDs"}
          </span>
          {dimension.sourceIds.map((id) => (
            <code key={id} className="rounded bg-foreground/5 px-1.5 py-0.5 font-mono text-[11px] break-all text-foreground">
              {id}
            </code>
          ))}
        </div>
      ) : null}

      <Disclosure summary="What this measures" className="mt-2">
        <p className="text-xs leading-5 text-muted">
          {dimension.description} In this prototype it counts for {formatScore(dimension.weight)}% of the overall score.
        </p>
      </Disclosure>
    </li>
  );
}

function Disclosure({ summary, className, children }: { summary: string; className?: string; children: ReactNode }) {
  return (
    <details className={`group ${className ?? ""}`}>
      <summary
        className={`inline-flex cursor-pointer list-none items-center gap-1 rounded text-xs font-medium text-accent underline-offset-2 hover:underline [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 transition-transform group-open:rotate-90 motion-reduce:transition-none"
        >
          <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {summary}
      </summary>
      <div className="mt-1.5 pl-4.5">{children}</div>
    </details>
  );
}

function roundTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

function CalculationDetails({ strength }: { strength: Extract<ResolvedEvidenceStrength, { status: "breakdown" }> }) {
  return (
    <div className="rounded-xl border border-line bg-background/60 px-3 py-3">
      <Disclosure summary="How this score is calculated">
        <div className="space-y-3 pt-1 text-xs leading-5 text-muted">
          <p>
            Each dimension score is multiplied by its weight. The results are added and rounded to the nearest whole
            number.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[14rem] border-collapse text-left tabular-nums">
              <caption className="sr-only">Weighted contribution of each dimension</caption>
              <thead>
                <tr className="border-b border-line text-[11px] uppercase tracking-wide">
                  <th scope="col" className="py-1.5 pr-2 font-medium">Dimension</th>
                  <th scope="col" className="py-1.5 pr-2 text-right font-medium">Score × weight</th>
                  <th scope="col" className="py-1.5 text-right font-medium">Points</th>
                </tr>
              </thead>
              <tbody>
                {strength.dimensions.map((dimension) => (
                  <tr key={dimension.key} className="border-b border-line/70">
                    <th scope="row" className="py-1.5 pr-2 font-normal text-foreground">{dimension.label}</th>
                    <td className="py-1.5 pr-2 text-right whitespace-nowrap">
                      {formatScore(dimension.score)} × {(dimension.weight / 100).toFixed(2)}
                    </td>
                    <td className="py-1.5 text-right text-foreground">{formatScore(roundTenth(dimension.contribution))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={2} className="pt-2 pr-2 font-medium text-foreground">
                    Weighted average, rounded
                  </th>
                  <td className="pt-2 text-right font-semibold whitespace-nowrap text-foreground">
                    {formatScore(roundTenth(strength.weightedAverage))} → {strength.calculatedOverall}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {strength.overallOrigin === "provided" ? (
            <p className={strength.differsFromCalculated ? "rounded-lg bg-warning/10 px-2.5 py-2 text-warning" : undefined}>
              {strength.differsFromCalculated
                ? `The provided overall score (${strength.overall}) differs from the weighted average of its dimensions (${strength.calculatedOverall}). The provided score is shown unchanged.`
                : `The overall score was provided with this post and is shown unchanged.`}
            </p>
          ) : null}

          <ThresholdList />
        </div>
      </Disclosure>
    </div>
  );
}

function ThresholdList() {
  return (
    <div>
      <p className="font-medium text-foreground">Strength labels</p>
      <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
        {EVIDENCE_STRENGTH_THRESHOLDS.map((threshold) => (
          <li key={threshold.level}>
            {threshold.shortLabel}: {threshold.min}–{threshold.max}
          </li>
        ))}
      </ul>
      <p className="mt-2">
        Weights and thresholds are provisional demonstration defaults. They are not a validated scientific method.
      </p>
    </div>
  );
}

function DimensionGlossary() {
  return (
    <Disclosure summary="What the four dimensions measure">
      <ul className="space-y-2 pt-1">
        {EVIDENCE_DIMENSION_KEYS.map((key) => {
          const dimension = EVIDENCE_DIMENSIONS[key];
          return (
            <li key={key} className="text-xs leading-5 text-muted">
              <span className="font-medium text-foreground">
                {dimension.label} · {dimension.defaultWeight}%
              </span>
              <br />
              {dimension.description}
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs leading-5 text-muted">
        These weights are provisional demonstration defaults, not a validated scientific method.
      </p>
    </Disclosure>
  );
}

function BreakdownUnavailable({
  strength,
}: {
  strength: Exclude<ResolvedEvidenceStrength, { status: "breakdown" }>;
}) {
  let heading: string;
  let message: string;
  if (strength.status === "score_only") {
    heading = "Breakdown not available";
    message =
      strength.reason === "missing_dimensions"
        ? "This post has an overall score but no dimension scores. EvidenceRank does not reconstruct a breakdown to justify an existing score."
        : "The dimension scores for this post are incomplete or invalid, so they are not shown. The overall score is displayed as provided.";
  } else {
    heading = "No breakdown to show";
    message =
      strength.reason === "invalid"
        ? "The score data could not be validated, so no score or breakdown is displayed."
        : strength.reason === "not_scored"
          ? "Posts that are intentionally left unscored, such as opinions, do not receive dimension scores."
          : "Dimension scores appear here once this post has been scored.";
  }

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-dashed border-line bg-background/60 px-4 py-4">
        <h3 className="text-sm font-semibold">{heading}</h3>
        <p className="mt-1 text-sm leading-6 text-muted">{message}</p>
        {strength.status === "score_only" && strength.note ? (
          <p className="mt-2 text-xs leading-5 break-words text-muted">{strength.note}</p>
        ) : null}
        {strength.issues.length > 0 ? (
          <Disclosure summary="Validation details" className="mt-2">
            <ul className="list-disc space-y-0.5 pl-4 text-xs leading-5 text-muted">
              {strength.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </Disclosure>
        ) : null}
      </div>
      <DimensionGlossary />
    </div>
  );
}
