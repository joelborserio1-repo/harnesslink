# BPM Bloodstock - project conventions ("lore")

Rules for anyone (human or AI) working in this repo. Follow them everywhere:
UI copy, code comments, docs, commit messages.

## Writing / copy

- **NO EM-DASHES. EVER.** Never use the `—` character (or `--` that renders as
  one). Use a comma, a period, a colon, parentheses, or a spaced hyphen ` - `
  instead. This applies to on-screen copy, comments, and docs.
- **Voice:** confident, human, plain-spoken. Sound like a real Aussie racing
  brand, not a marketing bot. Avoid AI-cliche phrasing ("unlock", "elevate",
  "that's the whole pitch", "dead simple", overused em-dash asides).
- **No profanity** in shipped copy.
- Brand line: "Get Your Heart Racing". Disciplines: pacers and trotters
  (harness), not thoroughbreds.

## Brand

- **Name / hierarchy:** the customer-facing brand is **StrideShares**. **BPM
  Bloodstock** is the parent / endorser / legal entity (the syndicator that
  actually owns the horses and processes payments) - always subordinate, shown
  as "by BPM Bloodstock". **Get Your Heart Racing** is the tagline. Use the full
  lockup "StrideShares by BPM Bloodstock" once per page/journey (hero, footer,
  checkout, metadata, About), then go short ("StrideShares") everywhere else.
  Never retire BPM Bloodstock; never imply StrideShares is a separate company
  that holds the horse or the money.
- **Terminology:** owners / members / part-owners (never "investors" or
  "punters"); shares / micro-shares (never "units", "tokens", "equity");
  "Buy a share" / "Own a share" / "Become an owner" (never "invest", "deposit").
  Prizemoney is "applicable", never guaranteed. It is not gambling, crypto or a
  financial product.
- Colours: Heritage Gold `#D4AF37`, Racing Green `#0B3D2E`, Cream `#F5F2E9`.
- Type: Space Grotesk (headings), Inter (body). Tokens live in
  `tailwind.config.ts` and `components/Logo.tsx`.
- Layout: MUSTR-style light/dark rhythm. Dark sections use green bg + cream/sage
  text; light sections use `bg-paper` + green-900/700 text. Green is the punchy
  accent; gold is used sparingly (primary CTA, price figures, icon).

## Design references

- We take **inspiration** from BTX Racing and MUSTR (structure, flow, the best
  UX patterns) but write our **own original** code, copy and assets. Do not copy
  competitor source code, markup, or images verbatim into this product.

## Money / correctness

- All money is integer cents. Never use floats for balances.
- Share purchases are direct card checkout (Stripe Checkout). The wallet holds
  winnings only. Prizemoney is split pro-rata, to the cent
  (`lib/distribution.ts`, kept exact and unit-tested).
