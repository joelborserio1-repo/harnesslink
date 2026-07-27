"use client";

import { useState } from "react";
import Link from "next/link";
import { SafeImg } from "./SafeImg";
import { formatCents, pct } from "@/lib/money";

export type FeaturedOffering = {
  slug: string;
  name: string;
  discipline: string;
  tagline: string;
  description: string;
  heroColor: string;
  imageUrl: string;
  sharePriceCents: number;
  totalShares: number;
  sharesSold: number;
  status: string;
};

// Bold dark poster (contrasts the light section). Uses the photo when present,
// falling back to the branded green card if there's no photo (or it 404s).
function Poster({ o }: { o: FeaturedOffering }) {
  return (
    <SafeImg
      src={o.imageUrl}
      alt={o.name}
      className="h-full w-full rounded-xl object-cover"
      fallback={<GraphicPoster o={o} />}
    />
  );
}

function GraphicPoster({ o }: { o: FeaturedOffering }) {
  return (
    <div className="relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-green-800 to-green-900 p-7">
      <div
        aria-hidden
        className="absolute -right-10 top-6 h-40 w-40 rounded-full bg-gold/10 blur-2xl"
      />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-widest text-sage">
          {o.discipline}
        </p>
        <p className="font-heading text-4xl font-bold leading-none text-cream">
          {o.name}
        </p>
      </div>
      <div className="relative">
        <p className="font-heading text-5xl font-bold text-gold">
          {formatCents(o.sharePriceCents)}
        </p>
        <p className="text-xs font-semibold uppercase tracking-widest text-sage">
          per share
        </p>
      </div>
    </div>
  );
}

export function FeaturedCarousel({ offerings }: { offerings: FeaturedOffering[] }) {
  const [i, setI] = useState(0);
  if (offerings.length === 0) return null;
  const o = offerings[i];
  const remaining = o.totalShares - o.sharesSold;
  const go = (d: number) =>
    setI((n) => (n + d + offerings.length) % offerings.length);

  const perks = [
    "Buy in from " + formatCents(o.sharePriceCents) + ", all training and care covered",
    "Owner updates, stable access and race-day invites",
    "Prizemoney paid to your wallet, split by your shares",
  ];

  return (
    <div className="rounded-2xl border border-paper-200 bg-white p-5 shadow-sm md:p-8">
      <div className="grid items-center gap-8 md:grid-cols-2">
        {/* left: details (dark text on white) */}
        <div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center rounded-full border border-green-600/40 bg-green-800/5 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-800">
              {o.status === "OPEN" ? "Open now" : o.status.toLowerCase()}
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-green-600">
              {String(i + 1).padStart(2, "0")} / {String(offerings.length).padStart(2, "0")}
            </span>
          </div>

          <h3 className="mt-4 font-heading text-4xl font-bold tracking-tight text-green-900">
            {o.name}
          </h3>
          <p className="mt-3 font-heading text-3xl font-bold text-gold">
            From {formatCents(o.sharePriceCents)}
            <span className="ml-2 text-sm font-normal text-green-600">per share</span>
          </p>

          <p className="mt-4 text-green-800">{o.tagline}</p>

          <ul className="mt-5 space-y-2.5">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-green-800">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-green-800 text-[11px] text-gold">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-3">
            <Link
              href={`/offerings/${o.slug}`}
              className="inline-flex items-center justify-center rounded-md border border-green-600 px-5 py-2.5 text-sm font-semibold text-green-900 transition hover:bg-green-800/5"
            >
              Learn more
            </Link>
            <Link
              href={`/offerings/${o.slug}`}
              className="inline-flex items-center justify-center rounded-md bg-gold px-5 py-2.5 text-sm font-semibold text-[#2A2008] transition hover:bg-gold-deep"
            >
              Buy now
            </Link>
          </div>

          <div className="mt-4 text-xs text-green-600">
            {pct(o.sharesSold, o.totalShares).toFixed(0)}% subscribed ·{" "}
            {remaining.toLocaleString()} shares left
          </div>
        </div>

        {/* right: poster + arrows */}
        <div className="relative">
          <div className="aspect-square w-full">
            <Poster o={o} />
          </div>
          {offerings.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                aria-label="Previous"
                className="absolute -left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-green-600 bg-white text-green-900 shadow-sm transition hover:bg-green-800 hover:text-cream"
              >
                ‹
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next"
                className="absolute -right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-green-600 bg-white text-green-900 shadow-sm transition hover:bg-green-800 hover:text-cream"
              >
                ›
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
