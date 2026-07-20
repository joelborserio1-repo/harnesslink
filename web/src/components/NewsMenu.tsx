"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COUNTRIES, countryHref } from "@/lib/countries";

// The "News" nav item — a dropdown of the country sections. Click to toggle;
// closes on outside click or Escape. Matches the navy primary-nav styling.
export default function NewsMenu() {
  const [open, setOpen] = useState(false);
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
        News
        <span aria-hidden className={`text-[10px] transition-transform ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-0 w-52 overflow-hidden rounded-b-md border border-black/10 bg-white shadow-lg"
        >
          {COUNTRIES.map((c) => (
            <Link
              key={c.slug}
              href={countryHref(c.slug)}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm font-semibold text-navy hover:bg-navy hover:text-white"
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
