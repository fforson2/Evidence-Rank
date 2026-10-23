import type {
  EvidenceDimensionKey,
  EvidenceDimensionScore,
  EvidenceDimensionScores,
  EvidenceScoreProvenance,
} from "@/types";

/**
 * Provisional demonstration defaults. These weights and thresholds are not a validated
 * scientific methodology and should be revisited before any evaluated scores ship.
 */
export const EVIDENCE_DIMENSION_KEYS = [
  "source_quality",
  "relevance",
  "methodology",
  "corroboration",
] as const satisfies readonly EvidenceDimensionKey[];

export type EvidenceDimensionDefinition = {
  label: string;
  description: string;
  defaultWeight: number;
};

export const EVIDENCE_DIMENSIONS: Record<EvidenceDimensionKey, EvidenceDimensionDefinition> = {
  source_quality: {
    label: "Source quality",
    description: "Credibility, reliability, and traceability of the cited sources.",
    defaultWeight: 30,
  },
  relevance: {
    label: "Relevance",
    description: "How directly the evidence supports the specific claim in the post.",
    defaultWeight: 25,
  },
  methodology: {
    label: "Methodology",
    description: "Quality of the research design and methods behind the evidence, including acknowledged limitations.",
    defaultWeight: 25,
  },
  corroboration: {
    label: "Corroboration",
    description: "Support from independent sources or findings.",
    defaultWeight: 20,
  },
};

export const WEIGHT_TOTAL = 100;
const WEIGHT_TOLERANCE = 0.001;
/** A provided overall score that differs from its weighted average by more than this is flagged. */
const OVERALL_MISMATCH_TOLERANCE = 1;

export const DEFAULT_DIMENSION_WEIGHTS = Object.fromEntries(
  EVIDENCE_DIMENSION_KEYS.map((key) => [key, EVIDENCE_DIMENSIONS[key].defaultWeight]),
) as Record<EvidenceDimensionKey, number>;

if (!weightsTotal100(Object.values(DEFAULT_DIMENSION_WEIGHTS))) {
  throw new Error("Default evidence dimension weights must total 100.");
}

export type EvidenceStrengthLevel = "strong" | "moderate" | "limited" | "insufficient";

export const EVIDENCE_STRENGTH_THRESHOLDS: readonly {
  level: EvidenceStrengthLevel;
  min: number;
  max: number;
  label: string;
  shortLabel: string;
}[] = [
  { level: "strong", min: 75, max: 100, label: "Strong evidence", shortLabel: "Strong" },
  { level: "moderate", min: 50, max: 74, label: "Moderate evidence", shortLabel: "Moderate" },
  { level: "limited", min: 25, max: 49, label: "Limited evidence", shortLabel: "Limited" },
  { level: "insufficient", min: 0, max: 24, label: "Insufficient evidence", shortLabel: "Insufficient" },
];

export function isValidScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function weightsTotal100(weights: readonly number[]): boolean {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return Math.abs(total - WEIGHT_TOTAL) <= WEIGHT_TOLERANCE;
}

/** Rounds half up to a whole number. Every displayed overall score goes through this. */
export function roundEvidenceScore(value: number): number {
  return Math.round(value);
}

export function evidenceStrengthLevel(score: number): EvidenceStrengthLevel {
  const rounded = roundEvidenceScore(score);
  const match = EVIDENCE_STRENGTH_THRESHOLDS.find((threshold) => rounded >= threshold.min);
  return match?.level ?? "insufficient";
}

export function evidenceStrengthThreshold(level: EvidenceStrengthLevel) {
  const match = EVIDENCE_STRENGTH_THRESHOLDS.find((threshold) => threshold.level === level);
  if (!match) {
    throw new Error(`Unknown evidence strength level: ${level}`);
  }
  return match;
}

/** Points a dimension adds to the overall score, before rounding. */
export function dimensionContribution(dimension: EvidenceDimensionScore): number {
  return (dimension.score * dimension.weight) / WEIGHT_TOTAL;
}

/** Unrounded weighted average: Σ(score × weight) / 100. */
export function weightedAverage(dimensions: EvidenceDimensionScores): number {
  const weightedSum = EVIDENCE_DIMENSION_KEYS.reduce(
    (sum, key) => sum + dimensions[key].score * dimensions[key].weight,
    0,
  );
  return weightedSum / WEIGHT_TOTAL;
}

