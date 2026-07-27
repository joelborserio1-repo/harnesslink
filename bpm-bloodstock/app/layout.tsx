import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { AnnouncementBanner } from "@/components/AnnouncementBanner";
import { LogoMark } from "@/components/Logo";
import { brandLogoSrc, brandIconSrc } from "@/lib/brand";

export async function generateMetadata(): Promise<Metadata> {
  const icon = brandIconSrc();
  return {
    title: "StrideShares by BPM Bloodstock | Get Your Heart Racing",
    description:
      "StrideShares is micro-share racehorse ownership by BPM Bloodstock. Own a real share of a pacer or trotter, follow every run, and share in the prizemoney.",
    // If you drop public/brand/icon.<ext> it becomes the favicon; otherwise the
    // built-in app/icon.svg is used.
    ...(icon ? { icons: { icon } } : {}),
  };
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AnnouncementBanner />
        <Nav />
        <main className="min-h-[calc(100vh-4rem-1px)]">{children}</main>
        <footer className="border-t border-white/10 bg-racing-975/60">
          <div className="container-bpm flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              {brandLogoSrc() ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brandLogoSrc()!}
                    alt="StrideShares by BPM Bloodstock"
                    className="h-10 w-auto"
                  />
                  <div>
                    <p className="font-heading text-sm font-bold italic tracking-[0.02em] text-cream">
                      StrideShares
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-gold-300">
                      by BPM Bloodstock
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <LogoMark className="h-8 w-8" />
                  <div>
                    <p className="font-heading text-sm font-bold italic tracking-[0.02em] text-cream">
                      STRIDESHARES
                    </p>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-gold-300">
                      by BPM Bloodstock
                    </p>
                  </div>
                </>
              )}
            </div>
            <div className="max-w-md space-y-2">
              <p className="text-xs leading-relaxed text-cream/60">
                StrideShares by BPM Bloodstock. Micro-share racehorse ownership
                in pacers and trotters. Get Your Heart Racing.
              </p>
              <p className="text-xs leading-relaxed text-cream/45">
                Scaffold / demonstration only. Micro-share ownership involves
                risk; prizemoney is never guaranteed. StrideShares is a
                customer-facing brand of BPM Bloodstock, which operates the
                offering. Any live version would require the appropriate racing,
                AFSL/financial-product and AML/KYC approvals.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
