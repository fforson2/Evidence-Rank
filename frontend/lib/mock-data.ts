import { DEMO_EVIDENCE_STRENGTH } from "@/lib/mock-evidence-strength";
import { rankPosts } from "@/lib/ranking";
import type { EvidenceExplanation, FeedMode, FeedResponse, Post } from "@/types";

export const DEMO_DISCLAIMER =
  "Demo data. These posts and evidence labels are fixtures for local development. They are not live fact-checks.";

const PLACEHOLDER_VIDEO_URL =
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4";

export const DEMO_POSTS: Post[] = [
  {
    id: "post-001",
    type: "text",
    author: "Maya Chen",
    content:
      "In the Example County demo election, the clerk counted every mail ballot that arrived after 8 p.m.",
    video_url: null,
    likes: 500,
    shares: 40,
    evidence_status: "contradicted",
    review_status: "approved",
    evidence_strength: DEMO_EVIDENCE_STRENGTH["post-001"],
  },
  {
    id: "post-002",
    type: "video",
    author: "Jordan Hale",
    content:
      "Demo video. The picture is a public-domain placeholder clip. The claim is in this caption: Example County's demo election office reported that 64% of registered voters turned out.",
    video_url: PLACEHOLDER_VIDEO_URL,
    likes: 420,
    shares: 30,
    evidence_status: "supported",
    review_status: "approved",
    evidence_strength: DEMO_EVIDENCE_STRENGTH["post-002"],
  },
  {
    id: "post-003",
    type: "text",
    author: "Priya Nandakumar",
    content:
      "A flyer in the demo dataset says the Oak Street polling place in Example County moved the night before the election.",
    video_url: null,
    likes: 310,
    shares: 24,
    evidence_status: "unresolved",
    review_status: "approved",
    evidence_strength: DEMO_EVIDENCE_STRENGTH["post-003"],
  },
  {
    id: "post-004",
    type: "text",
    author: "Chris Alvarez",
    content:
      "This demo post uses a 2012 turnout chart as proof of what happened in the current Example County election.",
    video_url: null,
    likes: 280,
    shares: 80,
    evidence_status: "source_mismatch",
    review_status: "approved",
    evidence_strength: DEMO_EVIDENCE_STRENGTH["post-004"],
  },
  {
    id: "post-005",
    type: "video",
    author: "Sam Okonkwo",
    content:
      "Demo video. The picture is a public-domain placeholder clip. The caption claims Example County rejected thousands of ballots and leaves out the demo report's note that most were duplicate submissions.",
    video_url: PLACEHOLDER_VIDEO_URL,
    likes: 260,
    shares: 36,
    evidence_status: "missing_context",
    review_status: "approved",
    evidence_strength: DEMO_EVIDENCE_STRENGTH["post-005"],
  },
  {
    id: "post-006",
    type: "text",
    author: "Riley Brooks",
    content:
      "I think Example County should run the demo election on weekends. That is my opinion, not a factual claim about what happened.",
    video_url: null,
    likes: 200,
    shares: 10,
    evidence_status: "not_checkable",
    review_status: "approved",
    evidence_strength: DEMO_EVIDENCE_STRENGTH["post-006"],
  },
  {
    id: "post-007",
    type: "text",
    author: "Avery Singh",
    content:
      "Someone in the demo comments said the sample ballot still lists a candidate who dropped out. This post has not been reviewed.",
    video_url: null,
    likes: 460,
    shares: 50,
    evidence_status: "unresolved",
    review_status: "pending",
  },
];

