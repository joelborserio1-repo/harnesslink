"use client";

import { useEffect, useState } from "react";

type Race = {
  no: string;
  col: "navy" | "red" | "amber";
  sec: number;
  track: string;
  st: string;
  dist: string;
  num: number;
  odds: string;
  star?: boolean;
};

// Sample data until a live racing feed (HRA / HRNZ / USTA or a provider) is wired.
const RACES: Race[] = [
  { no: "R1", col: "navy", sec: 42, track: "Menangle", st: "NSW", dist: "1609m", num: 4, odds: "$3.40" },
  { no: "R4", col: "amber", sec: 135, track: "Albion Park", st: "QLD", dist: "2138m", num: 7, odds: "$5.50", star: true },
  { no: "R2", col: "red", sec: 288, track: "Addington", st: "NZ", dist: "1980m", num: 1, odds: "$2.10" },
  { no: "R6", col: "navy", sec: 392, track: "Gloucester Park", st: "WA", dist: "2130m", num: 9, odds: "$8.00" },
  { no: "R3", col: "amber", sec: 552, track: "The Meadowlands", st: "USA", dist: "1609m", num: 3, odds: "$4.20", star: true },
  { no: "R5", col: "red", sec: 765, track: "Menangle", st: "NSW", dist: "2300m", num: 6, odds: "$15.0" },
];

const RESULTS = [
  { no: "R7", col: "navy", track: "Bathurst", st: "NSW", dist: "1730m", placing: "1st", odds: "$2.60" },
  { no: "R6", col: "amber", track: "Melton", st: "VIC", dist: "1720m", placing: "1st", odds: "$1.90" },
  { no: "R8", col: "red", track: "Cambridge", st: "NZ", dist: "2200m", placing: "1st", odds: "$3.10" },
  { no: "R5", col: "navy", track: "Northfield", st: "USA", dist: "1609m", placing: "1st", odds: "$4.40" },
  { no: "R4", col: "amber", track: "Menangle", st: "NSW", dist: "1609m", placing: "1st", odds: "$1.40" },
  { no: "R3", col: "red", track: "Addington", st: "NZ", dist: "1980m", placing: "1st", odds: "$2.20" },
] as const;

const BADGE: Record<string, string> = {
  navy: "bg-navy text-white",
  red: "bg-red text-white",
  amber: "bg-amber text-[#241a00]",
};

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Silk({ seed }: { seed: number }) {
  const cols = ["#1f5bd0", "#0a2a6b", "#12857f", "#c2620a", "#6a3fae", "#1f9d5e"];
  const a = cols[seed % cols.length];
  const b = cols[(seed + 2) % cols.length];
  return (
    <svg viewBox="0 0 22 26" className="h-[26px] w-[22px] rounded-[3px] shadow" aria-hidden="true">
      {seed % 3 === 0 && (<><rect width="22" height="26" fill={a} /><rect width="22" height="9" fill={b} /></>)}
      {seed % 3 === 1 && (<><rect width="22" height="26" fill={b} /><rect x="8" width="6" height="26" fill={a} /></>)}
      {seed % 3 === 2 && (<><rect width="22" height="26" fill={a} /><circle cx="11" cy="13" r="6" fill={b} /></>)}
    </svg>
  );
}

export default function NextToGo() {
  const [tab, setTab] = useState<"ntg" | "res">("ntg");
  const [secs, setSecs] = useState(RACES.map((r) => r.sec));

  useEffect(() => {
    const id = setInterval(() => setSecs((prev) => prev.map((s) => (s > 0 ? s - 1 : 0))), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-stretch border-b border-line" role="tablist">
        <button
          role="tab"
          onClick={() => setTab("ntg")}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-[0.12em] ${tab === "ntg" ? "text-blue" : "text-neutral-400"}`}
        >
          Next To Go
        </button>
        <span className="w-px bg-line" />
        <button
          role="tab"
          onClick={() => setTab("res")}
          className={`flex-1 py-3.5 text-xs font-bold uppercase tracking-[0.12em] ${tab === "res" ? "text-blue" : "text-neutral-400"}`}
        >
          Results
        </button>
      </div>

      <div className="flex flex-col">
        {tab === "ntg"
          ? RACES.map((r, i) => (
              <a key={i} href="/" className="grid grid-cols-[52px_1fr_auto_auto] items-center gap-3 border-b border-line px-3.5 py-3 last:border-0 hover:bg-[#f7f9fd]">
                <div className="flex flex-col items-center gap-1">
                  <span className={`grid h-[34px] w-[34px] place-items-center rounded-full text-[13px] font-extrabold ${BADGE[r.col]}`}>{r.no}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${secs[i] < 300 ? "text-red" : "text-neutral-400"}`}>{fmt(secs[i])}</span>
                </div>
                <div>
                  <b className="block text-sm leading-tight text-ink">{r.track}</b>
                  <span className="text-[11.5px] text-muted">{r.st} · {r.dist}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold tabular-nums text-navy">{r.num}</span>
                  <Silk seed={i} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#eef0f4] px-2.5 py-1 text-[13px] font-bold tabular-nums text-[#2b303a]">{r.odds}{r.star ? " *" : ""}</span>
                  <span className="text-lg text-neutral-300">›</span>
                </div>
              </a>
            ))
          : RESULTS.map((r, i) => (
              <a key={i} href="/" className="grid grid-cols-[52px_1fr_auto_auto] items-center gap-3 border-b border-line px-3.5 py-3 last:border-0 hover:bg-[#f7f9fd]">
                <div className="flex flex-col items-center gap-1">
                  <span className={`grid h-[34px] w-[34px] place-items-center rounded-full text-[13px] font-extrabold ${BADGE[r.col]}`}>{r.no}</span>
                  <span className="text-[10px] font-bold text-neutral-400">FINAL</span>
                </div>
                <div>
                  <b className="block text-sm leading-tight text-ink">{r.track}</b>
                  <span className="text-[11.5px] text-muted">{r.st} · {r.dist}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-navy">{r.placing}</span>
                  <Silk seed={i} />
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#eef0f4] px-2.5 py-1 text-[13px] font-bold tabular-nums text-[#2b303a]">{r.odds}</span>
                  <span className="text-lg text-neutral-300">›</span>
                </div>
              </a>
            ))}
      </div>

      <div className="py-3 text-center">
        <a href="/" className="text-xs font-bold uppercase tracking-wider text-blue">View all races →</a>
      </div>
    </div>
  );
}
