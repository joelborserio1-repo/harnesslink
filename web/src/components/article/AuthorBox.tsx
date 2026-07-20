import Link from "next/link";
import type { AuthorDetail } from "@/lib/api";

// End-of-article author card — name, role, bio, link to the author archive.
// An E-E-A-T signal and a clean internal link to /author/{slug}/.
export default function AuthorBox({ author }: { author: AuthorDetail }) {
  const initials = author.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <aside className="mt-10 flex gap-4 rounded-lg border border-black/[0.08] bg-page p-5">
      <div
        aria-hidden
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy text-lg font-bold text-white"
      >
        {initials}
      </div>
      <div className="min-w-0">
        <p className="eyebrow text-[13px]">{author.role_title || "Contributor"}</p>
        <h3 className="font-headline text-lg font-bold text-navy">
          <Link href={author.url} className="hover:text-blue">
            {author.name}
          </Link>
        </h3>
        {author.bio && <p className="mt-1 text-sm leading-relaxed text-[#4a4f59]">{author.bio}</p>}
        <Link href={author.url} className="mt-2 inline-block text-sm font-semibold text-blue hover:underline">
          More from {author.name} →
        </Link>
      </div>
    </aside>
  );
}
