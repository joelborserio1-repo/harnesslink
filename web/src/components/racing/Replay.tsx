"use client";

import { useState } from "react";

// Race replay played on our page. Nothing loads from YouTube until the reader presses play
// (privacy-enhanced youtube-nocookie player, no related videos from other channels).
export default function Replay({ id, title }: { id: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  return (
    <div className="relative aspect-video w-full overflow-hidden bg-navy">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} className="group absolute inset-0 h-full w-full text-left" aria-label={`Play replay: ${title}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-70 transition group-hover:opacity-85" />
          <span className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-transparent" />
          <span className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center bg-amber text-[#1d1500] transition group-hover:scale-105">
            <svg viewBox="0 0 24 24" className="ml-1 h-7 w-7" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" /></svg>
          </span>
          <span className="absolute bottom-0 left-0 p-4 text-white">
            <span className="kicker block text-amber!">Race replay</span>
            <span className="mt-1 block font-display text-[22px] font-bold uppercase leading-tight">{title}</span>
          </span>
        </button>
      )}
    </div>
  );
}
