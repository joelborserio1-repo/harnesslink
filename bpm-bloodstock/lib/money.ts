/**
 * All monetary values in the system are stored and computed as INTEGER CENTS
 * (AUD) to avoid floating-point drift. Format only at the presentation edge.
 */

export function formatCents(cents: number, opts?: { withSymbol?: boolean }) {
  const withSymbol = opts?.withSymbol ?? true;
  const dollars = cents / 100;
  const body = dollars.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `$${body}` : body;
}

/** Compact form for hero stats, e.g. $12.5k */
export function formatCentsCompact(cents: number) {
  const dollars = cents / 100;
  if (dollars >= 1000) {
    return `$${(dollars / 1000).toLocaleString("en-AU", {
      maximumFractionDigits: 1,
    })}k`;
  }
  return `$${dollars.toLocaleString("en-AU", { maximumFractionDigits: 0 })}`;
}

/** Parse a user-entered dollar string ("1,234.50") into integer cents. */
export function dollarsToCents(input: string | number): number {
  const n =
    typeof input === "number"
      ? input
      : Number(String(input).replace(/[^0-9.\-]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

export function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return (part / whole) * 100;
}
