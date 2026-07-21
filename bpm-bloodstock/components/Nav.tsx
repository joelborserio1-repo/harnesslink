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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-racing-950/80 backdrop-blur">
      <div className="container-bpm flex h-16 items-center justify-between">
        <div className="flex items-center gap-8">
          {logo ? (
            <Link href="/" className="flex items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logo} alt="BPM Bloodstock" className="h-10 w-auto" />
            </Link>
          ) : (
            <Wordmark />
          )}
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="/offerings" className="text-sm text-cream/75 hover:text-gold">
              Horses
            </Link>
            <Link href="/#how" className="text-sm text-cream/75 hover:text-gold">
              How it works
            </Link>
            {user && (
              <Link href="/dashboard" className="text-sm text-cream/75 hover:text-gold">
                My Stable
              </Link>
            )}
            {user?.isAdmin && (
              <Link href="/admin" className="text-sm text-gold-300 hover:text-gold">
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
              <Link href="/login" className="btn-ghost">
                Sign in
              </Link>
              <Link href="/register" className="btn-gold">
                Join
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
