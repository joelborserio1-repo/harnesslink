import fs from "fs";
import path from "path";

/**
 * BPM Bloodstock colour tokens - single source of truth, mirrored in
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

export function brandLogoSrc(): string | null {
  const dir = path.join(process.cwd(), "public", "brand");
  for (const e of EXTS) {
    const file = `logo.${e}`;
    if (fs.existsSync(path.join(dir, file))) return `/brand/${file}`;
  }
  return null;
}
