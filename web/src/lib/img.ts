import "server-only";
import { createHmac } from "node:crypto";

// Resized photos: the site asks imgproxy (the compose service, never exposed
// directly) for a WebP at the width the reader needs, through /img/… on the
// site itself (app/img/[...path]/route.ts), so Cloudflare caches every size.
//
// Only photos on our media store (MEDIA_URL, i.e. R2) are resized, so the
// old WordPress server is never asked for them. Off unless IMGPROXY_KEY,
// IMGPROXY_SALT and MEDIA_URL are all set; then every address is signed, so
// nobody else can use the resizer.

const KEY = process.env.IMGPROXY_KEY || "";
const SALT = process.env.IMGPROXY_SALT || "";
const MEDIA_URL = (process.env.MEDIA_URL || "").replace(/\/$/, "");

export const WIDTHS = [400, 800, 1200];

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function canResize(src: string | null | undefined): src is string {
  return !!(KEY && SALT && MEDIA_URL && src && src.startsWith(`${MEDIA_URL}/`) && /\.(jpe?g|png|webp|gif)$/i.test(src));
}

// /img/<signature>/rs:fit:<w>:0/q:78/<base64 source>.webp
export function resized(src: string, width: number): string {
  const path = `/rs:fit:${width}:0/q:78/${b64url(Buffer.from(src))}.webp`;
  const sig = b64url(
    createHmac("sha256", Buffer.from(KEY, "hex"))
      .update(Buffer.concat([Buffer.from(SALT, "hex"), Buffer.from(path)]))
      .digest()
  );
  return `/img/${sig}${path}`;
}

// "…/img/…400… 400w, …800… 800w, …" — never wider than the original.
export function resizedSrcset(src: string, width?: number | null): string {
  const widths = WIDTHS.filter((w) => !width || w < width);
  if (width && width <= 1600) widths.push(width);
  return widths.map((w) => `${resized(src, w)} ${w}w`).join(", ");
}

// Story and page HTML: give each of our photos that has no srcset of its own
// resized versions, leaving the stored HTML untouched.
export function resizeBodyImages(html: string): string {
  if (!KEY || !SALT || !MEDIA_URL) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (/\ssrcset=/i.test(tag)) return tag;
    const src = tag.match(/\ssrc=["']([^"']+)["']/i)?.[1];
    if (!canResize(src)) return tag;
    const width = Number(tag.match(/\swidth=["']?(\d+)/i)?.[1]) || null;
    return tag.replace(/<img\b/i, `<img srcset="${resizedSrcset(src, width)}" sizes="(max-width: 768px) 100vw, 720px"`);
  });
}
