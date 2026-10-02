import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";

// The Insider sign-up panel. Uses h-full + flex so it fills the height of the
// top row (content distributes top→bottom).
export default function InsiderPanel() {
  return (
    <section className="sheet flex h-full flex-col border-t-[3px] border-t-navy p-6">
      <p className="kicker kicker-gold">The Insider · Free</p>
      <h2 className="font-headline mt-3 text-[26px] font-bold leading-[1.12] text-navy [text-wrap:balance]">
        Exclusive insights. Every Thursday.
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-[#4a4e57]">
        In-depth stories, industry whispers and international coverage you won&apos;t find anywhere
        else.
      </p>

      <div className="mt-5">
        <SubscribeForm cta="Subscribe" />
      </div>

      <ul className="mt-5 border-t border-line text-[14px] text-[#33363d]">
        <li className="border-b border-line py-2.5">Form and features before the meeting</li>
        <li className="border-b border-line py-2.5">Trainer and driver insight from the stables</li>
        <li className="border-b border-line py-2.5">Racing from both hemispheres in one read</li>
      </ul>

      <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pt-4">
        <p className="text-[12px] font-semibold tracking-wide text-muted">7,000+ readers · Thursdays, 3pm</p>
        <Link href="/the-insider/" className="whitespace-nowrap text-[12px] font-bold uppercase tracking-[0.1em] text-navy hover:text-blue">
          Past editions →
        </Link>
      </div>
    </section>
  );
}
