import type { Metadata } from "next";
import { headers } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The admin section has its own chrome — skip the public header/footer there.
  const path = (await headers()).get("x-invoked-path") || "";
  const isAdmin = path.startsWith("/admin");

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Source+Sans+3:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col bg-white text-neutral-900">
        {!isAdmin && <SiteHeader />}
        <main className="flex-1">{children}</main>
        {!isAdmin && <SiteFooter />}
      </body>
    </html>
  );
}
