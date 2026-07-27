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
