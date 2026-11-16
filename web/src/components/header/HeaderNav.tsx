"use client";

import { useState } from "react";
import MenuLink from "@/components/MenuLink";
import type { MenuItem } from "@/lib/menu";
import { Chevron, useDropdown } from "@/components/NavDropdown";

// The header bar's menu: plain links, and dropdowns that open on hover, click
// or keyboard (useDropdown). Computers only; phones use MobileNav.

const ITEM = "font-ui flex h-16 items-center gap-1.5 whitespace-nowrap px-3 text-[16px] font-semibold text-white hover:text-white/75 xl:px-4";
const SUB = "font-ui flex items-center gap-2.5 whitespace-nowrap px-5 py-2.5 text-[15px] font-medium text-white hover:bg-white/10";

function Dropdown({ item }: { item: MenuItem }) {
  const { open, setOpen, hoverOpen, toggle, ref } = useDropdown();
  return (
    <div ref={ref} className="relative" onMouseEnter={hoverOpen} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={toggle} className={ITEM}>
        {item.title} <Chevron className={`opacity-80 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className="absolute left-0 top-full z-50 min-w-[210px] border-t-2 border-amber bg-navy py-2 shadow-[0_14px_28px_rgba(0,0,0,0.3)]">
          {item.items.map((child, i) => (
            <MenuLink key={`${child.title}-${i}`} item={child} role="menuitem" onClick={() => setOpen(false)} className={SUB} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function HeaderNav({ menu }: { menu: MenuItem[] }) {
  return (
    <nav aria-label="Primary" className="hidden lg:block">
      <ul className="flex items-center">
        {menu.map((item, i) => (
          <li key={`${item.title}-${i}`}>{item.items.length ? <Dropdown item={item} /> : <MenuLink item={item} className={ITEM} />}</li>
        ))}
      </ul>
    </nav>
  );
}

// Phones and narrow windows: a menu button that opens the whole menu under the
// bar, groups folding open one at a time.
export function MobileNav({ menu, signedIn }: { menu: MenuItem[]; signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<number | null>(null);
  const close = () => {
    setOpen(false);
    setGroup(null);
  };
  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Menu"}
        aria-expanded={open}
        onClick={() => (open ? close() : setOpen(true))}
        className="grid h-10 w-10 place-items-center text-white"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full z-50 max-h-[calc(100vh-64px)] overflow-y-auto border-t border-white/15 bg-navy pb-4 shadow-[0_14px_28px_rgba(0,0,0,0.3)]">
          <ul className="wrap">
            {menu.map((item, i) => (
              <li key={`${item.title}-${i}`} className="border-b border-white/10">
                {item.items.length ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={group === i}
                      onClick={() => setGroup(group === i ? null : i)}
                      className="font-ui flex w-full items-center justify-between py-3.5 text-[17px] font-semibold text-white"
                    >
                      {item.title} <Chevron className={`transition-transform ${group === i ? "rotate-180" : ""}`} />
                    </button>
                    {group === i && (
                      <div className="pb-2">
                        {item.items.map((child, j) => (
                          <MenuLink
                            key={`${child.title}-${j}`}
                            item={child}
                            onClick={close}
                            className="font-ui flex items-center gap-2.5 py-2 pl-3 text-[15px] text-white/90"
                          />
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <MenuLink item={item} onClick={close} className="font-ui block py-3.5 text-[17px] font-semibold text-white" />
                )}
              </li>
            ))}
            <li className="pt-3">
              <a href={signedIn ? "/my-account/" : "/login/"} className="font-ui text-[15px] font-semibold text-white/85">
                {signedIn ? "My account" : "Sign in / Register"}
              </a>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

// Search: an icon that opens a search line across the bar.
export function HeaderSearch() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" aria-label="Search" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="grid h-10 w-10 place-items-center text-white hover:text-white/75">
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <form action="/search/" className="absolute inset-x-0 top-full z-50 border-t border-white/15 bg-navy shadow-[0_14px_28px_rgba(0,0,0,0.3)]">
          <div className="wrap flex items-center gap-3 py-3">
            <input
              type="search"
              name="q"
              autoFocus
              placeholder="Search stories, horses, people…"
              aria-label="Search Harnesslink"
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              className="font-ui w-full border-b border-white/50 bg-transparent py-2 text-[17px] text-white placeholder:text-white/50 focus:border-white focus:outline-none"
            />
            <button className="font-ui shrink-0 bg-amber px-4 py-2 text-[14px] font-semibold text-navy-deep">Search</button>
          </div>
        </form>
      )}
    </>
  );
}
