"use client";

import { useState } from "react";
import Link from "next/link";
import Flag from "@/components/Flag";
import { RACING } from "@/lib/racing";
import { Chevron, MENU_ITEM, NAV_ITEM, useDropdown } from "@/components/NavDropdown";

// "Racing" → International Race Calendar, then each country with a fly-out of
// Fields / Results & Replays / its race calendar, as on the live site.
export default function RacingMenu() {
  const { open, setOpen, ref } = useDropdown();
  const [active, setActive] = useState<number | null>(null);
  const close = () => {
    setOpen(false);
    setActive(null);
  };

  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={close}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={NAV_ITEM}>
        Racing <Chevron className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 min-w-[300px] bg-navy py-1 shadow-[0_12px_24px_rgba(0,0,0,0.25)]">
          <Link href="/international-race-calendar/" role="menuitem" onClick={close} className={MENU_ITEM}>
            International Race Calendar
          </Link>
          {RACING.map((c, i) => (
            <div key={c.label} className="relative" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={active === i}
                onClick={() => setActive(active === i ? null : i)}
                onFocus={() => setActive(i)}
                className={`${MENU_ITEM} w-full`}
              >
                <Flag code={c.flag} />
                {c.label}
                <Chevron dir="right" className="ml-1" />
              </button>
              {active === i && (
                <div
                  role="menu"
                  className="z-50 bg-navy py-1 shadow-[0_12px_24px_rgba(0,0,0,0.25)] sm:absolute sm:left-full sm:top-0 sm:min-w-[300px]"
                >
                  <a href={c.fields} target="_blank" rel="noopener noreferrer" role="menuitem" className={MENU_ITEM}>
                    Fields
                  </a>
                  <a href={c.results} target="_blank" rel="noopener noreferrer" role="menuitem" className={MENU_ITEM}>
                    Results &amp; Replays
                  </a>
                  {c.calendar && (
                    <Link href={c.calendar} role="menuitem" onClick={close} className={MENU_ITEM}>
                      {c.name} Race Calendar
                    </Link>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
