import Link from "next/link";

// The Insider subscriber box. Uses h-full + flex so it fills the featured
// hero's height in the top row (content distributes top→bottom).
export default function InsiderPanel() {
  return (
    <div
      className="flex h-full flex-col rounded-xl p-6 text-white shadow-[0_6px_20px_rgba(8,31,91,0.15)]"
      style={{ background: "linear-gradient(160deg, var(--color-navy), #0a2470)" }}
    >
      <div>
        <p className="eyebrow text-[15px] text-[#9db4ec]">Subscriber Briefing</p>
        <h3 className="font-headline mt-0.5 text-2xl font-bold">The Insider</h3>
        <p className="mt-2 text-sm text-[#cdd8f4]">
          Our free weekly briefing — form, features and the tips that matter, every Thursday.
        </p>
      </div>

      <ul className="my-5 space-y-2.5 text-sm text-[#dbe4f8]">
        <li className="flex gap-2"><span className="text-amber">✓</span> Form and features before the meeting</li>
        <li className="flex gap-2"><span className="text-amber">✓</span> Trainer &amp; driver insights</li>
        <li className="flex gap-2"><span className="text-amber">✓</span> The tips that matter, every week</li>
      </ul>

      <form className="mt-auto flex flex-col gap-2.5" action="/the-insider/">
        <input
          type="email"
          name="email"
          placeholder="you@email.com"
          aria-label="Email address"
          className="rounded-lg px-3 py-2.5 text-sm text-neutral-900"
        />
        <button type="submit" className="rounded-lg bg-amber px-3 py-2.5 text-sm font-bold text-[#241a00]">
          Subscribe free
        </button>
      </form>

      <Link href="/the-insider/" className="mt-3 text-center text-xs font-semibold text-[#9db4ec] hover:text-white">
        Browse past editions →
      </Link>
    </div>
  );
}
