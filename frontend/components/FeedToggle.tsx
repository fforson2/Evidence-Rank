"use client";

import type { FeedMode } from "@/types";

type FeedToggleProps = {
  mode: FeedMode;
  onChange: (mode: FeedMode) => void;
};

const OPTIONS: { mode: FeedMode; label: string; hint: string }[] = [
  { mode: "engagement", label: "Engagement", hint: "Likes and shares" },
  { mode: "evidence", label: "EvidenceRank", hint: "Engagement plus reviewed evidence" },
];

export function FeedToggle({ mode, onChange }: FeedToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Feed ranking mode"
      className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-card p-1"
      onKeyDown={(event) => {
        if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
          return;
        }
        event.preventDefault();
        onChange(mode === "engagement" ? "evidence" : "engagement");
      }}
    >
      {OPTIONS.map((option) => {
        const selected = option.mode === mode;
        const selectedClass =
          option.mode === "evidence" ? "bg-accent text-white" : "bg-copper text-white";

        return (
          <button
            key={option.mode}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.mode)}
            className={`rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              selected ? selectedClass : "text-foreground hover:bg-foreground/5"
            }`}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className={`mt-0.5 block text-xs ${selected ? "text-white/80" : "text-muted"}`}>
              {option.hint}
            </span>
          </button>
        );
      })}
    </div>
  );
}
