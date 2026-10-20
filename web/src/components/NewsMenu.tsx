"use client";

import Link from "next/link";
import Flag from "@/components/Flag";
import { COUNTRIES, countryHref } from "@/lib/countries";
import { Chevron, MENU_ITEM, NAV_ITEM, useDropdown } from "@/components/NavDropdown";

// "News" → the country sections, each with its flag, as on the live site.
export default function NewsMenu() {
  const { open, setOpen, ref } = useDropdown();
  return (
    <div ref={ref} className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)} className={NAV_ITEM}>
        News <Chevron className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 min-w-[220px] bg-navy py-1 shadow-[0_12px_24px_rgba(0,0,0,0.25)]">
          {COUNTRIES.map((c) => (
            <Link key={c.slug} href={countryHref(c.slug)} role="menuitem" onClick={() => setOpen(false)} className={MENU_ITEM}>
              <Flag code={c.flag} />
              {c.code}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
