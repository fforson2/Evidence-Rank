"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <div role="alert" className="rounded-2xl border border-danger/30 bg-card px-4 py-6">
        <h1 className="text-base font-semibold">This page could not be displayed</h1>
        <p className="mt-2 text-sm leading-6 text-muted">Refresh the page or try the action again.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-full bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
