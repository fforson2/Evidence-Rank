"use client";

import { useState } from "react";

type VideoPostProps = {
  src: string;
  caption: string;
};

export function VideoPost({ src, caption }: VideoPostProps) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className="space-y-3">
      {failed ? (
        <div className="flex aspect-video items-center justify-center rounded-xl bg-foreground/5 px-4 text-center text-sm text-muted">
          This demo video could not be loaded.
        </div>
      ) : (
        <video
          className="aspect-video w-full rounded-xl bg-foreground"
          controls
          playsInline
          preload="metadata"
          src={src}
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="text-[15px] leading-7 text-foreground">{caption}</figcaption>
    </figure>
  );
}
