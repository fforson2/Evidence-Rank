"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

type EvidenceStrengthDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
};

/**
 * Native modal dialog: the browser traps focus, closes on Escape, makes the page inert,
 * and returns focus to the trigger on close. Renders as a bottom sheet on small screens.
 */
export function EvidenceStrengthDialog({ open, onClose, title, description, children }: EvidenceStrengthDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const pointerDownOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
      bodyRef.current?.scrollTo({ top: 0 });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      onPointerDown={(event) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (pointerDownOnBackdrop.current && event.target === event.currentTarget) {
          event.currentTarget.close();
        }
        pointerDownOnBackdrop.current = false;
      }}
      className="m-0 mt-auto w-full max-w-full max-h-[92dvh] overflow-hidden rounded-t-2xl border border-line bg-card p-0 text-foreground shadow-[0_-8px_40px_rgba(28,36,48,0.18)] backdrop:bg-[rgba(28,36,48,0.45)] backdrop:backdrop-blur-[2px] sm:m-auto sm:w-[calc(100%-2rem)] sm:max-w-lg sm:max-h-[85dvh] sm:rounded-2xl sm:shadow-[0_24px_64px_rgba(28,36,48,0.22)] motion-safe:transition-[opacity,translate] motion-safe:duration-200 motion-safe:ease-out motion-safe:starting:translate-y-6 motion-safe:starting:opacity-0"
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 line-clamp-2 text-xs leading-5 break-words text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="-mr-1.5 shrink-0 rounded-full p-1.5 text-muted transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="sr-only">Close</span>
            <svg aria-hidden viewBox="0 0 20 20" className="h-5 w-5">
              <path d="M5 5l10 10M15 5L5 15" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div ref={bodyRef} className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </dialog>
  );
}
