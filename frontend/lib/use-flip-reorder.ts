import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Animates `[data-flip-key]` children from the positions recorded by `capture()` to their new
 * positions after `orderKey` changes. Skipped when the user prefers reduced motion.
 */
export function useFlipReorder(containerRef: RefObject<HTMLElement | null>, orderKey: string): () => void {
  const captured = useRef<Map<string, number> | null>(null);

  const capture = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const positions = new Map<string, number>();
    container.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((element) => {
      const key = element.dataset.flipKey;
      if (key) {
        positions.set(key, element.getBoundingClientRect().top + window.scrollY);
      }
    });
    captured.current = positions;
  }, [containerRef]);

  useLayoutEffect(() => {
    const previous = captured.current;
    const container = containerRef.current;
    if (!previous || !container) {
      return;
    }
    captured.current = null;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    container.querySelectorAll<HTMLElement>("[data-flip-key]").forEach((element) => {
      const before = previous.get(element.dataset.flipKey ?? "");
      if (before === undefined) {
        return;
      }
      const delta = before - (element.getBoundingClientRect().top + window.scrollY);
      if (Math.abs(delta) < 1) {
        return;
      }
      element.animate([{ transform: `translateY(${delta}px)` }, { transform: "translateY(0)" }], {
        duration: 300,
        easing: "cubic-bezier(0.2, 0, 0, 1)",
      });
    });
  }, [containerRef, orderKey]);

  return capture;
}
