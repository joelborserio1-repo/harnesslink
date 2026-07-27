import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Wordmark } from "./Logo";
import { formatCents } from "@/lib/money";
import { LogoutButton } from "./LogoutButton";
import { SafeImg } from "./SafeImg";
import { brandLogoSrc } from "@/lib/brand";

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative font-heading text-[13px] uppercase tracking-wider text-cream/85 transition hover:text-gold"
    >
      {children}
      <span className="absolute -bottom-1.5 left-0 h-0.5 w-full origin-left scale-x-0 rounded-full bg-gold transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}

export async function Nav() {
  const user = await getCurrentUser();
  const logo = brandLogoSrc();

  return (
    <header className="sticky top-0 z-40 bg-green-900/85 backdrop-blur">
      {/* premium top accent */}
      <div className="h-[3px] w-full bg-gradient-to-r from-gold-deep via-gold to-gold-deep" />
      <div className="border-b border-green-600/50">
        <div className="container-bpm flex h-[68px] items-center justify-between gap-4">
          <div className="flex items-center gap-9">
            {logo ? (
              <Link href="/" className="flex items-center">
                <SafeImg
                  src={logo}
                  alt="StrideShares by BPM Bloodstock"
                  className="h-10 w-auto"
                  fallback={
                    <span className="flex flex-col leading-none">
                      <span className="font-heading text-lg uppercase tracking-tight text-cream">
                        StrideShares
                      </span>
                      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-gold-300">
                        by BPM Bloodstock
                      </span>
                    </span>
                  }
                />
              </Link>
            ) : (
              <Wordmark />
            )}
            <nav className="hidden items-center gap-8 md:flex">
              <NavLink href="/offerings">Horses</NavLink>
              <NavLink href="/#how">How it works</NavLink>
              <NavLink href="/about">About</NavLink>
              {user && <NavLink href="/dashboard">My Stable</NavLink>}
              {user?.isAdmin && (
                <Link
                  href="/admin"
                  className="font-heading text-[13px] uppercase tracking-wider text-gold transition hover:text-gold-200"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
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
                  className="hidden font-heading text-[13px] uppercase tracking-wider text-cream/75 transition hover:text-gold sm:inline"
                >
                  Sign in
                </Link>
                <Link
                  href="/offerings"
                  className="inline-flex items-center rounded-md bg-gold px-6 py-3 font-heading text-[13px] uppercase tracking-wider text-[#2A2008] shadow-[0_0_0_1px_rgba(192,154,69,0.5),0_10px_30px_-8px_rgba(192,154,69,0.6)] transition hover:bg-gold-deep hover:shadow-[0_0_0_1px_rgba(192,154,69,0.7),0_14px_36px_-8px_rgba(192,154,69,0.8)]"
                >
                  Own a horse
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
