import { getAds } from "@/lib/api";

// A reserved advertising location. It reserves its exact IAB dimensions so
// filling it causes ZERO layout shift (CLS is part of the SEO constraint), and
// serves the managed creative for its zone (image → click-tracked link, or raw
// HTML). Empty zones fall back to a labelled placeholder.

type AdSize = "leaderboard" | "billboard" | "mpu" | "halfpage" | "mobile";

const SIZES: Record<AdSize, { w: number; h: number; label: string }> = {
  leaderboard: { w: 728, h: 90, label: "728 × 90" },
  billboard: { w: 970, h: 250, label: "970 × 250" },
  mpu: { w: 300, h: 250, label: "300 × 250" },
  halfpage: { w: 300, h: 600, label: "300 × 600" },
  mobile: { w: 320, h: 50, label: "320 × 50" },
};

export default async function AdSlot({
  size = "mpu",
  zone,
  className = "",
}: {
  size?: AdSize;
  zone: string;
  className?: string;
}) {
  const s = SIZES[size];
  const ads = await getAds();
  const ad = ads[zone];

  return (
    <div className={`flex justify-center ${className}`}>
      <div
        data-ad-zone={zone}
        style={{ width: "100%", maxWidth: s.w, height: s.h }}
        className="flex items-center justify-center overflow-hidden rounded"
      >
        {ad?.html ? (
          <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: ad.html }} />
        ) : ad?.image_url ? (
          <a href={ad.click_url} target="_blank" rel="noopener sponsored" className="block h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ad.image_url} alt={ad.alt} className="h-full w-full object-contain" />
          </a>
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50"
          >
            <div className="text-center leading-tight">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
                Advertisement
              </div>
              <div className="text-[10px] text-neutral-300">{s.label}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
