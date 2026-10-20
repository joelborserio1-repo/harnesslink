"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Thumb from "@/components/Thumb";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

const ROTATE_MS = 7000;

// The lead-story slider, as on the live site: a big photograph with the
// section label (black box), the headline in large Playfair and a bar + date.
// Advances every 7 seconds; pauses while the reader hovers or focuses it.
export default function Hero({ slides }: { slides: ArticleSummary[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const go = useCallback((d: number) => setI((p) => (p + d + slides.length) % slides.length), [slides.length]);

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => go(1), ROTATE_MS);
    return () => clearTimeout(t);
  }, [i, paused, go, slides.length]);

  if (slides.length === 0) return null;
  const a = slides[i];

  return (
    <section
      className="relative h-[380px] overflow-hidden bg-[#212121] sm:h-[440px]"
      aria-label="Top stories"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div key={a.id} className="absolute inset-0 animate-[fade_600ms_ease]">
        <Thumb image={a.image} seed={a.id} alt="" sizes="(max-width: 1024px) 100vw, 700px" eager />
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.25) 55%, rgba(0,0,0,.05) 100%), linear-gradient(0deg, rgba(0,0,0,.45), rgba(0,0,0,0) 60%)" }} />

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-6 text-white sm:px-[61px]">
        {a.category && (
          <Link href={a.category.url} className="font-ui inline-block bg-black px-2 py-1 text-[11px] font-medium uppercase leading-none tracking-wide text-white">
            {a.category.name}
          </Link>
        )}
        <h2 className="font-headline mt-4 max-w-[17ch] text-[30px] font-bold leading-[1.1] tracking-[-0.04em] [text-wrap:balance] sm:text-[40px] sm:leading-[44px]">
          <Link href={a.url} className="hl-link">
            {a.title}
          </Link>
        </h2>
        <div className="font-ui mt-6 flex items-center gap-[38px] text-[11px] uppercase">
          <span className="h-[3px] w-[35px] bg-white" aria-hidden />
          {a.published_at && <time dateTime={a.published_at}>{formatCardDate(a.published_at)}</time>}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous story" className="absolute left-0 top-1/2 grid h-12 w-9 -translate-y-1/2 place-items-center bg-black/35 text-white hover:bg-black/60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden><path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <button onClick={() => go(1)} aria-label="Next story" className="absolute right-0 top-1/2 grid h-12 w-9 -translate-y-1/2 place-items-center bg-black/35 text-white hover:bg-black/60">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden><path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2" role="tablist" aria-label="Choose a story">
            {slides.map((s, n) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={n === i}
                aria-label={`Story ${n + 1}: ${s.title}`}
                onClick={() => setI(n)}
                className={`h-[3px] w-7 ${n === i ? "bg-white" : "bg-white/40 hover:bg-white/70"}`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
