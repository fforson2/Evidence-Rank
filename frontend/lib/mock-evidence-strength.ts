import { DEFAULT_DIMENSION_WEIGHTS } from "@/lib/evidence-strength";
import type { EvidenceDimensionKey, EvidenceDimensionScores, EvidenceStrength } from "@/types";

/**
 * Hand-written demo breakdowns for local development. They are not research assessments.
 * Source identifiers refer to the demo sources already attached to each post's claims.
 */

type DemoDimensionInput = Record<EvidenceDimensionKey, { score: number; explanation: string; source_ids?: string[] }>;

function demoDimensions(input: DemoDimensionInput): EvidenceDimensionScores {
  return {
    source_quality: { ...input.source_quality, weight: DEFAULT_DIMENSION_WEIGHTS.source_quality },
    relevance: { ...input.relevance, weight: DEFAULT_DIMENSION_WEIGHTS.relevance },
    methodology: { ...input.methodology, weight: DEFAULT_DIMENSION_WEIGHTS.methodology },
    corroboration: { ...input.corroboration, weight: DEFAULT_DIMENSION_WEIGHTS.corroboration },
  };
}

export const DEMO_EVIDENCE_STRENGTH: Record<string, EvidenceStrength> = {
  "post-001": {
    provenance: "demo",
    overall_score: null,
    dimensions: demoDimensions({
      source_quality: {
        score: 20,
        explanation:
          "The post cites no source. The only source in the demo dataset is the county election handbook, and it describes a different rule.",
        source_ids: ["source-handbook"],
      },
      relevance: {
        score: 15,
        explanation:
          "The handbook addresses the claim directly but says mail ballots had to arrive by 8 p.m., so it does not support the post.",
        source_ids: ["source-handbook"],
      },
      methodology: {
        score: 10,
        explanation: "The post offers no count, record, or method behind its statement that late ballots were counted.",
      },
      corroboration: {
        score: 5,
        explanation: "No source in the demo dataset backs the claim.",
      },
    }),
  },
  "post-002": {
    provenance: "demo",
    overall_score: null,
    dimensions: demoDimensions({
      source_quality: {
        score: 88,
        explanation: "The turnout report comes from the elections office named in the claim and is traceable to a single document.",
        source_ids: ["source-turnout"],
      },
      relevance: {
        score: 100,
        explanation: "The report gives the same 64% figure for registered voters that the caption states.",
        source_ids: ["source-turnout"],
      },
      methodology: {
        score: 70,
        explanation: "The fixture does not describe how turnout was tallied or audited, so the method is only partly documented.",
      },
      corroboration: {
        score: 55,
        explanation: "Only one source is attached. No independent dataset confirms the figure in this demo.",
      },
    }),
  },
  "post-003": {
    provenance: "demo",
    overall_score: 30,
    dimensions: null,
    note: "This demo fixture records only an overall score, to show how items without dimension scores appear.",
  },
  "post-004": {
    provenance: "demo",
    overall_score: null,
    dimensions: demoDimensions({
      source_quality: {
        score: 65,
        explanation: "The chart is a real document in the demo civic archive and can be traced, but it is not from the county office.",
        source_ids: ["source-2012"],
      },
      relevance: {
        score: 10,
        explanation: "The chart describes the 2012 election, not the current one, so it does not support the claim as posted.",
        source_ids: ["source-2012"],
      },
      methodology: {
        score: 40,
        explanation: "The fixture does not document how the 2012 figures were collected.",
      },
      corroboration: {
        score: 0,
        explanation: "No source about the current election backs the post.",
      },
    }),
  },
  "post-005": {
    provenance: "demo",
    overall_score: null,
    dimensions: demoDimensions({
      source_quality: {
        score: 82,
        explanation: "The canvass notes come from the county elections office and are traceable.",
        source_ids: ["source-canvass"],
      },
      relevance: {
        score: 60,
        explanation:
          "The notes confirm that ballots were rejected, but they also say most were duplicate submissions, which the caption leaves out.",
        source_ids: ["source-canvass"],
      },
      methodology: {
        score: 45,
        explanation: "The caption presents a raw count without the explanation the source gives for why ballots were rejected.",
      },
      corroboration: {
        score: 35,
        explanation: "Only the canvass notes are attached in this demo.",
      },
    }),
  },
  "post-006": {
    provenance: "unavailable",
    overall_score: null,
    dimensions: null,
    note: "This post states an opinion. There is no factual claim to score.",
  },
};
