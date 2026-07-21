import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "BPM Bloodstock - Get Your Heart Racing",
  description:
    "Own a share of the action. Micro-shares in pacers and trotters - buy, follow, and share in the prizemoney.",
};

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
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800;900&family=Montserrat:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Nav />
        <main className="min-h-[calc(100vh-4rem-1px)]">{children}</main>
        <footer className="border-t border-white/10 bg-racing-975/60">
          <div className="container-bpm flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <LogoMark className="h-8 w-8" />
              <div>
                <p className="font-heading text-sm font-bold tracking-[0.18em] text-cream">
                  BPM BLOODSTOCK
                </p>
                <p className="text-[11px] uppercase tracking-[0.3em] text-gold-300">
                  Get Your Heart Racing
                </p>
              </div>
            </div>
            <p className="max-w-md text-xs leading-relaxed text-cream/45">
              Scaffold / demonstration only. Fractional ownership involves risk;
              prizemoney is never guaranteed. Any live version would require the
              appropriate racing, AFSL/financial-product and AML/KYC approvals.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
