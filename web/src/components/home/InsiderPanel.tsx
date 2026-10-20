import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";

// The Insider sign-up panel. Uses h-full + flex so it fills the height of the
// top row (content distributes top→bottom).
export default function InsiderPanel() {
  return (
    <section className="sheet relative flex h-full flex-col px-6 py-6 sm:pl-[49px] sm:pr-[29px] sm:py-7">
      {/* The live site's round "Subscribe free" badge. */}
      <span aria-hidden className="absolute right-5 top-4 grid h-[52px] w-[52px] place-items-center rounded-full border-2 border-white bg-navy-deep text-center text-white shadow-[0_0_0_2px_var(--color-navy-deep)]">
        <span className="font-ui text-[6px] font-bold uppercase leading-none tracking-wider">Subscribe<br /><span className="text-[11px]">Free</span></span>
      </span>
      <p className="panel-label">The Insider</p>
      <h2 className="font-headline mt-3 text-[30px] font-semibold leading-[1.2] text-[#070400] [text-wrap:balance] sm:text-[34px]">
        Exclusive insights. Every Thursday.
      </h2>
      <p className="mt-2 text-[14px] leading-[1.5] text-[#5B6478]">
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
