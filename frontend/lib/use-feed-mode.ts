import { useSyncExternalStore } from "react";
import { DEFAULT_FEED_MODE, isFeedMode } from "@/lib/feed-mode";
import type { FeedMode } from "@/types";

const STORAGE_KEY = "evidencerank:ranking-view";

/** Values saved by the earlier three-mode toggle. Evidence Strength is no longer a feed mode. */
const LEGACY_MODES = new Map<string, FeedMode>([
  ["evidence_rank", "evidence"],
  ["evidence_strength", DEFAULT_FEED_MODE],
  ["evidence-strength", DEFAULT_FEED_MODE],
]);

const listeners = new Set<() => void>();
/** Keeps the selection working when localStorage is unavailable (private mode, blocked storage). */
let memoryMode: FeedMode | null = null;
let migrated = false;

function parseMode(value: string | null): FeedMode | null {
  if (isFeedMode(value)) {
    return value;
  }
  return value === null ? null : (LEGACY_MODES.get(value) ?? null);
}

function readMode(): FeedMode {
  try {
    const stored = parseMode(window.localStorage.getItem(STORAGE_KEY));
    if (stored) {
      return stored;
    }
  } catch {
    // Storage is unavailable. Fall back to the in-memory selection.
  }
  return memoryMode ?? DEFAULT_FEED_MODE;
}

/** Rewrites a legacy or unrecognised saved value once, so storage only ever holds a current mode. */
function migrateStoredMode() {
  if (migrated) {
    return;
  }
  migrated = true;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null || isFeedMode(stored)) {
      return;
    }
    const mode = parseMode(stored);
    if (mode) {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage is unavailable. Nothing to migrate.
  }
}

function subscribe(listener: () => void): () => void {
  migrateStoredMode();
  listeners.add(listener);
  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      listener();
    }
  }
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function writeMode(mode: FeedMode) {
  memoryMode = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage is unavailable. The in-memory selection still applies for this session.
  }
  listeners.forEach((listener) => listener());
}

/**
 * The selected feed mode, persisted in localStorage. The server snapshot is always the default,
 * so hydration matches the prerendered HTML before the saved mode is applied.
 */
export function useFeedMode(): [FeedMode, (mode: FeedMode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, () => DEFAULT_FEED_MODE);
  return [mode, writeMode];
}
