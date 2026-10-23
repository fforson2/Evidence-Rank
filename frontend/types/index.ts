export type FeedMode = "engagement" | "evidence";

export type PostType = "text" | "video";

export type EvidenceStatus =
  | "supported"
  | "missing_context"
  | "source_mismatch"
  | "contradicted"
  | "unresolved"
  | "not_checkable";

export type ReviewStatus = "pending" | "approved";

export type DataOrigin = "demo";

export interface Post {
  id: string;
  type: PostType;
  author: string;
  content: string;
  video_url: string | null;
  likes: number;
  shares: number;
  evidence_status: EvidenceStatus;
  review_status: ReviewStatus;
}

export interface RankedPost extends Post {
  rank: number;
  engagement_score: number;
  evidence_adjustment: number;
  score: number;
}

export interface FeedResponse {
  mode: FeedMode;
  data_origin: DataOrigin;
  disclaimer: string;
  posts: RankedPost[];
}

export interface PostListResponse {
  data_origin: DataOrigin;
  disclaimer: string;
  posts: Post[];
}

export interface EvidenceSource {
  id: string;
  title: string;
  url: string;
  publisher: string;
}

export interface Claim {
  id: string;
  text: string;
  evidence_status: EvidenceStatus;
  review_status: ReviewStatus;
  explanation: string;
  sources: EvidenceSource[];
}

export interface EvidenceExplanation {
  post_id: string;
  data_origin: DataOrigin;
  disclaimer: string;
  claims: Claim[];
}

export type InteractionEventType =
  | "view"
  | "like"
  | "share"
  | "evidence_open"
  | "feed_mode_change";

export interface InteractionEventRequest {
  post_id?: string | null;
  event_type: InteractionEventType;
  feed_mode: FeedMode;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface InteractionEvent {
  id: string;
  post_id: string | null;
  event_type: InteractionEventType;
  feed_mode: FeedMode;
  metadata: Record<string, string | number | boolean | null>;
  created_at: string;
}

export interface HealthResponse {
  status: "ok";
}

export interface ApiErrorBody {
  error: string;
  message: string;
}
