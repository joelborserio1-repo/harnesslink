import type { Metadata } from "next";
import "./globals.css";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import { Suspense } from "react";
import MatomoTracker from "@/components/MatomoTracker";
import { DEFAULT_ROBOTS, DEFAULT_SHARE_IMAGE, HOME_DESCRIPTION, SITE_NAME, SITE_URL, TITLE_TEMPLATE } from "@/lib/seo";

// Defaults for every page; pages override what they know (src/lib/seo.ts).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: TITLE_TEMPLATE },
  description: HOME_DESCRIPTION,
  robots: DEFAULT_ROBOTS,
  openGraph: { type: "website", locale: "en_US", siteName: SITE_NAME, images: [DEFAULT_SHARE_IMAGE] },
  twitter: { card: "summary_large_image", images: [DEFAULT_SHARE_IMAGE.url] },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Heebo:wght@400;500;700&family=Playfair+Display:wght@600;700;800&family=Source+Sans+3:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="flex min-h-full flex-col bg-page text-neutral-900">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {process.env.MATOMO_URL && process.env.MATOMO_SITE_ID && (
          <Suspense fallback={null}>
            <MatomoTracker url={process.env.MATOMO_URL} siteId={process.env.MATOMO_SITE_ID} />
          </Suspense>
        )}
      </body>
    </html>
  );
}
