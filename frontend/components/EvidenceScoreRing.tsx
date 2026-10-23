import type { CSSProperties, ReactNode } from "react";

type EvidenceScoreRingProps = {
  /** 0 to 100, or null for an unscored item (drawn as a dashed track). */
  score: number | null;
  size: number;
  strokeWidth: number;
  toneClass: string;
  children?: ReactNode;
};

/** Decorative only. Callers provide the accessible text for the score. */
export function EvidenceScoreRing({ score, size, strokeWidth, toneClass, children }: EvidenceScoreRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const fraction = score === null ? 0 : Math.min(Math.max(score, 0), 100) / 100;
  const center = size / 2;

  return (
    <span
      aria-hidden
      className="relative inline-flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={score === null ? `${strokeWidth} ${strokeWidth * 1.5}` : undefined}
          className={score === null ? "text-muted/40" : "text-foreground/10"}
        />
        {/* A zero-length arc with round caps would still render a dot, so 0 draws no arc. */}
        {fraction > 0 ? (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={
              {
                "--ring-empty": `${circumference}px`,
                "--ring-offset": `${circumference * (1 - fraction)}px`,
              } as CSSProperties
            }
            className={`${toneClass} [stroke-dashoffset:var(--ring-offset)] motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out motion-safe:starting:[stroke-dashoffset:var(--ring-empty)]`}
          />
        ) : null}
      </svg>
      {children ? (
        <span className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</span>
      ) : null}
    </span>
  );
}
