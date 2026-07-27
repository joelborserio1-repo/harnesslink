import fs from "fs";
import path from "path";

/**
 * StrideShares (by BPM Bloodstock) colour tokens - single source of truth, mirrored in
 * tailwind.config.ts. Green-dominant; gold is an accent only (primary CTA,
 * price figures, icon) and is never used as a background fill.
 */
export const brandColors = {
  green900: "#0E2A22", // page background
  green800: "#1B4536", // cards / surfaces (sit above the page bg)
  green600: "#2E5A4B", // borders / hairlines
  gold: "#C09A45", // accent
  goldDeep: "#A8862F", // gold hover / active
  goldText: "#2A2008", // dark text on gold CTAs
  cream: "#F3EBD8", // primary body text on green
  sage: "#A9BBB0", // secondary / muted text, captions
} as const;

/**
 * If a brand logo file exists at public/brand/logo.<ext>, return its public
 * path so the Nav/footer render the real logo image. Otherwise null, and the
 * app falls back to the built-in SVG wordmark.
 *
 * Drop your logo at:  public/brand/logo.png  (or .svg / .webp / .jpg)
 */
const EXTS = ["svg", "png", "webp", "jpg", "jpeg"];

/**
 * Find a brand asset (public/brand/<base>.<ext>) and return its public path with
 * a cache-busting ?v=<mtime> so re-uploads show immediately, or null if absent.
 */
export function findBrandAsset(base: string): string | null {
  const dir = path.join(process.cwd(), "public", "brand");
  for (const e of EXTS) {
    const p = path.join(dir, `${base}.${e}`);
    try {
      const st = fs.statSync(p);
      return `/brand/${base}.${e}?v=${Math.round(st.mtimeMs)}`;
    } catch {
      /* not this extension */
    }
  }
  return null;
}

/** Logo image for the nav/footer. Drop at public/brand/logo.<ext>. */
export function brandLogoSrc(): string | null {
  return findBrandAsset("logo");
}

/** Square icon for the favicon + small placements. public/brand/icon.<ext>. */
export function brandIconSrc(): string | null {
  return findBrandAsset("icon");
}

/** Promo/lifestyle image for the landing + about panels. public/brand/promo.<ext>. */
export function brandPromoSrc(): string | null {
  return findBrandAsset("promo");
}

/**
 * Find a horse image in public/horses/<slug><suffix>.<ext>, cache-busted by
 * mtime. Use suffix "-landscape" for a wide banner variant on the detail page.
 */
export function horseImageSrc(slug: string, suffix = ""): string | null {
  const dir = path.join(process.cwd(), "public", "horses");
  for (const e of EXTS) {
    const p = path.join(dir, `${slug}${suffix}.${e}`);
    try {
      const st = fs.statSync(p);
      return `/horses/${slug}${suffix}.${e}?v=${Math.round(st.mtimeMs)}`;
    } catch {
      /* not this extension */
    }
  }
  return null;
}