export function calculateOverallScore(dimensions: EvidenceDimensionScores): number {
  return roundEvidenceScore(weightedAverage(dimensions));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type DimensionValidation =
  | { ok: true; dimensions: EvidenceDimensionScores }
  | { ok: false; issues: string[] };

export function validateDimensions(input: unknown): DimensionValidation {
  if (!isRecord(input)) {
    return { ok: false, issues: ["Dimension scores are not in the expected format."] };
  }

  const issues: string[] = [];
  const parsed: Partial<EvidenceDimensionScores> = {};

  for (const key of EVIDENCE_DIMENSION_KEYS) {
    const { label } = EVIDENCE_DIMENSIONS[key];
    const raw = input[key];
    if (!isRecord(raw)) {
      issues.push(`${label} is missing.`);
      continue;
    }

    const { score, weight, explanation, source_ids: sourceIds } = raw;
    if (!isValidScore(score)) {
      issues.push(`${label} score must be a number from 0 to 100.`);
    }
    if (!isValidScore(weight)) {
      issues.push(`${label} weight must be a percentage from 0 to 100.`);
    }
    if (explanation !== undefined && explanation !== null && typeof explanation !== "string") {
      issues.push(`${label} explanation must be text.`);
    }
    const validSourceIds =
      sourceIds === undefined ||
      (Array.isArray(sourceIds) && sourceIds.every((id) => typeof id === "string" && id.trim() !== ""));
    if (!validSourceIds) {
      issues.push(`${label} source identifiers must be a list of non-empty text values.`);
    }

    if (isValidScore(score) && isValidScore(weight)) {
      parsed[key] = {
        score,
        weight,
        explanation: typeof explanation === "string" && explanation.trim() !== "" ? explanation.trim() : null,
        source_ids: Array.isArray(sourceIds) ? sourceIds.filter((id): id is string => typeof id === "string") : [],
      };
    }
  }

  if (issues.length === 0) {
    const weights = EVIDENCE_DIMENSION_KEYS.map((key) => parsed[key]?.weight ?? 0);
    if (!weightsTotal100(weights)) {
      const total = weights.reduce((sum, weight) => sum + weight, 0);
      issues.push(`Dimension weights total ${Number(total.toFixed(2))}% instead of 100%.`);
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }
  return { ok: true, dimensions: parsed as EvidenceDimensionScores };
}

export type ResolvedDimension = {
  key: EvidenceDimensionKey;
  label: string;
  description: string;
  score: number;
  weight: number;
  contribution: number;
  level: EvidenceStrengthLevel;
  explanation: string | null;
  sourceIds: string[];
};

type ScoredProvenance = Exclude<EvidenceScoreProvenance, "unavailable">;

export type ResolvedEvidenceStrength =
  | {
      status: "breakdown";
      provenance: ScoredProvenance;
      overall: number;
      /** `provided` scores are shown unchanged; `calculated` scores come from the weighted average. */
      overallOrigin: "provided" | "calculated";
      weightedAverage: number;
      calculatedOverall: number;
      differsFromCalculated: boolean;
      level: EvidenceStrengthLevel;
      dimensions: ResolvedDimension[];
      note: string | null;
    }
  | {
      status: "score_only";
      provenance: ScoredProvenance;
      overall: number;
      level: EvidenceStrengthLevel;
      reason: "missing_dimensions" | "invalid_dimensions";
      issues: string[];
      note: string | null;
    }
  | {
      status: "unavailable";
      reason: "not_provided" | "not_scored" | "invalid";
      issues: string[];
      note: string | null;
    };

function toResolvedDimensions(dimensions: EvidenceDimensionScores): ResolvedDimension[] {
  return EVIDENCE_DIMENSION_KEYS.map((key) => {
    const dimension = dimensions[key];
    return {
      key,
      label: EVIDENCE_DIMENSIONS[key].label,
      description: EVIDENCE_DIMENSIONS[key].description,
      score: dimension.score,
      weight: dimension.weight,
      contribution: dimensionContribution(dimension),
      level: evidenceStrengthLevel(dimension.score),
      explanation: dimension.explanation ?? null,
      sourceIds: dimension.source_ids ?? [],
    };
  });
}

/**
 * Turns raw evidence-strength data (from the API or fixtures) into a display model.
 * A provided overall score is never replaced, and a missing breakdown is never invented.
 */
export function resolveEvidenceStrength(input: unknown): ResolvedEvidenceStrength {
  if (input === null || input === undefined) {
    return { status: "unavailable", reason: "not_provided", issues: [], note: null };
  }
  if (!isRecord(input)) {
    return { status: "unavailable", reason: "invalid", issues: ["Evidence strength data is not in the expected format."], note: null };
  }

  const note = typeof input.note === "string" && input.note.trim() !== "" ? input.note.trim() : null;
  const { provenance } = input;

  if (provenance === "unavailable") {
    return { status: "unavailable", reason: "not_scored", issues: [], note };
  }
  if (provenance !== "demo" && provenance !== "evaluated") {
    return { status: "unavailable", reason: "invalid", issues: ["The score provenance is missing or unrecognized."], note };
  }

  const rawOverall = input.overall_score;
  const hasOverall = rawOverall !== null && rawOverall !== undefined;
  if (hasOverall && !isValidScore(rawOverall)) {
    return { status: "unavailable", reason: "invalid", issues: ["The overall score must be a number from 0 to 100."], note };
  }
  const providedOverall = hasOverall && isValidScore(rawOverall) ? roundEvidenceScore(rawOverall) : null;

  const rawDimensions = input.dimensions;
  const hasDimensions = rawDimensions !== null && rawDimensions !== undefined;

  if (!hasDimensions) {
    if (providedOverall === null) {
      return { status: "unavailable", reason: "not_provided", issues: [], note };
    }
    return {
      status: "score_only",
      provenance,
      overall: providedOverall,
      level: evidenceStrengthLevel(providedOverall),
      reason: "missing_dimensions",
      issues: [],
      note,
    };
  }

  const validation = validateDimensions(rawDimensions);
  if (!validation.ok) {
    if (providedOverall === null) {
      return { status: "unavailable", reason: "invalid", issues: validation.issues, note };
    }
    return {
      status: "score_only",
      provenance,
      overall: providedOverall,
      level: evidenceStrengthLevel(providedOverall),
      reason: "invalid_dimensions",
      issues: validation.issues,
      note,
    };
  }

  const average = weightedAverage(validation.dimensions);
  const calculatedOverall = roundEvidenceScore(average);
  const overall = providedOverall ?? calculatedOverall;

  return {
    status: "breakdown",
    provenance,
    overall,
    overallOrigin: providedOverall === null ? "calculated" : "provided",
    weightedAverage: average,
    calculatedOverall,
    differsFromCalculated:
      providedOverall !== null && Math.abs(providedOverall - average) > OVERALL_MISMATCH_TOLERANCE,
    level: evidenceStrengthLevel(overall),
    dimensions: toResolvedDimensions(validation.dimensions),
    note,
  };
}
