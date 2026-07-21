"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoMark } from "./Logo";
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

function Poster({ o }: { o: FeaturedOffering }) {
  const gold = o.heroColor !== "green";
  if (o.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={o.imageUrl}
        alt={o.name}
        className="h-full w-full rounded-xl object-cover"
      />
    );
  }
  // Branded graphic fallback when there's no photo yet.
  return (
    <div
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden rounded-xl p-7 ${
        gold ? "bg-gradient-to-br from-gold-500 to-gold-700" : "bg-racing-900"
      }`}
    >
      <div
        aria-hidden
        className="absolute -right-8 -top-8 opacity-20"
      >
        <LogoMark className="h-56 w-56 [&_path]:!fill-racing-950" />
      </div>
      <div className="relative">
        <p
          className={`text-xs font-bold uppercase tracking-widest ${
            gold ? "text-racing-950/70" : "text-gold-300"
          }`}
        >
          {o.discipline}
        </p>
        <p
          className={`font-heading text-4xl font-bold leading-none ${
            gold ? "text-racing-950" : "text-cream"
          }`}
        >
          {o.name}
        </p>
      </div>
      <div className="relative">
        <p
          className={`font-heading text-5xl font-bold ${
            gold ? "text-racing-950" : "text-gold"
          }`}
        >
          {formatCents(o.sharePriceCents)}
        </p>
        <p
          className={`text-xs font-semibold uppercase tracking-widest ${
            gold ? "text-racing-950/70" : "text-cream/60"
          }`}
        >
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
    "Prizemoney paid to your winnings, split by your shares",
  ];

  return (
    <div className="rounded-2xl bg-racing-975/60 p-5 md:p-8">
      <div className="grid items-center gap-8 md:grid-cols-2">
        {/* left: details */}
        <div>
          <div className="flex items-center gap-3">
            <span className="badge-open">
              {o.status === "OPEN" ? "Open now" : o.status.toLowerCase()}
            </span>
            <span className="text-xs font-semibold uppercase tracking-widest text-cream/45">
              {String(i + 1).padStart(2, "0")} / {String(offerings.length).padStart(2, "0")}
            </span>
          </div>

          <h3 className="mt-4 font-heading text-4xl font-bold text-cream">
            {o.name}
          </h3>
          <p className="mt-3 font-heading text-3xl font-bold text-gold">
            From {formatCents(o.sharePriceCents)}
            <span className="ml-2 text-sm font-normal text-cream/50">
              per share
            </span>
          </p>

          <p className="mt-4 text-cream/70">{o.tagline}</p>

          <ul className="mt-5 space-y-2.5">
            {perks.map((p) => (
              <li key={p} className="flex items-start gap-3 text-sm text-cream/75">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold/15 text-[11px] text-gold">
                  ✓
                </span>
                {p}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex items-center gap-3">
            <Link href={`/offerings/${o.slug}`} className="btn-outline">
              Learn more
            </Link>
            <Link href={`/offerings/${o.slug}`} className="btn-gold">
              Buy now
            </Link>
          </div>

          <div className="mt-4 text-xs text-cream/45">
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
                className="absolute -left-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-racing-950/80 text-gold hover:bg-gold hover:text-racing-950"
              >
                ‹
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next"
                className="absolute -right-3 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-gold/40 bg-racing-950/80 text-gold hover:bg-gold hover:text-racing-950"
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
