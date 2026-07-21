# BPM Bloodstock — Micro-Shares Syndication (Scaffold)

> **Get Your Heart Racing.** A working prototype of a micro-shares racehorse
> ownership marketplace for **pacers and trotters**, in the spirit of
> MyRacehorse / MUST Racing / BTX Racing — branded to the BPM Bloodstock
> identity (Heritage Gold `#D4AF37`, Racing Green `#0B3D2E`, Cream `#F5F2E9`,
> Cinzel + Montserrat).

This is a **scaffold** to explore the concept end-to-end. It demonstrates the
three hard pieces working together:

1. **A custom Stripe payment gateway** (Stripe Payment Element) to fund a wallet.
2. **A wallet ledger** — every balance change is an immutable, auditable row.
3. **Pro-rata prizemoney distribution** — the genuinely tricky part — splitting a
   prize across shareholders by shares held, to the cent.

---

## Tech stack

| Layer      | Choice                                                    |
| ---------- | --------------------------------------------------------- |
| Framework  | Next.js 14 (App Router) + TypeScript                      |
| Database   | Prisma ORM — SQLite for the scaffold (swap to Postgres)   |
| Payments   | Stripe (PaymentIntents + Payment Element) + webhook       |
| Auth       | Cookie session (HMAC-signed) + bcrypt                     |
| Styling    | Tailwind CSS with the BPM brand tokens                    |

Money is stored **everywhere as integer cents (AUD)** — no floats touch a balance.

---

## Quick start

```bash
cd bpm-bloodstock
npm install
cp .env.example .env          # defaults run in DEMO MODE (no Stripe keys needed)
npm run db:migrate            # create the SQLite db
npm run db:seed               # sample horses + demo users
npm run dev                   # http://localhost:3000
```

### Demo logins (seeded)

| Role     | Email                     | Password      |
| -------- | ------------------------- | ------------- |
| Admin    | `admin@bpmbloodstock.com` | `password123` |
| Investor | `alex@example.com`        | `password123` |
| Investor | `sam@example.com`         | `password123` |

### Try the full loop

1. Sign in as **alex**, go to **Wallet → Top up** (instant in demo mode).
2. Open a horse (e.g. *Menangle Magic*) and **buy some shares**.
3. Sign in as **admin → Admin console**, pick that horse, and **distribute
   prizemoney**. Watch it split pro-rata into each shareholder's wallet.
4. Back as **alex → My Stable / Wallet** — the payout has landed, with a full
   ledger entry.

---

## Demo mode vs. live Stripe

The scaffold runs with **no Stripe keys** by default: wallet top-ups are
simulated and credited instantly so you can exercise the whole product. To use
the real gateway, set the keys in `.env`:

```
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Then the top-up flow renders the **Stripe Payment Element**, creates a
`PaymentIntent`, and the wallet is credited by the webhook on
`payment_intent.succeeded` (idempotent by PaymentIntent id):

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## How prizemoney distribution works

`lib/distribution.ts` is a **pure function** (unit-tested in
`lib/distribution.test.ts`, run `npx tsx lib/distribution.test.ts`). Given a
gross prize, a management fee, the total shares issued and the public holders'
positions, it returns each holder's exact cents. Key rules:

- **Fee first** — the syndicate management fee (basis points) is skimmed off the
  gross.
- **Per-share value is constant** — the net is divided across *all issued*
  shares, so a partially-subscribed horse pays each owner correctly and the
  unsold shares' portion is **retained** by the house (never silently
  redistributed).
- **No lost cents** — leftover cents from integer division are allocated by the
  **Largest Remainder Method**, so `fee + distributed + retained == gross`
  exactly, always. This invariant is asserted at runtime.

`distributePrizeEvent()` in `lib/wallet.ts` wraps it in a single atomic
transaction that credits every wallet and records the audit rows.

---

## Data model (`prisma/schema.prisma`)

- **User** — has a `walletBalanceCents` mirrored by a `WalletTransaction` ledger.
- **Offering** — a horse: total shares, price/share, shares sold, mgmt fee.
- **ShareHolding** — a user's aggregated position in one offering.
- **Order** — a completed share purchase.
- **WalletTransaction** — immutable ledger (`DEPOSIT` / `SHARE_PURCHASE` /
  `PRIZE_PAYOUT` / `WITHDRAWAL`) with running `balanceAfterCents`.
- **PrizeEvent** + **PrizeDistribution** — a recorded result and each holder's
  cut.

---

## Going to production — checklist

This is a prototype. Before anything real:

- [ ] Switch Prisma `provider` to `postgresql`.
- [ ] Replace the withdrawal stub with **Stripe Connect** transfers/payouts to
      each owner's connected/bank account (KYC onboarding).
- [ ] **Compliance**: fractional racehorse ownership is a financial product in
      most jurisdictions — AFSL / PDS, plus racing-authority syndication rules
      (e.g. Racing NSW / HRA), AML/KYC, and a real terms-of-sale.
- [ ] Harden auth (rate limiting, email verification, password reset, 2FA) or
      swap in a managed provider.
- [ ] Integrate operations tooling (e.g. **MyStable / MyStable Connect**) for
      the ownership records, or export to it.
- [ ] Add updates/media feed per horse (stable news, trial videos, race replays).

---

*Branding follows the BPM Bloodstock brand sheet. Whether the live product
operates under "BPM" is still open — every brand token lives in
`tailwind.config.ts` and `components/Logo.tsx`, so re-skinning is a one-file
change.*
