"use client";

import { useEffect, useRef, useState } from "react";
import { PostCard } from "@/components/PostCard";
import { RankingModeNote } from "@/components/RankingModeNote";
import { ApiError, clearModelFeedCache, getFeed, getModelFeed, recordEvent, type DataSource } from "@/lib/api";
import { rankPosts } from "@/lib/ranking";
import { useFlipReorder } from "@/lib/use-flip-reorder";
import type { EvidenceExplanation, RankedPost } from "@/types";

type InteractionState = {
  liked: boolean;
  likes: number;
  shares: number;
  shareNotice: string | null;
};

export function Feed() {
  const listRef = useRef<HTMLDivElement>(null);
  const [posts, setPosts] = useState<RankedPost[]>([]);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [source, setSource] = useState<DataSource | null>(null);
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [interactions, setInteractions] = useState<Record<string, InteractionState>>({});
  const [explanations, setExplanations] = useState<Record<string, EvidenceExplanation>>({});
  const postsRef = useRef(posts);
  postsRef.current = posts;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    if (postsRef.current.length === 0) {
      getFeed("evidence", controller.signal)
        .then((result) => {
          if (!active) {
            return;
          }
          setPosts((current) => (current.length > 0 ? current : result.feed.posts));
          setDisclaimer((current) => current ?? result.feed.disclaimer);
          setSource((current) => current ?? result.source);
          setPhase((current) => (current === "error" ? current : "ready"));
        })
        .catch(() => {
          // The model request below reports a failure if this preview also fails.
        });
    }

    const feedRequest = getModelFeed();

    feedRequest
      .then((result) => {
        if (!active) {
          return;
        }
        setPosts(result.feed.posts);
        setDisclaimer(result.feed.disclaimer);
        setSource(result.source);
        setExplanations(Object.fromEntries(result.explanations.map((item) => [item.post_id, item])));
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
  }, [attempt]);

  useFlipReorder(listRef, posts.map((post) => post.id).join(","));

  async function handleLike(post: RankedPost) {
    const existing = interactions[post.id] ?? {
      liked: false,
      likes: post.likes,
      shares: post.shares,
      shareNotice: null,
    };
    const liked = !existing.liked;
    const delta = liked ? 1 : -1;
    setInteractions((current) => ({ ...current, [post.id]: { ...existing, liked } }));
    const saved = await recordEvent({
      post_id: post.id,
      event_type: "like",
      feed_mode: "evidence",
      metadata: { delta },
    });
    if (!saved) {
      setInteractions((current) => ({ ...current, [post.id]: existing }));
      return;
    }
    setPosts((current) =>
      rankPosts(
        current.map((item) =>
          item.id === post.id ? { ...item, likes: Math.max(0, item.likes + delta) } : item,
        ),
        "evidence",
      ),
    );
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
        shareNotice: notice,
      },
    }));

    if (shared) {
      const saved = await recordEvent({ post_id: post.id, event_type: "share", feed_mode: "evidence" });
      if (saved) {
        setPosts((current) =>
          rankPosts(
            current.map((item) => (item.id === post.id ? { ...item, shares: item.shares + 1 } : item)),
            "evidence",
          ),
        );
      }
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

  const statusText = phase === "loading" ? "Loading feed" : "Showing the EvidenceRank feed";

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-muted">
        EvidenceRank asks gpt-4o-mini to label each claim from the public pages, then applies the ranking formula.
        Likes and shares still change the order.
      </p>
      <RankingModeNote usingDemoFixtures={source === "demo"} usingModel={source === "model"} />
      <p className="sr-only" aria-live="polite">
        {refreshing ? "Updating feed" : statusText}
      </p>

      {phase !== "error" && source !== "model" ? (
        <p className="text-sm leading-6 text-muted">
          gpt-4o-mini is labeling the feed from the public pages. The posts stay on screen while that finishes.
        </p>
      ) : null}
      {phase === "loading" && posts.length === 0 ? (
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
              clearModelFeedCache();
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

      {phase !== "error" && posts.length > 0 ? (
        <div className="space-y-4" aria-busy={refreshing}>
          {disclaimer ? <p className="text-xs leading-5 text-muted">{disclaimer}</p> : null}
          {source === "demo" ? (
            <p className="rounded-xl border border-line bg-card px-3 py-2 text-xs leading-5 text-muted">
              Showing local fixtures because the API at the configured address was unreachable.
            </p>
          ) : source === "model" ? (
            <p className="text-xs text-muted">Evidence labels: gpt-4o-mini{refreshing ? " · updating" : ""}</p>
          ) : (
            <p className="text-xs text-muted">Feed data: API{refreshing ? " · updating" : ""}</p>
          )}
          {posts.length === 0 ? (
            <p className="rounded-2xl border border-line bg-card px-4 py-6 text-sm text-muted">No posts in this feed.</p>
          ) : (
            <div ref={listRef} className="space-y-4">
              {posts.map((post) => {
                const state = interactions[post.id];
                return (
                  <div key={post.id} data-flip-key={post.id}>
                    <PostCard
                      post={post}
                      feedMode="evidence"
                      explanation={explanations[post.id] ?? null}
                      liked={state?.liked ?? false}
                      shareNotice={state?.shareNotice ?? null}
                      onLike={() => void handleLike(post)}
                      onShare={() => void handleShare(post)}
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
