import type { Metadata } from "next";
import Link from "next/link";
import { listPagesUnder } from "@/lib/api";
import { pageSocial, SITE_URL } from "@/lib/seo";

// /podcasts/: every episode of The Final Qtr, newest first. Same address as
// the old WordPress podcast archive.
export const dynamic = "force-dynamic";

const TITLE = "Podcasts - Harnesslink";
const DESCRIPTION = "The Final Qtr, the Harnesslink harness racing podcast. Every episode, newest first.";
const URL = `${SITE_URL}/podcasts/`;

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: URL },
  ...pageSocial({ title: TITLE, description: DESCRIPTION, url: URL }),
};

export default async function Podcasts() {
  const episodes = await listPagesUnder("podcasts");
  return (
    <div className="wrap my-7">
      <section className="sheet px-5 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-[760px]">
          <p className="kicker kicker-gold">Podcast</p>
          <h1 className="font-headline text-[34px] font-bold leading-[1.1] text-navy-deep sm:text-[44px]">The Final Qtr</h1>
          <p className="mt-3 text-neutral-600">{DESCRIPTION}</p>
          {episodes.length ? (
            <ul className="mt-6 divide-y divide-line border-t border-line">
              {episodes.map((e) => (
                <li key={e.url}>
                  <Link href={e.url} className="block py-4 font-headline text-xl font-bold text-navy hover:underline">
                    {e.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-neutral-500">No episodes yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
