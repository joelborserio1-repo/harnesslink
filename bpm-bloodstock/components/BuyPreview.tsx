import { formatCents } from "@/lib/money";

/**
 * Pure-CSS phone mock showing the share-buying flow, using the real featured
 * horse + price so it stays honest. No image asset needed; it mirrors the
 * actual app UI (dark green screen, gold accents) so it reads as "the product".
 */
export function BuyPreview({
  name,
  discipline,
  sharePriceCents,
}: {
  name: string;
  discipline: string;
  sharePriceCents: number;
}) {
  const shares = 4;
  const totalCents = shares * sharePriceCents;

  return (
    <div className="mx-auto w-full max-w-[290px]">
      <div className="relative rounded-[2.6rem] border-[10px] border-racing-975 bg-racing-975 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.55)]">
        {/* notch */}
        <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-racing-975" />
        <div className="overflow-hidden rounded-[1.9rem] bg-green-900">
          {/* status bar / brand */}
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <span className="font-heading text-sm italic tracking-tight text-cream">
              StrideShares
            </span>
            <span className="rounded-full border border-gold/30 bg-gold/5 px-2 py-0.5 text-[10px] font-semibold text-gold">
              Wallet $0.00
            </span>
          </div>

          {/* horse strip */}
          <div className="mx-4 flex items-center gap-3 rounded-xl border border-green-600 bg-green-800 p-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg border border-green-600 bg-green-900 font-heading text-sm text-gold">
              BPM
            </span>
            <div className="min-w-0">
              <p className="truncate font-heading text-base font-bold text-cream">
                {name}
              </p>
              <p className="text-[11px] uppercase tracking-wide text-sage">
                {discipline}
              </p>
            </div>
          </div>

          {/* buy card */}
          <div className="m-4 rounded-xl border border-green-600 bg-green-800 p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] text-sage">Price per share</span>
              <span className="font-heading text-lg font-bold text-gold">
                {formatCents(sharePriceCents)}
              </span>
            </div>

            {/* quantity stepper */}
            <div className="mt-3 flex items-center gap-2">
              <span className="grid h-9 flex-1 place-items-center rounded-md border border-green-600 text-cream/70">
                −
              </span>
              <span className="grid h-9 flex-[2] place-items-center rounded-md border border-gold/50 bg-gold/10 font-heading text-cream">
                {shares}
              </span>
              <span className="grid h-9 flex-1 place-items-center rounded-md border border-green-600 text-cream/70">
                +
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between rounded-lg border border-green-600 bg-green-900/60 px-3 py-2.5">
              <span className="text-[11px] text-sage">Total</span>
              <span className="font-heading text-base font-bold text-gold">
                {formatCents(totalCents)}
              </span>
            </div>

            <div className="mt-3 grid place-items-center rounded-md bg-gold py-2.5 font-heading text-[13px] font-semibold text-[#2A2008]">
              Buy {shares} shares · {formatCents(totalCents)}
            </div>
            <p className="mt-2 text-center text-[9px] leading-tight text-cream/40">
              Secure card checkout. Pay once, own your shares.
            </p>
          </div>
        </div>
      </div>

      {/* "owner" confirmation chip, overlapping the phone */}
      <div className="mx-auto -mt-4 w-fit rounded-full border border-gold/40 bg-green-800 px-4 py-2 shadow-lg">
        <span className="text-sm font-semibold text-cream">
          <span className="text-gold">✓</span> You&apos;re an owner
        </span>
      </div>
    </div>
  );
}
