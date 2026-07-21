import Link from "next/link";
import { prisma } from "@/lib/db";
import { OfferingCard } from "@/components/Offering";
import { LogoMark } from "@/components/Logo";
import { formatCentsCompact } from "@/lib/money";

export default async function Home() {
  const offerings = await prisma.offering.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 3,
  });

  const [horses, invested, shareholders] = await Promise.all([
    prisma.offering.count(),
    prisma.order.aggregate({ _sum: { totalCents: true } }),
    prisma.user.count({ where: { holdings: { some: {} } } }),
  ]);

  const stats = [
    { label: "Horses syndicated", value: horses.toString() },
    {
      label: "Invested by members",
      value: formatCentsCompact(invested._sum.totalCents ?? 0),
    },
    { label: "Micro-share owners", value: shareholders.toString() },
    { label: "Entry from", value: "$40" },
  ];

  return (
    <div>
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="container-bpm grid gap-10 py-20 md:grid-cols-2 md:items-center md:py-28">
          <div>
            <p className="eyebrow">Micro-share racehorse ownership</p>
            <h1 className="mt-4 font-heading text-5xl font-bold leading-[1.05] text-cream md:text-6xl">
              Own a slice of the{" "}
              <span className="text-gold">action.</span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-cream/70">
              BPM Bloodstock opens harness racing to everyone. Buy micro-shares
              in our pacers and trotters, follow every run, and share in the
              prizemoney — paid straight to your wallet.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/offerings" className="btn-gold">
                Browse the horses
              </Link>
              <Link href="/#how" className="btn-outline">
                How it works
              </Link>
            </div>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-gold-300">
              Get Your Heart Racing
            </p>
          </div>

          {/* Brand pillar tile */}
          <div className="relative">
            <div className="card mx-auto max-w-sm p-8">
              <div className="flex justify-center">
                <LogoMark className="h-24 w-24" />
              </div>
              <p className="mt-6 text-center font-heading text-2xl font-bold tracking-wide text-cream">
                STRENGTH · RHYTHM · HEART
              </p>
              <div className="mt-6 space-y-3 text-sm">
                {[
                  ["Heart", "Passion. Connection."],
                  ["Rhythm", "Consistency. Drive."],
                  ["Horse", "Strength. Excellence."],
                ].map(([k, v]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-racing-975/50 px-4 py-2.5"
                  >
                    <span className="font-heading font-semibold text-gold">
                      {k}
                    </span>
                    <span className="text-cream/60">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="border-y border-white/10 bg-racing-975/40">
        <div className="container-bpm grid grid-cols-2 gap-6 py-10 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-heading text-3xl font-bold text-gold">
                {s.value}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-cream/55">
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="container-bpm py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-heading text-3xl font-bold text-cream">
            From spectator to owner in minutes
          </h2>
        </div>
        <div className="brand-rule mx-auto mt-6 max-w-xs" />
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Top up your wallet",
              d: "Add funds securely via card. Your BPM wallet holds your balance ready to invest.",
            },
            {
              n: "02",
              t: "Buy micro-shares",
              d: "Pick a horse and buy as many shares as you like — from as little as $40 a share.",
            },
            {
              n: "03",
              t: "Share the prizemoney",
              d: "When your horse earns, your pro-rata cut lands in your wallet. Withdraw any time.",
            },
          ].map((step) => (
            <div key={step.n} className="card p-6">
              <p className="font-heading text-4xl font-bold text-gold/30">
                {step.n}
              </p>
              <h3 className="mt-2 font-heading text-xl font-bold text-cream">
                {step.t}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-cream/60">
                {step.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURED OFFERINGS */}
      <section className="container-bpm pb-24">
        <div className="flex items-end justify-between">
          <div>
            <p className="eyebrow">The current book</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-cream">
              Horses open for ownership
            </h2>
          </div>
          <Link
            href="/offerings"
            className="hidden text-sm text-gold hover:text-gold-200 md:block"
          >
            View all →
          </Link>
        </div>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {offerings.map((o) => (
            <OfferingCard key={o.id} offering={o} />
          ))}
        </div>
      </section>
    </div>
  );
}
