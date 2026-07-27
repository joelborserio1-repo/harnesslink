import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "./Logo";
import { formatCents } from "@/lib/money";
import { LogoutButton } from "./LogoutButton";
import { brandLogoSrc } from "@/lib/brand";

export async function Nav() {
  const user = await getCurrentUser();
  const logo = brandLogoSrc();

  return (
    <header className="sticky top-0 z-40 border-b border-green-600/60 bg-green-900/85 backdrop-blur">
      <div className="container-bpm flex h-16 items-center justify-between gap-4">
        <div className="flex items-center gap-8">
          {logo ? (
            <Link href="/" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="BPM Bloodstock" className="h-10 w-auto" />
            </Link>
          ) : (
            <Wordmark />
          )}
          <nav className="hidden items-center gap-7 md:flex">
            <Link href="/offerings" className="text-sm font-medium text-cream/80 transition hover:text-gold">
              Horses
            </Link>
            <Link href="/#how" className="text-sm font-medium text-cream/80 transition hover:text-gold">
              How it works
            </Link>
            <Link href="/about" className="text-sm font-medium text-cream/80 transition hover:text-gold">
              About
            </Link>
            {user && (
              <Link href="/dashboard" className="text-sm font-medium text-cream/80 transition hover:text-gold">
                My Stable
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" className="text-sm font-semibold text-gold transition hover:text-gold-200">
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/wallet"
                className="hidden items-center gap-2 rounded-full border border-gold/30 bg-gold/5 px-3.5 py-1.5 text-sm text-gold-100 hover:bg-gold/10 sm:flex"
              >
                <span className="text-cream/50">Wallet</span>
                <span className="font-semibold">
                  {formatCents(user.walletBalanceCents)}
                </span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="hidden text-sm font-medium text-cream/80 transition hover:text-gold sm:inline"
              >
                Sign in
              </Link>
              <Link
                href="/offerings"
                className="group inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-[#2A2008] shadow-[0_0_0_1px_rgba(192,154,69,0.4),0_8px_24px_-8px_rgba(192,154,69,0.5)] transition hover:bg-gold-deep"
              >
                Own a horse <span className="nudge">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
