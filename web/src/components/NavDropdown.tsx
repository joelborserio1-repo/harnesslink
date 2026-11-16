"use client";

import { useEffect, useRef, useState } from "react";

// Shared behaviour for the header dropdowns: opens on hover (desktop) and on
// click/tap or keyboard; closes on outside click or Escape. A tap fires the
// hover first, so a click straight after a hover-open keeps the menu open
// instead of toggling it shut.
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hoveredAt = useRef(0);
  const hoverOpen = () => {
    if (!open) hoveredAt.current = Date.now();
    setOpen(true);
  };
  const toggle = () => {
    if (Date.now() - hoveredAt.current < 500) return setOpen(true);
    setOpen((o) => !o);
  };
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
  return { open, setOpen, hoverOpen, toggle, ref };
}

export function Chevron({ dir = "down", className = "" }: { dir?: "down" | "right"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3.2" aria-hidden className={className}>
      <path d={dir === "down" ? "M6 9l6 6 6-6" : "M9 6l6 6-6 6"} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
