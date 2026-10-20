"use client";

import { useEffect, useRef, useState } from "react";

// Shared behaviour for the header dropdowns: opens on hover (desktop) and on
// click/tap or keyboard; closes on outside click or Escape.
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return { open, setOpen, ref };
}

export function Chevron({ dir = "down", className = "" }: { dir?: "down" | "right"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden className={className}>
      <path d={dir === "down" ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// The live site's menu type: Heebo 17px medium, uppercase, roomy padding.
export const NAV_ITEM =
  "font-ui flex items-center gap-2 whitespace-nowrap px-3 py-2.5 text-[14px] font-medium uppercase text-white hover:text-white/80 sm:px-5 sm:py-[13px] sm:text-[17px]";
// Dropdown items: Heebo 18px medium italic on navy, as on the live site.
export const MENU_ITEM =
  "font-ui flex items-center gap-3 whitespace-nowrap px-5 py-[13px] text-[18px] font-medium italic text-white hover:bg-white/10";
