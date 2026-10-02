import type { StaticPage } from "@/lib/api";

// A migrated WordPress page (privacy policy, terms, …): title plus its body
// HTML, preserved verbatim and styled like article copy.
export default function StaticPageView({ page }: { page: StaticPage }) {
  return (
    <div className="wrap my-7">
      <article className="sheet px-5 py-8 sm:px-10 sm:py-10">
        <div className="mx-auto max-w-[760px]">
          <h1 className="font-headline text-[34px] font-bold leading-[1.1] text-navy-deep [text-wrap:balance] sm:text-[44px]">
            {page.title}
          </h1>
          <div className="mt-5 border-t border-line pt-6">
            {page.body_html ? (
              <div className="prose-article" dangerouslySetInnerHTML={{ __html: page.body_html }} />
            ) : (
              <p className="text-neutral-500">(No content yet.)</p>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}
