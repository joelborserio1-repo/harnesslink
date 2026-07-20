"use client";

import { useEffect, useRef, useState } from "react";
import { RACING } from "@/lib/racing";

// The "Racing" mega-menu: hover to open, hover a country on the left to reveal
// its Fields / Results & Replays links (which open the authority's site) on the
// right. Also opens on click/focus for touch + keyboard.
export default function RacingMenu() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const country = RACING[active];

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 whitespace-nowrap border-b-2 border-transparent py-3 text-sm font-semibold uppercase tracking-wide text-white/90 hover:border-accent hover:text-white"
      >
        Racing
        <span aria-hidden className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 flex overflow-hidden rounded-b-md border border-white/10 bg-navy shadow-2xl"
        >
          {/* Countries */}
          <ul className="w-48 border-r border-white/10 py-1">
            {RACING.map((c, i) => (
              <li key={c.code}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  aria-current={i === active ? "true" : undefined}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-[15px] font-semibold ${
                    i === active ? "bg-white/10 text-white" : "text-white/85 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span aria-hidden className="text-lg leading-none">{c.flag}</span>
                    {c.name}
                  </span>
                  <span aria-hidden className="text-white/50">›</span>
                </button>
              </li>
            ))}
          </ul>

          {/* Fields / Results for the active country */}
          <div className="w-56 py-2">
            <p className="px-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-white/45">
              {country.name}
            </p>
            <a
              href={country.fields}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="block px-4 py-2.5 text-[15px] font-semibold text-white/90 hover:bg-white/10 hover:text-white"
            >
              Fields
            </a>
            <a
              href={country.results}
              target="_blank"
              rel="noopener noreferrer"
              role="menuitem"
              className="block px-4 py-2.5 text-[15px] font-semibold text-white/90 hover:bg-white/10 hover:text-white"
            >
              Results &amp; Replays
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
