"use client";

import { useRef, type KeyboardEvent } from "react";
import { FEED_MODE_DETAILS, FEED_MODES } from "@/lib/feed-mode";
import type { FeedMode } from "@/types";

type FeedToggleProps = {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
};

const SELECTED_CLASS: Record<FeedMode, string> = {
  engagement: "bg-copper text-white",
  evidence: "bg-accent text-white",
};

export function FeedToggle({ mode, onChange }: FeedToggleProps) {
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const count = FEED_MODES.length;
    const current = FEED_MODES.indexOf(mode);
    let next: number;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = (current + 1) % count;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = (current - 1 + count) % count;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    onChange(FEED_MODES[next]);
    optionRefs.current[next]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label="Feed ranking mode"
      className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-1"
      onKeyDown={handleKeyDown}
    >
      {FEED_MODES.map((option, index) => {
        const selected = option === mode;
        const details = FEED_MODE_DETAILS[option];

        return (
          <button
            key={option}
            ref={(element) => {
              optionRefs.current[index] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            title={details.description}
            onClick={() => onChange(option)}
            className={`min-w-0 rounded-xl px-3 py-2 text-left transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected ? SELECTED_CLASS[option] : "text-foreground hover:bg-foreground/5"
            }`}
          >
            <span className="block text-sm font-semibold">{details.label}</span>
            <span className={`mt-0.5 block text-xs leading-snug ${selected ? "text-white/80" : "text-muted"}`}>
              {details.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
