import Link from "next/link";
import type { AuthorDetail } from "@/lib/api";

// End-of-article author note — name, role, bio, link to the author archive.
// An E-E-A-T signal and a clean internal link to /writers/{slug}/.
export default function AuthorBox({ author }: { author: AuthorDetail }) {
  return (
    <aside className="mt-9 border-l-[3px] border-navy bg-mist px-5 py-4">
      <p className="kicker kicker-gold">{author.role_title || "Contributor"}</p>
      <h3 className="font-headline mt-1 text-[20px] font-bold text-navy">
        <Link href={author.url} className="hl-link">
          {author.name}
        </Link>
      </h3>
      {author.bio && <p className="mt-1.5 text-[14.5px] leading-relaxed text-[#474b54]">{author.bio}</p>}
      <Link
        href={author.url}
        className="mt-2 inline-block text-[12px] font-bold uppercase tracking-[0.1em] text-navy hover:text-blue"
      >
        More from {author.name} →
      </Link>
    </aside>
  );
}
