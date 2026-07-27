import Link from "next/link";
import { prisma } from "@/lib/db";
import { Reveal } from "@/components/Motion";
import { SafeImg } from "@/components/SafeImg";
import { brandPromoSrc } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "About StrideShares by BPM Bloodstock",
  description:
    "StrideShares is BPM Bloodstock's micro-share racehorse ownership offering. Built on heart, driven by passion, it opens harness racehorse ownership to everyone.",
};

export default async function AboutPage() {
  const withPhoto = await prisma.offering.findFirst({
    where: { imageUrl: { not: "" } },
    orderBy: { createdAt: "desc" },
    select: { imageUrl: true, name: true },
  });
  const promo = brandPromoSrc();
  const photo = promo || withPhoto?.imageUrl || "";

  return (
    <div className="overflow-hidden">
      {/* HERO (dark) */}
      <section className="border-b border-green-600 bg-green-900">
        <div className="container-bpm py-20 text-center md:py-28">
          <Reveal>
            <p className="eyebrow">About us</p>
            <h1 className="mx-auto mt-3 max-w-3xl font-heading text-5xl font-bold leading-[1.02] tracking-tight text-cream md:text-6xl">
              Ownership, opened up
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-lg text-cream/75">
              BPM Bloodstock is built on heart, driven by passion and defined by
              performance. StrideShares is how we take the thrill of owning a
              racehorse and make it something anyone can be part of.
            </p>
          </Reveal>
        </div>
      </section>

      {/* STORY (light) */}
      <section className="bg-paper text-green-900">
        <div className="container-bpm grid gap-12 py-20 md:grid-cols-2 md:items-center">
          <Reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">
              Our story
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
              Bred for the track, built for the fans
            </h2>
            <div className="mt-5 space-y-4 text-green-800">
              <p>
                We are harness people first. BPM Bloodstock syndicates pacers and
                trotters, and we have spent years around the stables, the sales
                and the big nights under lights.
              </p>
              <p>
                For too long, owning a racehorse meant a five or six figure cheque
                and a spot in a room most people never get invited to. We think
                that is the wrong way round. The passion for racing is everywhere.
                The ownership shouldn&apos;t be locked away from it.
              </p>
              <p>
                So we built StrideShares, breaking ownership into micro-shares.
                A share in one of our horses costs about the same as a night out.
                You get the runs, the results and a real cut of the prizemoney,
                without the barriers.
              </p>
            </div>
          </Reveal>
          <Reveal delay={120}>
            <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-green-900 ring-1 ring-green-600">
              <SafeImg
                src={photo}
                alt={withPhoto?.name || "StrideShares by BPM Bloodstock"}
                className="absolute inset-0 h-full w-full object-cover"
              />
              {!promo && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-green-900 via-green-900/40 to-transparent p-6">
                  <p className="font-heading text-xl font-bold text-cream">
                    Get Your Heart Racing
                  </p>
                  <p className="text-sm text-gold">StrideShares by BPM Bloodstock</p>
                </div>
              )}
            </div>
          </Reveal>
        </div>
      </section>

      {/* PILLARS (dark) */}
      <section className="bg-green-900">
        <div className="container-bpm py-20">
          <Reveal>
            <div className="text-center">
              <p className="eyebrow">What we stand for</p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight text-cream md:text-4xl">
                Strength. Rhythm. Heart.
              </h2>
            </div>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["Heart", "Passion. Connection.", "Racing gets in your blood. We build ownership around that feeling and make sure every member is genuinely in it, not just on a list."],
              ["Rhythm", "Consistency. Drive.", "Good horses and good outcomes come from doing the work, every day. We back honest types and manage them for the long run."],
              ["Strength", "Performance. Excellence.", "We select and prepare horses to compete, and we run the syndicate to the same standard: transparent, fair and to the cent."],
            ].map(([t, s, d], i) => (
              <Reveal key={t} delay={i * 90}>
                <div className="h-full rounded-2xl border border-green-600 bg-green-800 p-6">
                  <p className="font-heading text-2xl font-bold text-gold">{t}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-sage">
                    {s}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-cream/80">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* THE MODEL (light) */}
      <section className="bg-paper text-green-900">
        <div className="container-bpm py-20">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-green-600">
                Why micro-shares
              </p>
              <h2 className="mt-2 font-heading text-3xl font-bold tracking-tight md:text-4xl">
                Real ownership, made simple
              </h2>
            </Reveal>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              ["Accessible", "Buy in from the price of a night out. One share or a hundred, it is your call."],
              ["Transparent", "You own a set number of shares in a named horse. Prizemoney is split by those shares, down to the cent."],
              ["Yours", "Winnings land in your wallet and you withdraw whenever. No lock-ins, no surprise bills."],
            ].map(([t, d], i) => (
              <Reveal key={t} delay={i * 90}>
                <div className="h-full rounded-2xl border border-paper-200 bg-white p-6">
                  <h3 className="font-heading text-lg font-bold">{t}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-green-700">{d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PROMISE + CTA (dark) */}
      <section className="relative overflow-hidden border-t border-gold/20 bg-racing-gradient">
        <div className="container-bpm py-20 text-center">
          <Reveal delay={80}>
            <p className="mx-auto max-w-2xl font-heading text-2xl font-bold leading-snug tracking-tight text-cream md:text-3xl">
              Our promise: unforgettable ownership experiences, horses bred and
              built to compete, and a fair go for everyone on the slip.
            </p>
          </Reveal>
          <Reveal delay={160}>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-4">
              <Link href="/offerings" className="group btn-gold px-8 py-3.5 text-base">
                See the current runner <span className="nudge">→</span>
              </Link>
              <Link href="/register" className="btn-outline px-8 py-3.5 text-base">
                Become an owner
              </Link>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-gold">
              Get Your Heart Racing
            </p>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
