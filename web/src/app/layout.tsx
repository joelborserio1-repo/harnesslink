import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL("https://harnesslink.com"),
  title: {
    default: "Harnesslink — Harness Racing News",
    template: "%s | Harnesslink",
  },
  description:
    "Harness racing's global news source — results, features and analysis from Australia, New Zealand, North America and Europe.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-white text-neutral-900">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
