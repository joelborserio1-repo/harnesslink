"use client";

import { useState } from "react";
import Link from "next/link";
import Thumb from "@/components/Thumb";
import type { ArticleSummary } from "@/lib/api";
import { formatCardDate } from "@/lib/format";

export default function Hero({ slides }: { slides: ArticleSummary[] }) {
  const [i, setI] = useState(0);
  if (slides.length === 0) return null;
  const a = slides[i];
  const go = (d: number) => setI((prev) => (prev + d + slides.length) % slides.length);

  return (
    <section className="relative aspect-[16/9] overflow-hidden rounded-xl bg-navy shadow-[0_6px_20px_rgba(8,31,91,0.15)] md:aspect-[16/8]" aria-label="Featured story">
      <div className="absolute inset-0">
        <Thumb image={a.image} seed={a.id} alt={a.title} sizes="(max-width: 1024px) 100vw, 800px" />
      </div>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(4,12,38,.05) 30%, rgba(4,12,38,.86) 100%)" }} />

      <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
        {a.category && (
          <span className="inline-flex items-center gap-1.5 rounded bg-navy px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
            🌐 {a.category.name}
          </span>
        )}
        <h1 className="font-headline mt-3 max-w-[20ch] text-2xl font-bold leading-[1.12] [text-wrap:balance] sm:text-4xl" style={{ textShadow: "0 2px 18px rgba(0,0,0,.35)" }}>
          <Link href={a.url}>{a.title}</Link>
        </h1>
        <div className="mt-2 text-sm text-[#d6def4]">
          {a.author && <span>By {a.author.name} · </span>}
          {a.published_at && <time>{formatCardDate(a.published_at)}</time>}
        </div>
      </div>

      {slides.length > 1 && (
        <>
          <div className="absolute bottom-6 left-7 flex gap-2" aria-hidden="true">
            {slides.map((_, n) => (
              <i key={n} className={`h-2 rounded-full transition-all ${n === i ? "w-5 bg-white" : "w-2 bg-white/45"}`} />
            ))}
          </div>
          <div className="absolute bottom-5 right-5 flex gap-2">
            <button onClick={() => go(-1)} aria-label="Previous" className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-[#0814364d] text-white hover:bg-navy">‹</button>
            <button onClick={() => go(1)} aria-label="Next" className="grid h-9 w-9 place-items-center rounded-full border border-white/50 bg-[#0814364d] text-white hover:bg-navy">›</button>
          </div>
        </>
      )}
    </section>
  );
}
