import Link from "next/link";
import { prisma } from "@/lib/db";
import { OfferingCard } from "@/components/Offering";
import { LogoMark } from "@/components/Logo";
import { formatCentsCompact } from "@/lib/money";
import { Reveal, CountUp } from "@/components/Motion";
import { Faq } from "@/components/Faq";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";

export const dynamic = "force-dynamic";

export default async function Home() {
  const offerings = await prisma.offering.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  const open = offerings.filter((o) => o.status === "OPEN");
  const featured = (open.length ? open : offerings).slice(0, 5).map((o) => ({
    slug: o.slug,
    name: o.name,
    discipline: o.discipline,
    tagline: o.tagline,
    description: o.description,
    heroColor: o.heroColor,
    imageUrl: o.imageUrl,
    sharePriceCents: o.sharePriceCents,
    totalShares: o.totalShares,
    sharesSold: o.sharesSold,
    status: o.status,
  }));

  const [horses, invested, shareholders] = await Promise.all([
    prisma.offering.count(),
    prisma.order.aggregate({ _sum: { totalCents: true } }),
    prisma.user.count({ where: { holdings: { some: {} } } }),
  ]);

  return (
    <div className="overflow-hidden">
      {/* ============ HERO (video) ============ */}
      <section className="relative flex min-h-[88vh] items-center justify-center overflow-hidden">
        {/* background video */}
        <video
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          poster="/hero-poster.jpg"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        {/* tint / legibility overlay */}
        <div className="absolute inset-0 bg-racing-950/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-racing-950 via-racing-950/30 to-racing-950/60" />

        <div className="container-bpm relative z-10 py-24 text-center">
          <Reveal delay={80}>
            <h1 className="mx-auto mt-6 max-w-4xl font-heading text-5xl font-bold uppercase leading-[0.95] text-cream sm:text-6xl md:text-7xl">
              Get your heart racing
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
              Own a real slice of our pacers and trotters. Buy shares from as
              little as the price of a night out, follow every run, and share in
              the prizemoney.
            </p>
          </Reveal>

          <Reveal delay={240}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link href="/offerings" className="group btn-gold px-8 py-3.5 text-base">
                Browse the horses <span className="nudge">→</span>
              </Link>
              <Link href="/#how" className="btn-outline px-8 py-3.5 text-base">
                How it works
              </Link>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <p className="mt-7 text-sm font-semibold uppercase tracking-[0.3em] text-gold-300">
              Own a runner from $200. Winnings paid to you.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ============ THE BOOK / FEATURED ============ */}
      <section className="border-y border-green-600 bg-green-900">
        <div className="container-bpm py-20">
        <div className="mx-auto max-w-2xl text-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sage">
              Open for ownership
            </p>
            <h2 className="mt-2 font-heading text-4xl font-bold text-cream md:text-5xl">
              Start your stable
            </h2>
            <p className="mt-3 text-sage">
              Browse what we have open right now and find a horse that suits your
              appetite for a bit of thrill.
            </p>
          </Reveal>
        </div>

        <Reveal delay={100} className="mt-10 block">
          <FeaturedCarousel offerings={featured} />
        </Reveal>

        {offerings.length > 1 && (
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {offerings.slice(0, 3).map((o, i) => (
              <Reveal key={o.id} delay={i * 90}>
                <OfferingCard offering={o} />
              </Reveal>
            ))}
          </div>
        )}
        <div className="mt-8 text-center">
          <Link href="/offerings" className="group text-sm font-semibold text-sage hover:text-cream">
            See the whole book <span className="nudge inline-block">→</span>
          </Link>
        </div>
        </div>
      </section>

      {/* ============ FRACTIONAL SHARES EXPLAINER ============ */}
      <section id="how" className="border-y border-white/10 bg-racing-975/40">
        <div className="container-bpm py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="eyebrow">How fractional ownership works</p>
              <h2 className="mt-2 font-heading text-4xl font-bold text-cream md:text-5xl">
                One horse. Split into shares. You buy the slice you want.
              </h2>
            </Reveal>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {[
              {
                n: "01",
                t: "We buy the horse",
                d: "BPM secures a pacer or trotter and splits it into thousands of small shares.",
              },
              {
                n: "02",
                t: "You pick your slice",
                d: "Buy from around $40 a share. One share or a few hundred, it is up to you.",
              },
              {
                n: "03",
                t: "You own your %",
                d: "Your shares are your stake in the horse. The more you hold, the bigger your cut.",
              },
              {
                n: "04",
                t: "You share the winnings",
                d: "When the horse earns, the prizemoney is split across owners by shares held, to the cent.",
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 100}>
                <div className="card h-full p-6">
                  <p className="font-heading text-4xl font-bold text-gold/25">
                    {s.n}
                  </p>
                  <h3 className="mt-2 font-heading text-lg font-bold text-cream">
                    {s.t}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-cream/60">
                    {s.d}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>

          {/* worked example */}
          <Reveal delay={120}>
            <div className="mt-10 rounded-xl border border-gold/20 bg-gold/[0.04] p-6 text-center md:p-8">
              <p className="text-sm uppercase tracking-widest text-gold-300">
                A quick example
              </p>
              <p className="mx-auto mt-3 max-w-3xl text-lg text-cream/80">
                Say a horse is split into 1,000 shares and you buy 20. You own 2%
                of the horse. If it wins $10,000, your share of the prizemoney is
                worked out on that 2%, and it lands in your winnings ready to
                withdraw.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ WHAT'S IN IT FOR YOU ============ */}
      <section className="container-bpm py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <Reveal>
            <p className="eyebrow">What you get</p>
            <h2 className="mt-2 font-heading text-4xl font-bold text-cream md:text-5xl">
              Ownership, without the gatekeeping
            </h2>
            <p className="mt-4 text-cream/65">
              Buying in is the start. You get the whole experience, at the track
              and from your couch.
            </p>
            <ul className="mt-7 space-y-4">
              {[
                ["Behind the scenes", "Updates on your horse from the stable, trackwork to race night."],
                ["Race-day access", "Owner invites and the chance to be there when your horse runs."],
                ["Real prizemoney", "Your cut of every win, paid to your winnings and yours to withdraw."],
                ["A proper community", "You are an owner, not a number. Follow along with everyone else on the slip."],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-4">
                  <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gold/15 text-xs text-gold">
                    ✓
                  </span>
                  <div>
                    <p className="font-heading font-bold text-cream">{t}</p>
                    <p className="text-sm text-cream/60">{d}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-gradient-to-br from-racing-900 to-racing-975 ring-1 ring-gold/20">
              <div className="absolute inset-0 grid place-items-center">
                <LogoMark className="heartbeat h-40 w-40 opacity-90" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-racing-950 to-transparent p-6">
                <p className="font-heading text-xl font-bold text-cream">
                  Strength. Rhythm. Heart.
                </p>
                <p className="text-sm text-gold-300">Get Your Heart Racing</p>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ============ STATS ============ */}
      <section className="border-y border-white/10 bg-racing-975/40">
        <div className="container-bpm grid grid-cols-2 gap-6 py-12 md:grid-cols-4">
          {[
            { v: <CountUp to={horses} />, label: "Horses in the book" },
            { v: formatCentsCompact(invested._sum.totalCents ?? 0), label: "Backed by members" },
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

      {/* ============ REVIEWS ============ */}
      <section className="container-bpm py-20">
        <div className="grid gap-10 md:grid-cols-[300px_1fr] md:items-center">
          <Reveal>
            <div className="text-center md:text-left">
              <p className="eyebrow">Reviews</p>
              <p className="mt-2 font-heading text-6xl font-bold text-gold">4.8</p>
              <p className="mt-1 text-lg text-gold-300">★★★★★</p>
              <p className="mt-2 text-sm text-cream/55">
                From owners who have taken the plunge
              </p>
            </div>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                q: "Bought in on a whim and watched my horse win a fortnight later. Best money I have spent all year.",
                n: "Jordan, Sydney",
              },
              {
                q: "Always thought owning a racehorse was out of reach. Turns out it is the price of a good night out.",
                n: "Priya, Melbourne",
              },
              {
                q: "Seeing the prizemoney land in my account after a win is a feeling like no other.",
                n: "Mitch, Newcastle",
              },
            ].map((t, i) => (
              <Reveal key={i} delay={i * 90}>
                <figure className="card h-full p-5">
                  <p className="text-gold-300">★★★★★</p>
                  <blockquote className="mt-2 text-sm text-cream/80">
                    &ldquo;{t.q}&rdquo;
                  </blockquote>
                  <figcaption className="mt-3 text-xs uppercase tracking-wide text-cream/45">
                    {t.n}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="border-t border-white/10 bg-racing-975/40">
        <div className="container-bpm py-20">
          <Reveal>
            <div className="text-center">
              <p className="eyebrow">Got questions?</p>
              <h2 className="mt-2 font-heading text-4xl font-bold text-cream md:text-5xl">
                We have straight answers
              </h2>
            </div>
          </Reveal>
          <Faq />
        </div>
      </section>

      {/* ============ CLOSING CTA ============ */}
      <section className="relative overflow-hidden border-t border-gold/20 bg-racing-gradient">
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
              Real ownership in a real racehorse, from $200. Follow every run,
              share in the prizemoney, and enjoy the ride.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <Link href="/register" className="group btn-gold mt-9 px-9 py-4 text-lg">
              Get involved <span className="nudge">→</span>
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