const DEMO_EVIDENCE: Record<string, EvidenceExplanation> = {
  "post-001": {
    post_id: "post-001",
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    claims: [
      {
        id: "claim-001a",
        text: "The Example County demo clerk counted every mail ballot that arrived after 8 p.m.",
        evidence_status: "contradicted",
        review_status: "approved",
        explanation:
          "The demo election handbook says mail ballots had to arrive by 8 p.m. on election day to be counted. This fixture marks the claim contradicted.",
        sources: [
          {
            id: "source-handbook",
            title: "Example County Election Handbook (demo)",
            url: "https://example.com/demo/example-county/election-handbook",
            publisher: "Example County Elections Office (demo)",
          },
        ],
      },
      {
        id: "claim-001b",
        text: "Example County published the 8 p.m. mail-ballot deadline before election day.",
        evidence_status: "supported",
        review_status: "approved",
        explanation:
          "The same demo handbook lists the deadline on the election calendar. The post's overall label stays contradicted because the ranking uses the post-level status, which follows the main claim.",
        sources: [
          {
            id: "source-handbook",
            title: "Example County Election Handbook (demo)",
            url: "https://example.com/demo/example-county/election-handbook",
            publisher: "Example County Elections Office (demo)",
          },
        ],
      },
    ],
  },
  "post-002": {
    post_id: "post-002",
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    claims: [
      {
        id: "claim-002",
        text: "Example County's demo election office reported 64% turnout among registered voters.",
        evidence_status: "supported",
        review_status: "approved",
        explanation:
          "The demo turnout report lists 64% of registered voters. This fixture marks the claim supported.",
        sources: [
          {
            id: "source-turnout",
            title: "Example County Turnout Report (demo)",
            url: "https://example.com/demo/example-county/turnout-report",
            publisher: "Example County Elections Office (demo)",
          },
        ],
      },
    ],
  },
  "post-003": {
    post_id: "post-003",
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    claims: [
      {
        id: "claim-003",
        text: "The Oak Street polling place in the Example County demo election moved the night before election day.",
        evidence_status: "unresolved",
        review_status: "approved",
        explanation:
          "Reviewers looked for a matching notice in the demo archive and did not find one. The claim stays unresolved, so the ranker does not apply a penalty.",
        sources: [],
      },
    ],
  },
  "post-004": {
    post_id: "post-004",
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    claims: [
      {
        id: "claim-004",
        text: "The 2012 turnout chart describes the current Example County demo election.",
        evidence_status: "source_mismatch",
        review_status: "approved",
        explanation:
          "The chart exists in the demo archive, but it describes 2012 rather than the current demo election. This fixture marks a source mismatch.",
        sources: [
          {
            id: "source-2012",
            title: "2012 Turnout Chart (demo)",
            url: "https://example.com/demo/example-county/turnout-2012",
            publisher: "Demo Civic Archive",
          },
        ],
      },
    ],
  },
  "post-005": {
    post_id: "post-005",
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    claims: [
      {
        id: "claim-005",
        text: "Example County rejected thousands of ballots in the demo election.",
        evidence_status: "missing_context",
        review_status: "approved",
        explanation:
          "The demo canvass notes list rejected ballots and also say most were duplicate submissions. The caption drops that context, so this fixture marks missing context.",
        sources: [
          {
            id: "source-canvass",
            title: "Example County Canvass Notes (demo)",
            url: "https://example.com/demo/example-county/canvass-notes",
            publisher: "Example County Elections Office (demo)",
          },
        ],
      },
    ],
  },
  "post-006": {
    post_id: "post-006",
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    claims: [
      {
        id: "claim-006",
        text: "Example County should run the demo election on weekends.",
        evidence_status: "not_checkable",
        review_status: "approved",
        explanation:
          "This is an opinion about what the county should do. It is not a checkable factual claim, so the ranker does not apply a penalty.",
        sources: [],
      },
    ],
  },
  "post-007": {
    post_id: "post-007",
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    claims: [
      {
        id: "claim-007",
        text: "The Example County demo sample ballot lists a candidate who dropped out.",
        evidence_status: "unresolved",
        review_status: "pending",
        explanation:
          "No review has been approved for this post. A missing review is not treated as a penalty. The unresolved label is only a placeholder until a review exists.",
        sources: [],
      },
    ],
  },
};

export function getMockFeed(mode: FeedMode): FeedResponse {
  return {
    mode,
    data_origin: "demo",
    disclaimer: DEMO_DISCLAIMER,
    posts: rankPosts(DEMO_POSTS, mode),
  };
}

export function getMockPosts(): Post[] {
  return DEMO_POSTS.map((post) => ({ ...post }));
}

export function getMockEvidence(postId: string): EvidenceExplanation | null {
  const evidence = DEMO_EVIDENCE[postId];
  if (!evidence) {
    return null;
  }
  return structuredClone(evidence);
}
