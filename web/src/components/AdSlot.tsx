// Reserved advertising location. v1 does NOT serve ads, but the *slot* reserves
// its exact IAB dimensions so that when Advanced Ads' replacement drops in, it
// causes ZERO layout shift (CLS is part of the SEO constraint). The data-ad-zone
// attribute is the hook the ad script will target.

type AdSize = "leaderboard" | "billboard" | "mpu" | "halfpage" | "mobile";

const SIZES: Record<AdSize, { w: number; h: number; label: string }> = {
  leaderboard: { w: 728, h: 90, label: "728 × 90" },
  billboard: { w: 970, h: 250, label: "970 × 250" },
  mpu: { w: 300, h: 250, label: "300 × 250" },
  halfpage: { w: 300, h: 600, label: "300 × 600" },
  mobile: { w: 320, h: 50, label: "320 × 50" },
};

export default function AdSlot({
  size = "mpu",
  zone,
  className = "",
}: {
  size?: AdSize;
  zone: string;
  className?: string;
}) {
  const s = SIZES[size];
  return (
    <div className={`flex justify-center ${className}`}>
      <div
        data-ad-zone={zone}
        aria-hidden="true"
        style={{ width: "100%", maxWidth: s.w, height: s.h }}
        className="flex items-center justify-center rounded border border-dashed border-neutral-300 bg-neutral-50"
      >
        <div className="text-center leading-tight">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-400">
            Advertisement
          </div>
          <div className="text-[10px] text-neutral-300">{s.label}</div>
        </div>
      </div>
    </div>
  );
}
