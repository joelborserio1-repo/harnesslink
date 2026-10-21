import Link from "next/link";
import type { ReactNode } from "react";

// Shared building blocks for the racing profile and result pages, after the HarnessLink admin:
// navy header, a stats card that overlaps it, form squares, quiet tables. Kept deliberately plain.

export function Hero({
  crumbs,
  tags = [],
  title,
  suffix,
  lines = [],
  facts = [],
  media,
  actions,
}: {
  crumbs: { label: string; href?: string }[];
  tags?: string[];
  title: string;
  suffix?: string | null;
  lines?: ReactNode[];
  facts?: { label: string; value: ReactNode }[];
  media?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="bg-navy pb-20 text-white">
      <div className="wrap max-w-[1180px]! pt-5">
        <nav className="text-[12px] text-white/60" aria-label="Breadcrumb">
          {crumbs.map((c, i) => (
            <span key={i}>
              {i > 0 && <span className="mx-1.5">›</span>}
              {c.href ? <Link href={c.href} className="hover:text-white">{c.label}</Link> : <span className="text-white/85">{c.label}</span>}
            </span>
          ))}
        </nav>
        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-start">
          {media && <div className="grid h-[84px] w-[84px] shrink-0 place-items-center rounded-md bg-white">{media}</div>}
          <div className="min-w-0 flex-1">
            {tags.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="rounded-[3px] border border-white/40 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em]">{t}</span>
                ))}
              </div>
            )}
            <h1 className="font-display text-[40px] font-bold uppercase leading-none sm:text-[52px]">
              {title}
              {suffix && <span className="ml-2 align-middle text-[22px] text-[#8fb4ff] sm:text-[26px]">({suffix})</span>}
            </h1>
            {lines.map((l, i) => (
              <p key={i} className={`mt-1.5 text-[14px] ${i === 0 ? "text-white/80" : "font-semibold text-white"}`}>{l}</p>
            ))}
          </div>
        </div>
        {facts.length > 0 && (
          <dl className="mt-6 grid gap-x-8 gap-y-4 border-t border-white/15 pt-5 sm:grid-cols-3">
            {facts.map((f) => (
              <div key={f.label} className="min-w-0">
                <dt className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-[#8fb4ff]">{f.label}</dt>
                <dd className="mt-0.5 truncate text-[14px]">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {actions && <div className="mt-5 flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function HeroButton({ href, children, solid }: { href: string; children: ReactNode; solid?: boolean }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-[4px] px-3.5 py-2 text-[13px] font-bold transition ${solid ? "bg-white text-navy hover:bg-[#e8eefb]" : "border border-white/40 text-white hover:bg-white/10"}`}
    >
      {children}
    </Link>
  );
}

/** White card pulled up over the navy header. */
export function StatCard({ stats, footer }: { stats: { label: string; value: ReactNode; accent?: boolean }[]; footer?: ReactNode }) {
  return (
    <section className="wrap max-w-[1180px]! -mt-14">
      <div className="rounded-md border border-line bg-white px-5 py-5 shadow-[0_1px_2px_rgba(0,32,94,0.06)]">
        <dl className="grid grid-cols-2 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
          {stats.map((s) => (
            <div key={s.label}>
              <dd className={`font-display text-[32px] font-bold leading-none tabular-nums ${s.accent ? "text-blue" : "text-ink"}`}>{s.value ?? "–"}</dd>
              <dt className="mt-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{s.label}</dt>
            </div>
          ))}
        </dl>
        {footer && <div className="mt-5 border-t border-line pt-4">{footer}</div>}
      </div>
    </section>
  );
}

/** One finishing position as a small square: wins solid, placings tinted. */
export function PlaceSquare({ placing, position, size = "sm" }: { placing: string | null; position: number | null; size?: "sm" | "md" }) {
  const dims = size === "md" ? "h-7 min-w-7 text-[12px]" : "h-6 min-w-6 text-[11px]";
  const tone = position === 1 ? "bg-blue text-white" : position && position <= 3 ? "bg-[#dde8fb] text-blue" : "bg-mist text-muted";
  return <span className={`inline-grid place-items-center rounded-[3px] px-1 font-bold tabular-nums ${dims} ${tone}`}>{position ?? placing ?? "–"}</span>;
}

export function FormSquares({ runs }: { runs: { position: number | null; placing: string | null }[] }) {
  if (!runs.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1.5 text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">Last {runs.length}</span>
      {runs.map((r, i) => <PlaceSquare key={i} placing={r.placing} position={r.position} />)}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[22px] font-bold uppercase tracking-[0.04em] text-navy">{children}</h2>
      {action}
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-white p-4">
      <h2 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Wins / seconds / thirds / other as a donut, with the counts beside it. */
export function PlacingsDonut({ title, wins, seconds, thirds, other }: { title: string; wins: number; seconds: number; thirds: number; other: number }) {
  const total = wins + seconds + thirds + other;
  const parts = [
    { label: "Wins", n: wins, colour: "#0a3fa8" },
    { label: "Seconds", n: seconds, colour: "#2f74e0" },
    { label: "Thirds", n: thirds, colour: "#7fb0f5" },
    { label: "Other", n: other, colour: "#d7dde8" },
  ];
  const r = 15.915; // circumference 100
  let offset = 25;
  return (
    <section className="rounded-md border border-line bg-white p-5">
      <h3 className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-muted">{title}</h3>
      <div className="mt-4 flex items-center gap-6">
        <svg viewBox="0 0 42 42" className="h-28 w-28 shrink-0 -rotate-0" role="img" aria-label={`${title}: ${wins} wins from ${total} starts`}>
          <circle cx="21" cy="21" r={r} fill="none" stroke="#eef1f6" strokeWidth="7" />
          {total > 0 &&
            parts.map((p) => {
              const pct = (p.n / total) * 100;
              const el = (
                <circle key={p.label} cx="21" cy="21" r={r} fill="none" stroke={p.colour} strokeWidth="7" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />
              );
              offset -= pct;
              return el;
            })}
          <text x="21" y="23.5" textAnchor="middle" className="font-display" style={{ fontSize: 8, fontWeight: 700, fill: "#14161b" }}>{total}</text>
        </svg>
        <ul className="flex-1 space-y-1.5 text-[13px]">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: p.colour }} />{p.label}</span>
              <span className="tabular-nums text-ink">
                {p.n} <span className="text-muted">{total ? `(${Math.round((p.n / total) * 100)}%)` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
