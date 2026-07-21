import Link from "next/link";
import { prisma } from "@/lib/db";
import { OfferingCard, SilksTile, ShareProgress } from "@/components/Offering";
import { LogoMark } from "@/components/Logo";
import { formatCentsCompact } from "@/lib/money";
import { Reveal, CountUp } from "@/components/Motion";
import { Faq } from "@/components/Faq";

export const dynamic = "force-dynamic";

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

  const ticker = [
    "OWN A REAL RACEHORSE",
    "FROM $40 A SHARE",
    "PRIZEMONEY TO YOUR WALLET",
    "PACERS + TROTTERS",
    "NO SIX-FIGURE BUY-IN",
    "GET YOUR HEART RACING",
  ];

  return (
    <div className="overflow-hidden">
      {/* ---- TOP TICKER ---- */}
      <div className="border-b border-gold/20 bg-gold text-racing-950">
        <div className="marquee py-2 text-xs font-bold uppercase tracking-widest">
          {[...ticker, ...ticker].map((t, i) => (
            <span key={i} className="mx-6 flex items-center gap-6">
              {t} <span className="text-racing-950/40">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* ---- HERO ---- */}
      <section className="relative">
        {/* ghost repeating headline behind */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col justify-center overflow-hidden opacity-[0.04]"
        >
          {["GET IN", "THE RACE", "GET IN", "THE RACE"].map((t, i) => (
            <span
              key={i}
              className="whitespace-nowrap font-heading text-[10vw] font-bold leading-[0.9] text-cream"
            >
              {t} {t} {t}
            </span>
          ))}
        </div>
        {/* floating brand blobs */}
        <div
          aria-hidden
          className="float-slow pointer-events-none absolute -right-24 top-10 h-72 w-72 rounded-full bg-gold/10 blur-3xl"
        />

        <div className="container-bpm relative grid gap-12 py-16 md:grid-cols-[1.1fr_0.9fr] md:items-center md:py-24">
          <div>
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold-200">
                <span className="live-dot inline-block h-2 w-2 rounded-full bg-gold" />
                Own a racehorse. Yes, really.
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="mt-6 font-heading text-6xl font-bold leading-[0.92] text-cream sm:text-7xl md:text-8xl">
                Fuck it.
                <br />
                It&apos;s{" "}
                <span className="shimmer-gold">
                  $<CountUp to={200} />
                </span>
                .
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="mt-7 max-w-xl text-lg leading-relaxed text-cream/75 md:text-xl">
                Grab shares in a real pacer or trotter for about the price of a
                night out. Watch it race under our green-and-gold, follow every
                step, and split the prizemoney — straight to your wallet.
                That&apos;s the whole pitch.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/offerings"
                  className="group btn-gold px-7 py-3.5 text-base"
                >
                  Grab your shares <span className="nudge">→</span>
                </Link>
                <Link href="/#how" className="btn-outline px-7 py-3.5 text-base">
                  How it works
                </Link>
              </div>
            </Reveal>
            <Reveal delay={300}>
              <p className="mt-4 text-sm text-cream/50">
                Takes 2 minutes. No horsey knowledge required.
              </p>
            </Reveal>
          </div>

          {/* hero visual — a tilted "ownership pass" */}
          <Reveal delay={200} className="relative hidden md:block">
            <div className="relative mx-auto max-w-sm">
              <div
                aria-hidden
                className="absolute inset-0 -rotate-6 rounded-2xl border border-gold/20 bg-gold/5"
              />
              <div className="card relative rotate-2 p-6 transition hover:rotate-0">
                <div className="flex items-center justify-between">
                  <SilksTile heroColor="gold" size="h-14 w-14" />
                  <span className="badge-open">Open</span>
                </div>
                <p className="mt-4 text-[11px] uppercase tracking-widest text-cream/45">
                  You now own
                </p>
                <p className="font-heading text-2xl font-bold text-cream">
                  8 shares · Menangle Magic
                </p>
                <div className="mt-4">
                  <ShareProgress sold={248} total={1000} />
                </div>
                <div className="mt-5 flex items-center justify-between rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3">
                  <span className="text-sm text-cream/70">
                    Prizemoney paid to you
                  </span>
                  <span className="font-heading text-lg font-bold text-emerald-300">
                    +$72.00
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-cream/50">
                  <LogoMark className="heartbeat h-5 w-5" /> Get Your Heart Racing
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ---- BUILD YOUR STABLE ---- */}
      <section className="border-t border-white/10 bg-racing-975/40">
        <div className="container-bpm py-16">
          <div className="flex items-end justify-between">
            <Reveal>
              <p className="eyebrow">Open now</p>
              <h2 className="mt-2 font-heading text-4xl font-bold text-cream md:text-5xl">
                Build your stable.
              </h2>
              <p className="mt-2 text-cream/60">
                Pick your pony. Grab your shares. Simple as that.
              </p>
            </Reveal>
            <Link
              href="/offerings"
              className="group hidden text-sm font-semibold text-gold hover:text-gold-200 md:block"
            >
              See the whole book <span className="nudge inline-block">→</span>
            </Link>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {offerings.map((o, i) => (
              <Reveal key={o.id} delay={i * 90}>
                <OfferingCard offering={o} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ---- WHAT $200 GETS YOU ---- */}
      <section className="container-bpm py-16">
        <Reveal>
          <p className="eyebrow">The good stuff</p>
          <h2 className="mt-2 font-heading text-4xl font-bold text-cream md:text-5xl">
            So what does $200 actually get you?
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              t: "A real slice of the horse",
              d: "Legit micro-shares in a named, racing pacer or trotter. Your name on the papers.",
              e: "🐎",
            },
            {
              t: "Prizemoney in your wallet",
              d: "It wins, you get paid — split by the shares you hold, to the cent.",
              e: "💸",
            },
            {
              t: "Bragging rights",
              d: "Follow your horse trackwork to race night. Screenshot the win. Post it.",
              e: "📣",
            },
            {
              t: "Zero stuffiness",
              d: "No blazers, no syndicate meetings, no six-figure cheque. Just in.",
              e: "🔥",
            },
          ].map((f, i) => (
            <Reveal key={f.t} delay={i * 90}>
              <div className="card h-full p-5 transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-gold">
                <div className="text-3xl">{f.e}</div>
                <h3 className="mt-3 font-heading text-lg font-bold text-cream">
                  {f.t}
                </h3>
                <p className="mt-1.5 text-sm text-cream/60">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- STATS ---- */}
      <section className="border-y border-white/10 bg-racing-975/40">
        <div className="container-bpm grid grid-cols-2 gap-6 py-12 md:grid-cols-4">
          {[
            { v: <CountUp to={horses} />, label: "Horses in the book" },
            {
              v: formatCentsCompact(invested._sum.totalCents ?? 0),
              label: "Backed by members",
            },
            { v: <CountUp to={shareholders} />, label: "Part-owners" },
            { v: "$40", label: "Cheapest way in" },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 80} className="text-center">
              <p className="font-heading text-4xl font-bold text-gold md:text-5xl">
                {s.v}
              </p>
              <p className="mt-1 text-xs uppercase tracking-wide text-cream/55">
                {s.label}
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- HOW IT WORKS ---- */}
      <section id="how" className="container-bpm py-16">
        <Reveal>
          <p className="eyebrow">Dead simple</p>
          <h2 className="mt-3 font-heading text-4xl font-bold text-cream md:text-5xl">
            Spectator to owner. Three taps.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {[
            {
              n: "01",
              t: "Load your wallet",
              d: "Chuck in $200 (or whatever). Card payment, done in seconds.",
            },
            {
              n: "02",
              t: "Pick a horse, buy shares",
              d: "Scroll the book, find your pony, grab your shares. You're an owner.",
            },
            {
              n: "03",
              t: "Get paid when it runs",
              d: "Prizemoney lands in your wallet, split by your shares. Withdraw whenever.",
            },
          ].map((step, i) => (
            <Reveal key={step.n} delay={i * 110}>
              <div className="card group h-full p-7 transition hover:-translate-y-1 hover:border-gold/40 hover:shadow-gold">
                <p className="font-heading text-5xl font-bold text-gold/25 transition group-hover:text-gold/50">
                  {step.n}
                </p>
                <h3 className="mt-3 font-heading text-2xl font-bold text-cream">
                  {step.t}
                </h3>
                <p className="mt-2 text-cream/65">{step.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---- SOCIAL PROOF ---- */}
      <section className="border-y border-white/10 bg-racing-975/40">
        <div className="container-bpm py-16">
          <div className="grid gap-10 md:grid-cols-[280px_1fr] md:items-center">
            <Reveal>
              <div className="text-center md:text-left">
                <p className="font-heading text-6xl font-bold text-gold">4.8</p>
                <p className="mt-1 text-gold-300">★★★★★</p>
                <p className="mt-2 text-sm text-cream/55">
                  Owners who&apos;d tell their mates
                </p>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                {
                  q: "Bought in on a Tuesday, screenshotted a win by Saturday. Cheapest fun I've had.",
                  n: "Jords, first-time owner",
                },
                {
                  q: "Thought owning a racehorse was for rich blokes. Turns out it's the price of a big night.",
                  n: "Priya",
                },
                {
                  q: "The wallet payout hitting after a win is a genuinely elite feeling.",
                  n: "Macca",
                },
              ].map((t, i) => (
                <Reveal key={i} delay={i * 90}>
                  <figure className="card h-full p-5">
                    <p className="text-gold-300">★★★★★</p>
                    <blockquote className="mt-2 text-sm text-cream/80">
                      “{t.q}”
                    </blockquote>
                    <figcaption className="mt-3 text-xs uppercase tracking-wide text-cream/45">
                      {t.n}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---- FAQ ---- */}
      <section className="container-bpm py-16">
        <Reveal>
          <div className="text-center">
            <p className="eyebrow">Got questions?</p>
            <h2 className="mt-2 font-heading text-4xl font-bold text-cream md:text-5xl">
              We&apos;ve got straight answers.
            </h2>
          </div>
        </Reveal>
        <Faq />
      </section>

      {/* ---- CLOSING CTA ---- */}
      <section className="relative overflow-hidden border-t border-gold/20 bg-racing-gradient">
        {/* ghost repeat */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex flex-col justify-center overflow-hidden opacity-[0.05]"
        >
          {["ARE YOU IN?", "ARE YOU IN?", "ARE YOU IN?"].map((t, i) => (
            <span
              key={i}
              className="whitespace-nowrap font-heading text-[11vw] font-bold leading-[0.9] text-cream"
            >
              {t} {t}
            </span>
          ))}
        </div>

        <div className="container-bpm relative py-20 text-center">
          <Reveal>
            <LogoMark className="heartbeat mx-auto h-16 w-16" />
          </Reveal>
          <Reveal delay={80}>
            <h2 className="mt-6 font-heading text-5xl font-bold leading-tight text-cream md:text-6xl">
              Stop watching.
              <br />
              <span className="text-gold">Start owning.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-lg text-lg text-cream/70">
              Everyone&apos;s got that mate who says they&apos;ll get into
              racehorses one day. Be the one who actually did — for $200.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <Link
              href="/register"
              className="group btn-gold mt-9 px-9 py-4 text-lg"
            >
              Fuck it, I&apos;m in <span className="nudge">→</span>
            </Link>
          </Reveal>
          <Reveal delay={320}>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-gold-300">
              Get Your Heart Racing
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
