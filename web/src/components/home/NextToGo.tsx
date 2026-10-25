"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { raceHref } from "@/lib/racingLinks";
import type { BoardRace, RaceBoard } from "@/lib/harnesslink";

// Live AU and NZ harness races from the HarnessLink API (TAB + HRNZ), loaded
// server-side in lib/harnesslink.ts; this component only counts down and switches tabs.

const COLS = ["navy", "amber", "red"] as const;

const BADGE: Record<string, string> = {
  navy: "bg-navy text-white",
  red: "bg-red text-white",
  amber: "bg-amber text-[#241a00]",
};

function countdown(s: number) {
  if (s <= 0) return "Closed";
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}m`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const country = (c: string) => (c === "AU" ? "AUS" : c);

function FallbackSilk({ seed }: { seed: number }) {
  const cols = ["#1f5bd0", "#0a2a6b", "#12857f", "#c2620a", "#6a3fae", "#1f9d5e"];
  const a = cols[seed % cols.length];
  const b = cols[(seed + 2) % cols.length];
  return (
    <svg viewBox="0 0 22 26" className="h-[26px] w-[22px]" aria-hidden="true">
      {seed % 3 === 0 && (<><rect width="22" height="26" fill={a} /><rect width="22" height="9" fill={b} /></>)}
      {seed % 3 === 1 && (<><rect width="22" height="26" fill={b} /><rect x="8" width="6" height="26" fill={a} /></>)}
      {seed % 3 === 2 && (<><rect width="22" height="26" fill={a} /><circle cx="11" cy="13" r="6" fill={b} /></>)}
    </svg>
  );
}

function Silk({ path, seed }: { path: string | null; seed: number }) {
  if (!path) return <FallbackSilk seed={seed} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/silk/?p=${encodeURIComponent(path)}`} alt="" width={22} height={26} className="h-[26px] w-[22px] object-contain" />;
}

function Row({ r, i, side, children }: { r: BoardRace; i: number; side: ReactNode; children: ReactNode }) {
  return (
    <Link href={raceHref(r.id)} className="grid grid-cols-[52px_1fr_auto_auto] items-center gap-3 border-b border-line px-3.5 py-3 last:border-0 hover:bg-[#f7f9fd]">
      <div className="flex flex-col items-center gap-1">
        <span className={`grid h-[34px] w-[34px] place-items-center text-[13px] font-extrabold ${BADGE[COLS[i % COLS.length]]}`}>R{r.number}</span>
        {side}
      </div>
      <div className="min-w-0">
        <b className="block truncate text-sm leading-tight text-ink">{r.venue}</b>
        {children}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-extrabold tabular-nums text-navy">{r.runner?.number ?? ""}</span>
        <Silk path={r.runner?.silk ?? null} seed={i} />
      </div>
      <span className="min-w-[52px] bg-[#eef0f4] px-2.5 py-1 text-center text-[13px] font-bold tabular-nums text-[#2b303a]">
        {r.runner?.price ?? "–"}
      </span>
    </Link>
  );
}

export default function NextToGo({ board }: { board: RaceBoard }) {
  const [tab, setTab] = useState<"ntg" | "res">(board.next.length ? "ntg" : "res");
  // Start from the server's clock so the first render matches, then tick each second.
  const [now, setNow] = useState(() => Date.parse(board.generatedAt));

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const secs = (r: BoardRace) => (r.startTime ? Math.round((Date.parse(r.startTime) - now) / 1000) : 0);
  const rows = tab === "ntg" ? board.next : board.results;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-stretch border-b border-line" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "ntg"}
          onClick={() => setTab("ntg")}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-[0.12em] ${tab === "ntg" ? "text-blue" : "text-neutral-400"}`}
        >
          Next To Go
        </button>
        <span className="w-px bg-line" />
        <button
          role="tab"
          aria-selected={tab === "res"}
          onClick={() => setTab("res")}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-[0.12em] ${tab === "res" ? "text-blue" : "text-neutral-400"}`}
        >
          Results
        </button>
      </div>

      <div className="flex flex-col">
        {rows.length === 0 && (
          <p className="px-3.5 py-6 text-center text-sm text-muted">
            {tab === "ntg" ? "No more harness races today." : "No results yet today."}
          </p>
        )}
        {tab === "ntg"
          ? rows.map((r, i) => (
              <Row
                key={r.id}
                r={r}
                i={i}
                side={<span className={`text-[11px] font-bold tabular-nums ${secs(r) < 300 ? "text-red" : "text-neutral-400"}`}>{countdown(secs(r))}</span>}
              >
                <span className="text-[11.5px] text-muted">{country(r.country)}{r.distance ? ` · ${r.distance}` : ""}</span>
              </Row>
            ))
          : rows.map((r, i) => (
              <Row key={r.id} r={r} i={i} side={<span className="text-[10px] font-bold text-neutral-400">FINAL</span>}>
                <span className="block truncate text-[11.5px] text-muted">
                  {r.runner ? `Winner: ${r.runner.horse}` : `${country(r.country)}${r.distance ? ` · ${r.distance}` : ""}`}
                </span>
              </Row>
            ))}
      </div>

      <Link href={tab === "ntg" ? "/racing/" : "/racing/nz/results/"} className="block border-t border-line py-3 text-center text-xs font-bold uppercase tracking-wider text-blue hover:bg-[#f7f9fd]">
        {tab === "ntg" ? "All fields" : "All results & replays"} →
      </Link>
      <p className="border-t border-line py-2.5 text-center text-[11px] text-muted">
        {tab === "ntg" ? "Favourite's fixed odds" : "Winner's final fixed odds"} · TAB and HRNZ data · Gamble responsibly
      </p>
    </div>
  );
}
