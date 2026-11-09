import { headers } from "next/headers";
import { getAds, type AdCreative } from "@/lib/api";
import AdImpression from "@/components/AdImpression";

// An advertising placement, laid out the way harnesslink.com does it:
//   billboard — full-width banner (1360 × 150 creative), scales down to fit
//   banner    — in-column banner (800 × 120 creative), scales down to fit
//   mpu       — 300 × 250 box; a zone with several slots stacks them
// Creatives render with their own pixel size as width/height, so the browser
// reserves exact space before the image loads (no layout shift — CLS is part
// of the SEO constraint). A zone with nothing booked renders nothing, as on
// the live site.

export type AdFormat = "billboard" | "banner" | "mpu";

const FORMATS: Record<AdFormat, { w: number; h: number }> = {
  billboard: { w: 1360, h: 150 },
  banner: { w: 800, h: 120 },
  mpu: { w: 300, h: 250 },
};

function Creative({ ad, format, track }: { ad: AdCreative; format: AdFormat; track: string | null }) {
  const f = FORMATS[format];
  const w = ad.width ?? f.w;
  const h = ad.height ?? f.h;
  // Boxes are a fixed 300 × 250 slot; banners keep the creative's own shape.
  const box = format === "mpu";

  return (
    <div
      className="relative w-full overflow-hidden"
      style={box ? { maxWidth: f.w, aspectRatio: `${f.w} / ${f.h}` } : { maxWidth: f.w, aspectRatio: `${w} / ${h}` }}
    >
      {track !== null && <AdImpression id={ad.id} query={track} />}
      {ad.html ? (
        <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: ad.html }} />
      ) : ad.image_url ? (
        <a href={`${ad.click_url}${track || ""}`} target="_blank" rel="noopener sponsored" className="block h-full w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ad.image_url}
            alt={ad.alt}
            width={w}
            height={h}
            loading={format === "billboard" ? "eager" : "lazy"}
            decoding="async"
            className={box ? "h-full w-full object-contain" : "block h-auto w-full"}
          />
        </a>
      ) : null}
    </div>
  );
}

export default async function AdSlot({
  zone,
  format,
  className = "",
}: {
  zone: string;
  format: AdFormat;
  className?: string;
}) {
  const h = await headers();
  const country = h.get("x-hl-country") || "";
  // Placement and country go with each impression and click, for the
  // advertiser's report; ?geo= previews aren't counted at all.
  const track = h.get("x-hl-geo-preview") ? null : `?${new URLSearchParams({ z: zone, ...(country ? { c: country } : {}) })}`;
  const entry = (await getAds(country))[zone];
  const ads = Array.isArray(entry) ? entry : [];
  if (ads.length === 0) return null;

  return (
    <div data-ad-zone={zone} className={`flex flex-col items-center gap-2.5 ${className}`}>
      {ads.map((ad) => (
        <Creative key={ad.id} ad={ad} format={format} track={track} />
      ))}
    </div>
  );
}
