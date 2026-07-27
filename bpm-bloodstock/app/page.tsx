import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatCentsCompact } from "@/lib/money";
import { Reveal, CountUp } from "@/components/Motion";
import { Faq } from "@/components/Faq";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { brandPromoSrc } from "@/lib/brand";

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
  // Promo/lifestyle image for the brand panel (drop public/brand/promo.jpg);
  // falls back to the featured horse's photo.
  const promo = brandPromoSrc();
  const heroPhoto = featured[0]?.imageUrl || "";
  const panelImg = promo || heroPhoto;

  const [horses, invested, shareholders] = await Promise.all([
    prisma.offering.count(),
    prisma.order.aggregate({ _sum: { totalCents: true } }),
    prisma.user.count({ where: { holdings: { some: {} } } }),
  ]);

  return (
    <div className="overflow-hidden">
      {/* ============ HERO (video, dark) ============ */}
      <section className="relative flex min-h-[86vh] items-center justify-center overflow-hidden">
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
        {/* Lighter overlay so the video reads through - just enough for text legibility. */}
        <div className="absolute inset-0 bg-green-900/35" />
        <div className="absolute inset-0 bg-gradient-to-t from-green-900 via-green-900/5 to-green-900/25" />

        <div className="container-bpm relative z-10 py-24 text-center">
          <Reveal delay={80}>
            <h1 className="mx-auto max-w-5xl font-heading text-6xl uppercase leading-[0.9] tracking-tight text-cream drop-shadow-[0_4px_24px_rgba(0,0,0,0.5)] sm:text-7xl md:text-8xl">
              Get your heart racing
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-cream/80">
              Own a real slice of our pacers and trotters. Buy shares from the
              price of a night out, follow every run, and share in the
              prizemoney.
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
        </div>
      </section>

      {/* ============ BUILD YOUR STABLE (light) ============ */}
      <section className="bg-paper text-green-900">
        <div className="container-bpm py-20 md:py-24">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">
                Open for ownership
              </p>
              <h2 className="mt-2 font-heading text-4xl font-bold tracking-tight md:text-5xl">
                Build your stable
              </h2>
              <p className="mt-3 text-green-700">
                Our current runner. Grab your shares and you are an owner, on the
                slip and in on the prizemoney.
              </p>
            </Reveal>
          </div>
          <Reveal delay={100} className="mt-10 block">
            <FeaturedCarousel offerings={featured} />
          </Reveal>
        </div>
      </section>

      {/* ============ HOW FRACTIONAL OWNERSHIP WORKS (light) ============ */}
      <section id="how" className="border-t border-paper-200 bg-paper text-green-900">
        <div className="container-bpm py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">
                How it works
              </p>
              <h2 className="mt-2 font-heading text-4xl font-bold tracking-tight md:text-5xl">
                One horse, split into shares
              </h2>
            </Reveal>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-4">
            {[
              ["01", "We buy the horse", "BPM secures a pacer or trotter and splits it into thousands of small shares."],
              ["02", "You pick your slice", "Buy from around $50 a share. One share or a few hundred, your call."],
              ["03", "You own your %", "Your shares are your stake. The more you hold, the bigger your cut."],
              ["04", "You share the winnings", "When the horse earns, prizemoney is split by shares held, to the cent."],
            ].map(([n, t, d], i) => (
              <Reveal key={n} delay={i * 90}>
                <div className="h-full rounded-2xl border border-paper-200 bg-white p-6">
                  <p className="font-heading text-4xl font-bold text-green-600/40">{n}</p>
                  <h3 className="mt-2 font-heading text-lg font-bold">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-green-700">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ============ WHAT YOU GET (light) ============ */}
      <section className="border-t border-paper-200 bg-paper text-green-900">
        <div className="container-bpm py-20">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">
                What you get
              </p>
              <h2 className="mt-2 font-heading text-4xl font-bold tracking-tight md:text-5xl">
                Ownership, without the gatekeeping
              </h2>
              <p className="mt-4 text-green-700">
                Buying in is the start. You get the whole experience, at the
                track and from your couch.
              </p>
              <ul className="mt-7 space-y-4">
                {[
                  ["Behind the scenes", "Updates on your horse from the stable, trackwork to race night."],
                  ["Race-day access", "Owner invites and the chance to be there when your horse runs."],
                  ["Real prizemoney", "Your cut of every win, paid to your wallet and yours to withdraw."],
                  ["A proper community", "You are an owner, not a number. Follow along with everyone on the slip."],
                ].map(([t, d]) => (
                  <li key={t} className="flex gap-4">
                    <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-800 text-xs text-gold">
                      ✓
                    </span>
                    <div>
                      <p className="font-heading font-bold">{t}</p>
                      <p className="text-sm text-green-700">{d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Reveal>
            <Reveal delay={120}>
              <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-green-900 ring-1 ring-green-600">
                {panelImg ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={panelImg}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : null}
                {/* The promo image has its own baked-in text; only add our
                    caption when we're falling back to a plain horse photo. */}
                {!promo && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-green-900 via-green-900/40 to-transparent p-6">
                    <p className="font-heading text-2xl font-bold uppercase tracking-tight text-cream">
                      Strength. Rhythm. Heart.
                    </p>
                    <p className="text-sm text-gold">Get Your Heart Racing</p>
                  </div>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ============ STATS (dark band) ============ */}
      <section className="bg-green-900">
        <div className="container-bpm grid grid-cols-2 gap-6 py-14 md:grid-cols-4">
          {[
            { v: <CountUp to={horses} />, label: "Horses on the book" },
            { v: formatCentsCompact(invested._sum.totalCents ?? 0), label: "Backed by members" },
            { v: <CountUp to={shareholders} />, label: "Part-owners" },
            { v: "$50", label: "Cheapest way in" },
          ].map((s, i) => (
            <Reveal key={i} delay={i * 80} className="text-center">
              <p className="font-heading text-4xl font-bold text-gold md:text-5xl">{s.v}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-sage">{s.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ============ REVIEWS (light) ============ */}
      <section className="bg-paper text-green-900">
        <div className="container-bpm py-20">
          <div className="grid gap-10 md:grid-cols-[300px_1fr] md:items-center">
            <Reveal>
              <div className="text-center md:text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">
                  Reviews
                </p>
                <p className="mt-2 font-heading text-6xl font-bold text-green-900">4.8</p>
                <p className="mt-1 text-lg text-gold">★★★★★</p>
                <p className="mt-2 text-sm text-green-700">
                  From owners who have taken the plunge
                </p>
              </div>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Bought in on a whim and watched my horse win a fortnight later. Best money I have spent all year.", "Jordan, Sydney"],
                ["Always thought owning a racehorse was out of reach. Turns out it is the price of a good night out.", "Priya, Melbourne"],
                ["Seeing the prizemoney land in my account after a win is a feeling like no other.", "Mitch, Newcastle"],
              ].map(([q, n], i) => (
                <Reveal key={i} delay={i * 90}>
                  <figure className="h-full rounded-2xl border border-paper-200 bg-white p-5">
                    <p className="text-gold">★★★★★</p>
                    <blockquote className="mt-2 text-sm text-green-800">
                      &ldquo;{q}&rdquo;
                    </blockquote>
                    <figcaption className="mt-3 text-xs uppercase tracking-wide text-green-600">
                      {n}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============ FAQ (dark) ============ */}
      <section className="border-t border-green-600 bg-green-900">
        <div className="container-bpm py-20">
          <Reveal>
            <div className="text-center">
              <p className="eyebrow">Got questions?</p>
              <h2 className="mt-2 font-heading text-4xl font-bold tracking-tight text-cream md:text-5xl">
                We have straight answers
              </h2>
            </div>
          </Reveal>
          <Faq />
        </div>
      </section>

      {/* ============ CLOSING CTA (dark) ============ */}
      <section className="relative overflow-hidden border-t border-gold/20 bg-racing-gradient">
        <div className="container-bpm relative py-20 text-center">
          <Reveal delay={80}>
            <h2 className="font-heading text-5xl font-bold uppercase leading-[0.95] tracking-tight text-cream md:text-7xl">
              Stop watching.
              <br />
              <span className="text-gold">Start owning.</span>
            </h2>
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-lg text-lg text-cream/70">
              Real ownership in a real racehorse, from the price of a night out.
              Follow every run, share in the prizemoney, enjoy the ride.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <Link href="/register" className="group btn-gold mt-9 px-9 py-4 text-lg">
              Get involved <span className="nudge">→</span>
            </Link>
          </Reveal>
          <Reveal delay={320}>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-gold">
              Get Your Heart Racing
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
