import fs from "fs";
import path from "path";

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
