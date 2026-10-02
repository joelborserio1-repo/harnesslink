import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getMe, type StaffUser } from "@/lib/admin";
import { signOutAction } from "./actions";

const ROLE_LABEL = { contributor: "Journalist", editor: "Editor", admin: "Admin" } as const;

function navFor(me: StaffUser) {
  const publish = me.role !== "contributor";
  return [
    { href: "/admin/", label: publish ? "Stories" : "My stories", show: true },
    { href: "/admin/?status=in_review", label: "Review queue", show: publish },
    { href: "/admin/directory/", label: "Directory", show: publish },
    { href: "/admin/ads/", label: "Ads", show: me.role === "admin" },
    { href: "/admin/users/", label: "Staff", show: me.role === "admin" },
  ].filter((n) => n.show);
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getMe();
  const path = (await headers()).get("x-invoked-path") || "";
  const onLogin = path.startsWith("/admin/login");

  // proxy.ts only checks that a session cookie exists; an expired or revoked
  // one lands here and goes back to the sign-in page.
  if (!me && !onLogin) redirect("/admin/login/");

  return (
    <div className="min-h-full bg-neutral-50">
      <div className="bg-navy text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin/" className="font-headline text-xl font-bold tracking-[0.04em] [font-variant-caps:small-caps]">
            HarnessLink <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60 [font-variant-caps:normal]">Newsroom</span>
          </Link>
          {me ? (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-white/80">
                {me.name || me.email} · <span className="text-white/55">{ROLE_LABEL[me.role]}</span>
              </span>
              <Link href="/" className="text-white/70 hover:text-white">View site</Link>
              <form action={signOutAction}>
                <button className="text-white/70 underline-offset-2 hover:text-white hover:underline">Sign out</button>
              </form>
            </div>
          ) : (
            <Link href="/" className="text-sm text-white/70 hover:text-white">Back to the site</Link>
          )}
        </div>
        {me && (
          <nav aria-label="Newsroom" className="border-t border-white/15">
            <div className="mx-auto flex max-w-5xl flex-wrap gap-x-6 px-4">
              {navFor(me).map((n) => (
                <Link key={n.href} href={n.href} className="py-2.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-white/80 hover:text-white">
                  {n.label}
                </Link>
              ))}
              <Link href="/admin/articles/new/" className="ml-auto py-2.5 text-[12px] font-bold uppercase tracking-[0.12em] text-amber hover:text-white">
                + New story
              </Link>
            </div>
          </nav>
        )}
      </div>
      {children}
    </div>
  );
}
