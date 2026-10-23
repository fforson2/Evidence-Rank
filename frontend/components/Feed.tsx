"use client";

import { useEffect, useRef, useState } from "react";
import { FeedToggle } from "@/components/FeedToggle";
import { PostCard } from "@/components/PostCard";
import { RankingModeNote } from "@/components/RankingModeNote";
import { ApiError, getFeed, recordEvent, type DataSource } from "@/lib/api";
import { useFeedMode } from "@/lib/use-feed-mode";
import { useFlipReorder } from "@/lib/use-flip-reorder";
import type { FeedMode, RankedPost } from "@/types";

type InteractionState = {
  liked: boolean;
  likes: number;
  shares: number;
  shareNotice: string | null;
};

function withInteractions(post: RankedPost, interactions: Record<string, InteractionState>): RankedPost {
  const state = interactions[post.id];
  if (!state) {
    return post;
  }
  return { ...post, likes: state.likes, shares: state.shares };
}

export function Feed() {
  const [mode, setMode] = useFeedMode();
  const listRef = useRef<HTMLDivElement>(null);
  const [loadedMode, setLoadedMode] = useState<FeedMode | null>(null);
  const [posts, setPosts] = useState<RankedPost[]>([]);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [interactions, setInteractions] = useState<Record<string, InteractionState>>({});

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getFeed(mode, controller.signal)
      .then((result) => {
        if (!active) {
          return;
        }
        setPosts(result.feed.posts);
        setLoadedMode(result.feed.mode);
        setDisclaimer(result.feed.disclaimer);
        setSource(result.source);
        setError(null);
        setPhase("ready");
      })
      .catch((caught: unknown) => {
        if (!active || (caught instanceof DOMException && caught.name === "AbortError")) {
          return;
        }
        const message = caught instanceof ApiError ? caught.message : "The feed could not be loaded.";
        setError(message);
        setPhase("error");
      })
      .finally(() => {
        if (active) {
          setRefreshing(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [attempt, mode]);

  const capturePositions = useFlipReorder(listRef, `${loadedMode}:${posts.map((post) => post.id).join(",")}`);

  function handleModeChange(next: FeedMode) {
    if (next === mode) {
      return;
    }
    capturePositions();
    setPhase((current) => (current === "error" ? "loading" : current));
    setRefreshing(true);
    setMode(next);
    void recordEvent({
      event_type: "feed_mode_change",
      feed_mode: next,
      metadata: { from: mode },
    });
  }

  function handleLike(post: RankedPost) {
    const existing = interactions[post.id] ?? {
      liked: false,
      likes: post.likes,
      shares: post.shares,
      shareNotice: null,
    };
    const liked = !existing.liked;
    const next = {
      ...existing,
      liked,
      likes: existing.likes + (liked ? 1 : -1),
    };
    setInteractions((current) => ({ ...current, [post.id]: next }));
    if (liked) {
      void recordEvent({ post_id: post.id, event_type: "like", feed_mode: mode });
    }
  }

  async function handleShare(post: RankedPost) {
    const existing = interactions[post.id] ?? {
      liked: false,
      likes: post.likes,
      shares: post.shares,
      shareNotice: null,
    };
    const payload = {
      title: `EvidenceRank · ${post.author}`,
      text: post.content,
      url: window.location.href,
    };

    let notice = "Copied";
    try {
      if (typeof navigator.share === "function") {
        await navigator.share(payload);
        notice = "Shared";
      } else {
        await navigator.clipboard.writeText(`${post.author}: ${post.content}`);
      }
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError") {
        return;
      }
      notice = "Could not share";
    }

    const shared = notice !== "Could not share";
    setInteractions((current) => ({
      ...current,
      [post.id]: {
        ...(current[post.id] ?? existing),
        shares: (current[post.id]?.shares ?? existing.shares) + (shared ? 1 : 0),
        shareNotice: notice,
      },
    }));

    if (shared) {
      void recordEvent({ post_id: post.id, event_type: "share", feed_mode: mode });
    }

    window.setTimeout(() => {
      setInteractions((current) => {
        const state = current[post.id];
        if (!state || state.shareNotice !== notice) {
          return current;
        }
        return { ...current, [post.id]: { ...state, shareNotice: null } };
      });
    }, 2000);
  }

  const statusText =
    phase === "loading"
      ? "Loading feed"
      : mode === "evidence"
        ? "Showing the EvidenceRank feed"
        : "Showing the engagement feed";

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        Compare an engagement ranking with one that also uses reviewed evidence. Every label in this prototype is demo data.
      </p>
      <div className="sticky top-16 z-10">
        <FeedToggle mode={mode} onChange={handleModeChange} />
      </div>
      <RankingModeNote mode={mode} usingDemoFixtures={source === "demo"} />
      <p className="sr-only" aria-live="polite">
        {refreshing ? "Updating feed" : statusText}
      </p>

      {phase === "loading" ? (
        <div className="space-y-4" aria-hidden>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-44 rounded-2xl border border-line bg-card motion-safe:animate-pulse" />
          ))}
        </div>
      ) : null}

      {phase === "error" ? (
        <div role="alert" className="rounded-2xl border border-danger/30 bg-card px-4 py-6">
          <h2 className="text-base font-semibold">The feed could not be loaded</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{error}</p>
          <button
            type="button"
            onClick={() => {
              setPhase("loading");
              setError(null);
              setAttempt((current) => current + 1);
            }}
            className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        </div>
      ) : null}

      {phase === "ready" && loadedMode ? (
        <div className="space-y-4" aria-busy={refreshing}>
          {disclaimer ? <p className="text-xs leading-5 text-muted">{disclaimer}</p> : null}
          {source === "demo" ? (
            <p className="rounded-xl border border-line bg-card px-3 py-2 text-xs leading-5 text-muted">
              Showing local fixtures because the API at the configured address was unreachable.
            </p>
          ) : (
            <p className="text-xs text-muted">Feed data: API{refreshing ? " · updating" : ""}</p>
          )}
          {posts.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">No posts in this feed.</p>
          ) : (
            <div ref={listRef} className="space-y-4">
              {posts.map((post) => {
                const displayed = withInteractions(post, interactions);
                const state = interactions[post.id];
                return (
                  <div key={post.id} data-flip-key={post.id}>
                    <PostCard
                      post={displayed}
                      feedMode={loadedMode}
                      liked={state?.liked ?? false}
                      shareNotice={state?.shareNotice ?? null}
                      onLike={() => handleLike(displayed)}
                      onShare={() => void handleShare(displayed)}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
