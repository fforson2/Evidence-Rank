import type {
  ApiErrorBody,
  EvidenceExplanation,
  FeedMode,
  FeedResponse,
  HealthResponse,
  InteractionEvent,
  InteractionEventRequest,
  ModelRankResponse,
  PostListResponse,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type DataSource = "api" | "demo" | "model";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body: unknown = await response.json();
    if (isRecord(body) && isRecord(body.detail)) {
      const detail = body.detail as Partial<ApiErrorBody>;
      if (typeof detail.message === "string") {
        const code = typeof detail.error === "string" ? detail.error : "request_failed";
        return new ApiError(response.status, code, detail.message);
      }
    }
    if (isRecord(body) && typeof body.detail === "string") {
      return new ApiError(response.status, "request_failed", body.detail);
    }
  } catch {
    // The body was not JSON. Fall through to a status-based message.
  }

  return new ApiError(response.status, "request_failed", `Request failed with status ${response.status}`);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    throw await toApiError(response);
  }

  return (await response.json()) as T;
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return request<HealthResponse>("/health", { signal });
}

export async function getPosts(signal?: AbortSignal): Promise<{ posts: PostListResponse; source: DataSource }> {
  try {
    const posts = await request<PostListResponse>("/posts", { signal });
    return { posts, source: "api" };
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, "unreachable", "The API could not be reached.");
  }
}

export type ModelFeedResult = {
  feed: FeedResponse;
  explanations: EvidenceExplanation[];
  source: DataSource;
};

let modelFeedRequest: Promise<ModelFeedResult> | null = null;

/** Evidence labels for the feed. One in-flight request is shared, including across a remount. */
export function getModelFeed(): Promise<ModelFeedResult> {
  if (!modelFeedRequest) {
    const pending = request<ModelRankResponse>("/analysis/rank", { method: "POST" })
      .then((body) => ({
        feed: {
          mode: "evidence" as const,
          data_origin: body.data_origin,
          disclaimer: body.disclaimer,
          posts: body.posts,
        },
        explanations: body.explanations,
        source: "model" as const,
      }))
      .catch((error: unknown) => {
        if (modelFeedRequest === pending) {
          modelFeedRequest = null;
        }
        if (isAbortError(error) || error instanceof ApiError) {
          throw error;
        }
        throw new ApiError(0, "unreachable", "EvidenceRank could not label the feed.");
      });
    modelFeedRequest = pending;
  }
  return modelFeedRequest;
}

export function clearModelFeedCache(): void {
  modelFeedRequest = null;
}

export function hasModelFeedCache(): boolean {
  return modelFeedRequest !== null;
}

export async function getFeed(
  mode: FeedMode,
  signal?: AbortSignal,
): Promise<{ feed: FeedResponse; source: DataSource }> {
  try {
    const feed = await request<FeedResponse>(`/feed?mode=${mode}`, { signal });
    return { feed, source: "api" };
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, "unreachable", "The API could not be reached.");
  }
}

export async function getEvidence(
  postId: string,
  signal?: AbortSignal,
): Promise<{ evidence: EvidenceExplanation; source: DataSource }> {
  try {
    const evidence = await request<EvidenceExplanation>(`/posts/${encodeURIComponent(postId)}/evidence`, {
      signal,
    });
    return { evidence, source: evidence.data_origin === "model" ? "model" : "api" };
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(0, "unreachable", "The API could not be reached.");
  }
}

export async function recordEvent(event: InteractionEventRequest, signal?: AbortSignal): Promise<boolean> {
  try {
    await request<InteractionEvent>("/events", {
      method: "POST",
      body: JSON.stringify(event),
      signal,
    });
    return true;
  } catch (error) {
    if (isAbortError(error)) {
      return false;
    }
    return false;
  }
}
