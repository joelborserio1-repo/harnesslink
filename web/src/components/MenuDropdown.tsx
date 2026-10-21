"use client";

import { useState } from "react";
import MenuLink from "@/components/MenuLink";
import type { MenuItem } from "@/lib/menu";
import { Chevron, MENU_ITEM, NAV_ITEM, useDropdown } from "@/components/NavDropdown";

const PANEL = "bg-navy py-1 shadow-[0_12px_24px_rgba(0,0,0,0.25)]";

// A top-level menu item with a dropdown (News, Racing…). Items that have
// their own sub-items open a fly-out to the right, as Racing → AUS does.
export default function MenuDropdown({ item }: { item: MenuItem }) {
  const { open, setOpen, hoverOpen, toggle, ref } = useDropdown();
  const [active, setActive] = useState<number | null>(null);
  const close = () => {
    setOpen(false);
    setActive(null);
  };
  const wide = item.items.some((i) => i.items.length > 0);

  return (
    <div ref={ref} className="relative" onMouseEnter={hoverOpen} onMouseLeave={close}>
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={toggle} className={NAV_ITEM}>
        {item.title} <Chevron className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div role="menu" className={`absolute left-0 top-full z-50 ${wide ? "min-w-[300px]" : "min-w-[220px]"} ${PANEL}`}>
          {item.items.map((child, i) =>
            child.items.length === 0 ? (
              <MenuLink key={`${child.title}-${i}`} item={child} role="menuitem" onClick={close} className={MENU_ITEM} />
            ) : (
              <div key={`${child.title}-${i}`} className="relative" onMouseEnter={() => setActive(i)} onMouseLeave={() => setActive(null)}>
                <button
                  type="button"
                  aria-haspopup="menu"
                  aria-expanded={active === i}
                  onClick={() => setActive(i)}
                  onFocus={() => setActive(i)}
                  className={`${MENU_ITEM} w-full`}
                >
                  {child.title}
                  <Chevron dir="right" className="ml-1" />
                </button>
                {active === i && (
                  <div role="menu" className={`z-50 sm:absolute sm:left-full sm:top-0 sm:min-w-[300px] ${PANEL}`}>
                    {child.items.map((g, j) => (
                      <MenuLink key={`${g.title}-${j}`} item={g} role="menuitem" onClick={close} className={MENU_ITEM} />
                    ))}
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
