import type { Metadata } from "next";
import { RegisterPanel } from "@/components/account/panels";

export const metadata: Metadata = { title: "Create a free account", robots: { index: false, follow: true } };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <RegisterPanel next={next} />;
}
