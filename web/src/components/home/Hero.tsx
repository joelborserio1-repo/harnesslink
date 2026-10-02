"use client";

import { useState } from "react";
import Link from "next/link";
import Thumb from "@/components/Thumb";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

// The lead-story stage. One story at a time over a full-bleed photograph; the
// reader steps through the top stories with the numbered controls (no
// auto-advance — a carousel that moves on its own costs INP and annoys).
export default function Hero({ slides }: { slides: ArticleSummary[] }) {
  const [i, setI] = useState(0);
  if (slides.length === 0) return null;
  const a = slides[i];
  const go = (d: number) => setI((prev) => (prev + d + slides.length) % slides.length);

  return (
    <section className="relative min-h-[380px] overflow-hidden bg-navy-deep lg:min-h-0" aria-label="Top stories">
      <div className="absolute inset-0">
        <Thumb image={a.image} seed={a.id} alt={a.title} sizes="(max-width: 1024px) 100vw, 640px" eager />
      </div>
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(180deg, rgba(4,12,38,.10) 25%, rgba(4,12,38,.55) 60%, rgba(4,12,38,.93) 100%)" }}
      />

      <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
        {a.category && (
          <Link href={a.category.url} className="kicker border-l-2 border-amber pl-2 !text-white">
            {a.category.name}
          </Link>
        )}
        <h2 className="font-headline mt-3 max-w-[22ch] break-words text-[28px] font-bold leading-[1.1] [text-wrap:balance] sm:text-[36px] lg:text-[27px] xl:text-[38px]">
          <Link href={a.url} className="hl-link">
            {a.title}
          </Link>
        </h2>
        <div className="mt-4 flex items-end justify-between gap-4">
          <p className="meta !text-white/75">
            {a.author && <>By <b className="!text-white">{a.author.name}</b> · </>}
            {a.published_at && <time dateTime={a.published_at}>{formatCardDate(a.published_at)}</time>}
          </p>
          {slides.length > 1 && (
            <div className="flex shrink-0 items-center gap-3 text-white">
              <span className="text-[12px] font-semibold tabular-nums tracking-[0.12em] text-white/75" aria-live="polite">
                {String(i + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
              </span>
              <span className="flex border border-white/40">
                <button onClick={() => go(-1)} aria-label="Previous story" className="grid h-9 w-9 place-items-center hover:bg-white hover:text-navy">
                  <Arrow dir="left" />
                </button>
                <button onClick={() => go(1)} aria-label="Next story" className="grid h-9 w-9 place-items-center border-l border-white/40 hover:bg-white hover:text-navy">
                  <Arrow dir="right" />
                </button>
              </span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Arrow({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
      <path d={dir === "left" ? "M19 12H5m6-6l-6 6 6 6" : "M5 12h14m-6-6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
