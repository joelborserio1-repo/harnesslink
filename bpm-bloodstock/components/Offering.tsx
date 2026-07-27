import Link from "next/link";
import { formatCents, pct } from "@/lib/money";

type OfferingLike = {
  slug: string;
  name: string;
  discipline: string;
  tagline: string;
  heroColor: string;
  imageUrl?: string;
  totalShares: number;
  sharesSold: number;
  sharePriceCents: number;
  status: string;
};

// Green surface with a gold icon watermark (the icon is the accent, not a fill).
export function SilksTile({
  className = "",
  size = "h-14 w-14",
}: {
  heroColor?: string;
  className?: string;
  size?: string;
}) {
  return (
    <div
      className={`flex ${size} items-center justify-center rounded-lg border border-green-600 bg-green-900 ${className}`}
    >
      <span className="font-heading text-base tracking-tight text-gold">BPM</span>
    </div>
  );
}

// Neutral (sage/green) status chips - gold is reserved for the price figure.
function StatusBadge({ status }: { status: string }) {
  const base =
    "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide";
  if (status === "OPEN")
    return (
      <span className={`${base} border-green-600 bg-green-900/80 text-cream`}>
        Open
      </span>
    );
  if (status === "CLOSED")
    return (
      <span className={`${base} border-green-600 bg-green-900/80 text-sage`}>
        Fully subscribed
      </span>
    );
  return (
    <span className={`${base} border-green-600 bg-green-900/80 text-sage`}>
      {status.toLowerCase()}
    </span>
  );
}

export function ShareProgress({ sold, total }: { sold: number; total: number }) {
  const p = Math.min(100, pct(sold, total));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-green-900">
        <div
          className="h-full rounded-full bg-gold"
          style={{ width: `${p}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-sage">
        <span>
          {sold.toLocaleString()} / {total.toLocaleString()} shares
        </span>
        <span>{p.toFixed(0)}% sold</span>
      </div>
    </div>
  );
}

export function OfferingCard({ offering }: { offering: OfferingLike }) {
  return (
    <Link
      href={`/offerings/${offering.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-green-600 bg-green-800 shadow-card transition hover:border-gold/60"
    >
      {offering.imageUrl ? (
        <div className="relative h-44 w-full overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={offering.imageUrl}
            alt={offering.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
          <div className="absolute right-3 top-3">
            <StatusBadge status={offering.status} />
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between p-5 pb-0">
          <SilksTile heroColor={offering.heroColor} />
          <StatusBadge status={offering.status} />
        </div>
      )}

      <div className="mt-4 flex-1 px-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">
          {offering.discipline}
        </p>
        <h3 className="mt-1 font-heading text-xl font-bold text-cream">
          {offering.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-sage">
          {offering.tagline}
        </p>
      </div>

      <div className="mt-5 px-5">
        <ShareProgress sold={offering.sharesSold} total={offering.totalShares} />
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-green-600 px-5 pb-5 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-sage">From</p>
          <p className="font-heading text-lg font-bold text-gold">
            {formatCents(offering.sharePriceCents)}
            <span className="ml-1 text-xs font-normal text-sage">/ share</span>
          </p>
        </div>
        <span className="inline-flex items-center rounded-md border border-green-600 px-4 py-2 text-xs font-semibold text-cream transition group-hover:bg-white/5">
          View horse →
        </span>
      </div>
    </Link>
  );
}
