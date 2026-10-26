import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AccountPanel } from "@/components/account/panels";
import { SESSION, readerApi, type Reader } from "@/lib/reader";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function MyAccountPage() {
  const token = (await cookies()).get(SESSION)?.value;
  if (!token) redirect("/login/?next=/my-account/");
  const { ok, data } = await readerApi("me", { token });
  if (!ok) redirect("/login/?next=/my-account/");
  return <AccountPanel reader={data.reader as Reader} />;
}
