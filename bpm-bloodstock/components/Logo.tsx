import Link from "next/link";

/**
 * BPM Bloodstock mark: a heartbeat pulse that flows into a stylised horse head,
 * rendered in Heritage Gold. Simplified vector interpretation of the brand sheet.
 */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role="img"
      aria-label="BPM Bloodstock"
      fill="none"
    >
      {/* heartbeat lead-in */}
      <path
        d="M2 40h9l3-8 4 17 4-24 4 15h6"
        stroke="#C09A45"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* horse head */}
      <path
        d="M31 40c-1-6 0-11 3-15 2-3 5-5 9-6 2-1 3-2 4-4 1 3 1 5 0 7 3 0 6 1 8 3-2 0-3 1-4 2 4 2 6 5 7 9-2-1-4-2-6-2 1 3 1 6 0 9-1-3-3-5-5-6 0 4-1 8-4 11l-2-6c-1 3-3 6-6 8 0-3 0-5 1-7-4 1-8 0-11-2 2 0 4-1 6-2-3-1-6-3-8-6 3 1 6 1 8 0z"
        fill="#C09A45"
      />
      {/* eye cut-out */}
      <circle cx="45" cy="26" r="1.4" fill="#0E2A22" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3">
      <LogoMark className="h-9 w-9 shrink-0" />
      <span className="flex flex-col leading-none">
        <span className="font-heading text-xl font-extrabold italic tracking-tight text-cream group-hover:text-gold-100">
          BPM
        </span>
        {!compact && (
          <span className="mt-0.5 text-[9px] font-bold italic uppercase tracking-[0.2em] text-gold-300">
            Bloodstock
          </span>
        )}
      </span>
    </Link>
  );
}
