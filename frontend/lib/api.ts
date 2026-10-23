import { DEMO_DISCLAIMER, getMockEvidence, getMockFeed, getMockPosts } from "@/lib/mock-data";
import type {
  ApiErrorBody,
  EvidenceExplanation,
  FeedMode,
  FeedResponse,
  HealthResponse,
  InteractionEvent,
  InteractionEventRequest,
  PostListResponse,
} from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type DataSource = "api" | "demo";

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
    return {
      posts: {
        data_origin: "demo",
        disclaimer: DEMO_DISCLAIMER,
        posts: getMockPosts(),
      },
      source: "demo",
    };
  }
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
    return { feed: getMockFeed(mode), source: "demo" };
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
    return { evidence, source: "api" };
  } catch (error) {
    if (isAbortError(error) || error instanceof ApiError) {
      throw error;
    }
    const evidence = getMockEvidence(postId);
    if (!evidence) {
      throw new ApiError(404, "not_found", "Post not found");
    }
    return { evidence, source: "demo" };
  }
}

export async function recordEvent(event: InteractionEventRequest, signal?: AbortSignal): Promise<void> {
  try {
    await request<InteractionEvent>("/events", {
      method: "POST",
      body: JSON.stringify(event),
      signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      return;
    }
    // Interaction logging is best-effort so the demo still works without the API.
  }
}
