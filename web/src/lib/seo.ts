import type { Metadata } from "next";

// Site-wide SEO defaults, matching what Rank Math puts on the live site so
// Google sees no change at cutover (migration/seo_parity.rb checks this).

export const SITE_URL = "https://harnesslink.com";
export const SITE_NAME = "Harnesslink";

// Rank Math: "%title% %sep% %sitename%" with the separator "-".
export const TITLE_TEMPLATE = `%s - ${SITE_NAME}`;

export const HOME_TITLE = "Harness Racing News, Results and Updates Today | Harnesslink";
export const HOME_DESCRIPTION =
  "Latest harness racing news, results, fields, and driver updates from Australia, New Zealand, Europe, Bathurst, Menangle, and Albion Park tracks daily.";

// Shared when a page has no photo of its own (public/share.png).
export const DEFAULT_SHARE_IMAGE = { url: `${SITE_URL}/share.png`, width: 1200, height: 630, alt: SITE_NAME };

// Rank Math's advanced robots defaults: let Google show large image previews
// (Discover, Top Stories), full snippets and video previews.
const PREVIEWS = { "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } as const;

// "index,follow" / "noindex" (stored per story) → Next's robots metadata.
export function robotsFrom(value?: string | null): NonNullable<Metadata["robots"]> {
  const tokens = String(value || "index,follow").split(",").map((t) => t.trim().toLowerCase());
  const index = !tokens.includes("noindex");
  return { index, follow: !tokens.includes("nofollow"), ...(index ? PREVIEWS : {}) };
}

export const DEFAULT_ROBOTS = robotsFrom("index,follow");

type Img = { src?: string | null; width?: number | null; height?: number | null; alt?: string | null } | null | undefined;

// og:image with size and alt when known; the default card otherwise.
export function shareImages(img: Img, fallbackAlt?: string) {
  if (!img?.src) return [DEFAULT_SHARE_IMAGE];
  return [
    {
      url: img.src,
      ...(img.width ? { width: img.width } : {}),
      ...(img.height ? { height: img.height } : {}),
      alt: img.alt || fallbackAlt || SITE_NAME,
    },
  ];
}

// Open Graph + Twitter for an ordinary (non-story) page. Next replaces the
// layout's openGraph wholesale when a page sets its own, so pages call this.
export function pageSocial(o: { title: string; description?: string | null; url: string; image?: Img }): Pick<Metadata, "openGraph" | "twitter"> {
  const images = shareImages(o.image, o.title);
  return {
    openGraph: {
      type: "website",
      locale: "en_US",
      siteName: SITE_NAME,
      title: o.title,
      description: o.description ?? undefined,
      url: o.url,
      images,
    },
    twitter: { card: "summary_large_image", title: o.title, description: o.description ?? undefined, images: images.map((i) => i.url) },
  };
}
