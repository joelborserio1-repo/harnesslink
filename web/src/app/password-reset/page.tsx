import type { Metadata } from "next";
import { PasswordResetPanel } from "@/components/account/panels";

export const metadata: Metadata = { title: "Set your password", robots: { index: false, follow: false } };

export default async function PasswordResetPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <PasswordResetPanel code={code} />;
}
