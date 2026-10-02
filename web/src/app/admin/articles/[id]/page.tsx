import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { getArticle, listCategories, listAuthors, updateArticle, getMe, canPublish } from "@/lib/admin";
import TipTapEditor from "@/components/admin/TipTapEditor";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "Awaiting review",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};
const DESK_STATUSES = ["draft", "in_review", "published", "scheduled", "archived"];
const JOURNALIST_STATUSES = ["draft", "in_review"];

export default async function EditArticle({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [article, categories, authors, me] = await Promise.all([
    getArticle(id),
    listCategories(),
    listAuthors(),
    getMe(),
  ]);
  if (!article) notFound();
  const desk = canPublish(me);
  const statuses = desk ? DESK_STATUSES : JOURNALIST_STATUSES;
  // A journalist's story is read-only to them once the desk has taken it.
  const locked = !desk && !JOURNALIST_STATUSES.includes(article.status);

  async function save(formData: FormData) {
    "use server";
    const body = {
      title: formData.get("title"),
      subtitle: formData.get("subtitle"),
      slug: formData.get("slug"),
      status: formData.get("status"),
      needs_review: formData.get("needs_review") === "on",
      seo_title: formData.get("seo_title"),
      seo_description: formData.get("seo_description"),
      canonical_url: formData.get("canonical_url"),
      body_format: formData.get("body_format"),
      body_html: formData.get("body_html"),
      body_json: formData.get("body_json"),
      category_ids: formData.getAll("category_ids").map(Number),
      author_ids: formData.getAll("author_ids").map(Number),
    };
    const ok = await updateArticle(id, body);
    if (ok) {
      revalidatePath(`/admin/articles/${id}`);
      redirect("/admin");
    }
  }

  const input = "w-full border border-neutral-300 px-3 py-2 text-sm";
  const label = "block text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <Link href="/admin/" className="text-sm text-neutral-500 hover:text-navy">← Stories</Link>
        <a href={article.legacy_url ?? `/${article.slug}/`} className="text-sm font-semibold text-accent">
          View on site ↗
        </a>
      </div>
      <h1 className="font-headline text-2xl font-bold text-navy">Edit story</h1>
      {locked && (
        <p className="mt-3 border-l-[3px] border-navy bg-white px-3 py-2.5 text-sm text-neutral-700">
          This story is {STATUS_LABEL[article.status]?.toLowerCase() ?? article.status} and now sits with the desk. Ask an
          editor if it needs a change.
        </p>
      )}

      <form action={save} className="mt-6 space-y-5 border border-neutral-200 bg-white p-6">
        <div>
          <label className={label}>Title</label>
          <input name="title" defaultValue={article.title} className={input} />
        </div>
        <div>
          <label className={label}>Subtitle</label>
          <input name="subtitle" defaultValue={article.subtitle ?? ""} className={input} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Slug (URL path)</label>
            <input name="slug" defaultValue={article.slug} className={input} />
          </div>
          <div>
            <label className={label}>Status</label>
            <select name="status" defaultValue={article.status} className={input}>
              {(locked ? [article.status] : statuses).map((s) => <option key={s} value={s}>{STATUS_LABEL[s] ?? s}</option>)}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label}>Categories</label>
            <select name="category_ids" multiple defaultValue={article.category_ids.map(String)} className={`${input} h-32`}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Byline (authors)</label>
            <select name="author_ids" multiple defaultValue={article.author_ids.map(String)} className={`${input} h-32`}>
              {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>
            Body{" "}
            <span className="font-normal normal-case text-neutral-400">
              {article.body_format === "tiptap_json" ? "(rich text)" : "(legacy HTML — edited verbatim)"}
            </span>
          </label>
          {article.body_format === "tiptap_json" ? (
            <TipTapEditor initialJSON={article.body_json} />
          ) : (
            <>
              {/* Legacy WP HTML is preserved verbatim — raw editing, no TipTap conversion. */}
              <input type="hidden" name="body_format" value="legacy_html" />
              <textarea name="body_html" defaultValue={article.body_html ?? ""} rows={14} className={`${input} font-mono text-xs`} />
            </>
          )}
        </div>

        <fieldset className="border border-neutral-200 p-4">
          <legend className="px-1 text-xs font-bold uppercase tracking-wide text-neutral-500">SEO</legend>
          <div className="space-y-3">
            <div>
              <label className={label}>SEO title</label>
              <input name="seo_title" defaultValue={article.seo_title ?? ""} className={input} />
            </div>
            <div>
              <label className={label}>Meta description</label>
              <textarea name="seo_description" defaultValue={article.seo_description ?? ""} rows={2} className={input} />
            </div>
            <div>
              <label className={label}>Canonical URL</label>
              <input name="canonical_url" defaultValue={article.canonical_url ?? ""} className={input} />
            </div>
          </div>
        </fieldset>

        {desk && (
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input type="checkbox" name="needs_review" defaultChecked={article.needs_review} />
            Import flag — needs a human check
          </label>
        )}

        <div className="flex gap-3">
          {!locked && <button className="btn">Save</button>}
          <Link href="/admin" className="border border-neutral-300 px-5 py-2 font-semibold text-neutral-600">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
