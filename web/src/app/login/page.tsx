import type { Metadata } from "next";
import { LoginPanel } from "@/components/account/panels";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <LoginPanel next={next} />;
}
