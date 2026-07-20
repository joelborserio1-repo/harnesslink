import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Insider — Free Weekly Harness Racing Briefing",
  description:
    "Sign up free for The Insider, Harnesslink's weekly briefing — form, features and the tips that matter, every Thursday. Browse past editions.",
  alternates: { canonical: "https://harnesslink.com/the-insider/" },
};

// Placeholder edition list. Wired to the WordPress `edition` post type once
// that content is imported (there are ~10 published editions on the live site).
type Edition = { no: number; title: string; date: string };
const EDITIONS: Edition[] = [
  { no: 42, title: "Inter Dominion wrap, Grand Circuit form & the tips", date: "July 17, 2026" },
  { no: 41, title: "Sales week special — who to follow home", date: "July 10, 2026" },
  { no: 40, title: "Winter carnival preview and driver watch", date: "July 3, 2026" },
  { no: 39, title: "Breeding barn notes and the value plays", date: "June 26, 2026" },
  { no: 38, title: "Trainers on form + a stakes weekend guide", date: "June 19, 2026" },
  { no: 37, title: "Mid-season report card and the ones to beat", date: "June 12, 2026" },
];

export default function InsiderPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {/* Sign-up hero */}
      <section
        className="overflow-hidden rounded-2xl p-8 text-white shadow-[0_6px_20px_rgba(8,31,91,0.15)] sm:p-12"
        style={{ background: "linear-gradient(160deg, var(--color-navy), #0a2470)" }}
      >
        <div className="max-w-2xl">
          <p className="eyebrow text-[15px] text-[#9db4ec]">Subscriber Briefing</p>
          <h1 className="font-headline text-4xl font-extrabold sm:text-5xl">The Insider</h1>
          <p className="mt-3 text-lg text-[#cdd8f4]">
            Harnesslink&apos;s free weekly briefing — form, features and the tips that matter,
            landing in your inbox every Thursday.
          </p>

          <form className="mt-6 flex flex-col gap-3 sm:flex-row" action="#">
            <input
              type="email"
              name="email"
              required
              placeholder="you@email.com"
              aria-label="Email address"
              className="w-full rounded-lg px-4 py-3 text-neutral-900 sm:max-w-sm"
            />
            <button
              type="submit"
              className="rounded-lg bg-amber px-6 py-3 font-bold text-[#241a00] hover:brightness-105"
            >
              Subscribe free
            </button>
          </form>
          <p className="mt-2 text-xs text-[#9db4ec]">Free forever. Unsubscribe any time.</p>
        </div>
      </section>

      {/* Past editions */}
      <section className="mt-10">
        <h2 className="mb-4 border-b-2 border-navy pb-2 font-headline text-2xl font-extrabold text-navy">
          Past Editions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {EDITIONS.map((e) => (
            <a
              key={e.no}
              href="#"
              className="card group flex flex-col p-5 transition hover:-translate-y-0.5"
            >
              <span className="eyebrow text-[13px]">Edition #{e.no}</span>
              <h3 className="mt-1 font-headline text-lg font-bold leading-snug text-navy [text-wrap:balance] group-hover:text-blue">
                {e.title}
              </h3>
              <span className="mt-auto pt-3 text-xs uppercase tracking-wide text-muted">{e.date}</span>
            </a>
          ))}
        </div>
        <p className="mt-6 text-sm text-muted">
          More editions are added every Thursday. The full back-catalogue appears here once the
          archive is migrated.
        </p>
      </section>
    </div>
  );
}
