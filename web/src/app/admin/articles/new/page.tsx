import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { listCategories, createArticle } from "@/lib/admin";
import TipTapEditor from "@/components/admin/TipTapEditor";

export const dynamic = "force-dynamic";

export default async function NewArticle() {
  const categories = await listCategories();

  async function save(formData: FormData) {
    "use server";
    const title = String(formData.get("title") || "").trim();
    const slugRaw = String(formData.get("slug") || "").trim();
    const slug = (slugRaw || title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const body: Record<string, unknown> = {
      title,
      slug,
      excerpt: formData.get("excerpt"),
      status: formData.get("status"),
      body_format: "tiptap_json",
      body_json: formData.get("body_json"),
      body_html: formData.get("body_html"),
      primary_category_id: formData.get("primary_category_id") || null,
      published_at: formData.get("status") === "published" ? new Date().toISOString() : null,
    };
    const article = await createArticle(body);
    if (article) {
      revalidatePath("/admin");
      redirect(`/admin/articles/${article.id}`);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link href="/admin" className="text-sm text-blue hover:underline">← Articles</Link>
      <h1 className="mt-2 text-2xl font-bold text-neutral-900">New article</h1>

      <form action={save} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-neutral-700">
          Title
          <input name="title" required
                 className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-neutral-700">
            Slug <span className="font-normal text-neutral-400">(auto from title if blank)</span>
            <input name="slug"
                   className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
          </label>
          <label className="block text-sm font-semibold text-neutral-700">
            Category
            <select name="primary_category_id"
                    className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal">
              <option value="">—</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold text-neutral-700">
          Excerpt
          <textarea name="excerpt" rows={2}
                    className="mt-1 block w-full rounded border border-neutral-300 px-3 py-2 font-normal" />
        </label>

        <div>
          <span className="text-sm font-semibold text-neutral-700">Body</span>
          <div className="mt-1"><TipTapEditor /></div>
        </div>

        <label className="block text-sm font-semibold text-neutral-700">
          Status
          <select name="status" defaultValue="draft"
                  className="mt-1 block w-56 rounded border border-neutral-300 px-3 py-2 font-normal">
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>

        <button className="rounded bg-navy px-4 py-2 text-sm font-semibold text-white">Save</button>
      </form>
    </div>
  );
}
