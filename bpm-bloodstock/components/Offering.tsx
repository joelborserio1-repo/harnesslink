import Link from "next/link";
import { LogoMark } from "./Logo";
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

export function SilksTile({
  heroColor,
  className = "",
  size = "h-14 w-14",
}: {
  heroColor: string;
  className?: string;
  size?: string;
}) {
  const gold = heroColor !== "green";
  return (
    <div
      className={`flex ${size} items-center justify-center rounded-lg ${
        gold ? "bg-gold" : "bg-racing-900 ring-1 ring-gold/40"
      } ${className}`}
    >
      <LogoMark
        className={`h-3/5 w-3/5 ${gold ? "[&_path]:!fill-racing-950" : ""}`}
      />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "OPEN") return <span className="badge-open">Open</span>;
  if (status === "CLOSED")
    return <span className="badge-full">Fully subscribed</span>;
  return <span className="badge-closed">{status.toLowerCase()}</span>;
}

export function ShareProgress({
  sold,
  total,
}: {
  sold: number;
  total: number;
}) {
  const p = Math.min(100, pct(sold, total));
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300"
          style={{ width: `${p}%` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-cream/55">
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
      className="card group flex flex-col overflow-hidden p-0 transition hover:border-gold/40 hover:shadow-gold"
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
        <p className="eyebrow">{offering.discipline}</p>
        <h3 className="mt-1 font-heading text-xl font-bold text-cream group-hover:text-gold-100">
          {offering.name}
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm text-cream/60">
          {offering.tagline}
        </p>
      </div>

      <div className="mt-5 px-5">
        <ShareProgress sold={offering.sharesSold} total={offering.totalShares} />
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-white/10 px-5 pb-5 pt-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-cream/45">
            From
          </p>
          <p className="font-heading text-lg font-bold text-gold">
            {formatCents(offering.sharePriceCents)}
            <span className="ml-1 text-xs font-normal text-cream/50">
              / share
            </span>
          </p>
        </div>
        <span className="btn-outline px-4 py-2 text-xs">View horse →</span>
      </div>
    </Link>
  );
}
