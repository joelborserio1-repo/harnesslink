import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMe, listAuthors, listUsers, saveUser } from "@/lib/admin";

export const dynamic = "force-dynamic";

const ROLES = [
  { value: "contributor", label: "Journalist — files and submits own stories" },
  { value: "editor", label: "Editor — reviews, publishes, edits any story" },
  { value: "admin", label: "Admin — editor, plus ads and staff accounts" },
];

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const me = await getMe();
  if (me?.role !== "admin") redirect("/admin/");
  const [users, authors, sp] = await Promise.all([listUsers(), listAuthors(), searchParams]);

  async function save(formData: FormData) {
    "use server";
    const idRaw = formData.get("id");
    const id = idRaw ? Number(idRaw) : null;
    const body: Record<string, unknown> = {
      name: formData.get("name"),
      role: formData.get("role"),
      author_id: formData.get("author_id") || "",
    };
    if (!id) body.email = formData.get("email");
    if (id) body.active = formData.get("active") === "on";
    const password = String(formData.get("password") || "");
    if (password) body.password = password;

    const errors = await saveUser(id, body);
    revalidatePath("/admin/users");
    redirect(errors ? `/admin/users/?error=${encodeURIComponent(errors.join(". "))}` : "/admin/users/?saved=1");
  }

  const input = "mt-1 block w-full border border-neutral-300 bg-white px-2.5 py-2 text-sm font-normal";
  const label = "block text-xs font-semibold uppercase tracking-wide text-neutral-500";

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="font-headline text-2xl font-bold text-navy">Staff accounts</h1>
      <p className="mt-1 max-w-[70ch] text-sm text-neutral-600">
        Everyone signs in with their own account. Deactivate an account when someone leaves — their
        stories and edit history stay attached to their name.
      </p>

      {sp.error && (
        <p role="alert" className="mt-4 border-l-[3px] border-red bg-white px-3 py-2.5 text-sm">{sp.error}</p>
      )}
      {sp.saved && <p className="mt-4 border-l-[3px] border-navy bg-white px-3 py-2.5 text-sm">Saved.</p>}

      <div className="mt-6 space-y-3">
        {users.map((u) => (
          <form key={u.id} action={save} className={`border bg-white p-4 ${u.active ? "border-neutral-200" : "border-neutral-200 opacity-70"}`}>
            <input type="hidden" name="id" value={u.id} />
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-semibold text-navy">
                {u.email}
                {u.id === me.id && <span className="ml-2 text-xs font-normal text-neutral-500">(you)</span>}
                {!u.active && <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-red">Deactivated</span>}
              </p>
              <p className="text-xs text-neutral-500">
                {u.last_sign_in_at
                  ? `Last signed in ${new Date(u.last_sign_in_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}`
                  : "Never signed in"}
              </p>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={label}>
                Name
                <input name="name" defaultValue={u.name ?? ""} className={input} />
              </label>
              <label className={label}>
                Role
                <select name="role" defaultValue={u.role} className={input} disabled={u.id === me.id}>
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label.split(" — ")[0]}</option>)}
                </select>
                {u.id === me.id && <input type="hidden" name="role" value={u.role} />}
              </label>
              <label className={label}>
                Files under byline
                <select name="author_id" defaultValue={u.author_id ?? ""} className={input}>
                  <option value="">— none —</option>
                  {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </label>
              <label className={label}>
                Set a new password
                <input type="password" name="password" autoComplete="new-password" placeholder="Leave blank to keep" minLength={10} className={input} />
              </label>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input type="checkbox" name="active" defaultChecked={u.active} disabled={u.id === me.id} />
                {u.id === me.id && <input type="hidden" name="active" value="on" />}
                Can sign in
              </label>
              <button className="bg-navy px-4 py-1.5 text-sm font-semibold text-white">Save</button>
            </div>
          </form>
        ))}
      </div>

      <h2 className="mt-10 font-headline text-xl font-bold text-navy">Add a staff member</h2>
      <form action={save} className="mt-3 grid gap-3 border border-neutral-200 bg-white p-4 sm:grid-cols-2">
        <label className={label}>
          Email
          <input type="email" name="email" required className={input} />
        </label>
        <label className={label}>
          Name
          <input name="name" required className={input} />
        </label>
        <label className={label}>
          Role
          <select name="role" defaultValue="contributor" className={input}>
            {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </label>
        <label className={label}>
          Files under byline
          <select name="author_id" defaultValue="" className={input}>
            <option value="">— none —</option>
            {authors.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label className={`${label} sm:col-span-2`}>
          First password (10 characters or more — pass it on privately; they can ask you to reset it)
          <input type="password" name="password" required minLength={10} autoComplete="new-password" className={input} />
        </label>
        <div className="sm:col-span-2">
          <button className="btn">Create account</button>
        </div>
      </form>
    </div>
  );
}
