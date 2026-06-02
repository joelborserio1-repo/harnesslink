# HarnessLink PayWall

A small companion plugin for **Leaky Paywall** on harnesslink.com. It restyles
the registration wall and rebrands the Leaky Paywall admin experience as
**HarnessLink PayWall**.

> **Cosmetic only.** This plugin does **not** change metering, the restriction
> count, access levels, or any server-side gating. The full article is never
> moved into the page — only the short excerpt Leaky Paywall already exposes is
> blurred, and blur is purely visual. The article stays gated server-side
> exactly as before.

## What it does

1. **Frosted lead-in teaser** — blurs + fades the short excerpt behind the wall
   (`blur(5px)`, `opacity .55`, `user-select:none`, `pointer-events:none`).
2. **Clean signup card** — turns `#leaky_paywall_message` into a white, rounded,
   soft-shadowed pop-up floating over the blurred teaser.
3. **Readable text** — forces the heading and body to readable colours, fixing
   the dark-on-dark heading bug.
4. **Navy buttons/accents** — all wall buttons (Continue/Subscribe, Next, and
   any subscribe/login buttons) become HarnessLink navy `#0A2A66`, white text,
   rounded, darker on hover.
5. **Rebrand** — renames "Leaky Paywall" to "HarnessLink PayWall" in the admin
   menu, the Plugins list, and user-facing strings — all via filters, so no
   Leaky Paywall core file is edited and the rebrand survives LP updates.

## Where the styling lives (and why)

The CSS ships inside **this plugin** (`assets/harnesslink-paywall-wall.css`) and
is enqueued on the front end. This keeps it:

- **Update-safe** — it is not inside the Leaky Paywall folder, so a Leaky
  Paywall update can't overwrite it.
- **Core-clean** — no Leaky Paywall file is edited.

### Install
Copy the `harnesslink-paywall/` folder into `wp-content/plugins/` and activate
**HarnessLink PayWall** (Plugins screen). That's it — it loads automatically
wherever Leaky Paywall renders its wall.

### Alternative: Appearance → Customize → Additional CSS
If you'd rather not add a plugin, you can paste the contents of
`assets/harnesslink-paywall-wall.css` into **Appearance → Customize → Additional
CSS**. **Caveat:** the teaser-blur step (`.hl-paywall-teaser`) needs the small
markup wrapper that this plugin adds (see "Assumptions" below). Pasting CSS
alone will style the card, text and buttons but will **not** blur the teaser,
because Leaky Paywall emits the excerpt as an unwrapped text node that CSS
cannot select. To get the blur without the full plugin, keep just the
`leaky_paywall_nag_excerpt` filter from `harnesslink-paywall.php` in a tiny
mu-plugin or your child theme's `functions.php`.

## Selectors targeted

| Purpose | Selector | Source |
| --- | --- | --- |
| Wall container | `.leaky_paywall_message_wrap` | LP core (`class-restrictions.php`) |
| Message card | `#leaky_paywall_message` | LP core (id) |
| Lead-in teaser | `.hl-paywall-teaser` | **added** by this plugin's `leaky_paywall_nag_excerpt` filter |
| Registration form | `#leaky-paywall-payment-form` | LP core |
| Email field | `#email_address` / `[name="email_address"]` | LP core |
| Continue/Subscribe button | `#leaky-paywall-submit` | LP core (id) |
| Next button | `#leaky-paywall-registration-next` | LP core (id) |

## Confirmed brand colour

Navy **`#0A2A66`** — taken from the HarnessLink palette defined in the
HarnessLink Directory plugin (`public/css/hld-public.css`, `--hl-navy`, labelled
"Navy #0A2A66"). Hover uses a slightly darker `#081D47`; links use the lighter
`#123C8C`. This is **not** `#0a1f44` — that assumption was correctly avoided.

## Assumptions to verify

1. **Brand navy source.** `#0A2A66` is confirmed from the HarnessLink Directory
   plugin palette, not scraped from the live theme's `<header>` element (no live
   site access from this environment). If your active theme's nav bar uses a
   different navy, update `--hlpw-navy` at the top of the CSS file. *Quick check:
   in the browser inspector, click the header nav bar and read its
   `background-color`.*
2. **Teaser wrapper.** Leaky Paywall outputs the excerpt as a bare text node, so
   we wrap it in `<span class="hl-paywall-teaser">` via the official
   `leaky_paywall_nag_excerpt` filter. This is cosmetic markup only — it changes
   no gating and no restriction logic.
3. **"Continue" button.** In stock Leaky Paywall this button reads "Subscribe"
   (`#leaky-paywall-submit`). If yours says "Continue", that's a label set via
   the `registration_checkout_button_text` filter on your site; the styling
   targets the button by id regardless of its text.
4. **Wall contains the registration form.** This assumes your
   *subscribe/login message* includes the registration form (email + button).
   If your wall instead shows plain subscribe/login links, they're still
   restyled navy via the `.leaky_paywall_message_wrap a.button` / button rules.

## Test checklist (incognito window)

1. **Metering still works.** Open 3 different articles — they read in full. Open
   a **4th** article → the wall appears. *(Confirms gating is untouched.)*
2. **Teaser is blurred.** The lead-in text above the card is frosted/faded and
   can't be selected or clicked.
3. **Full article is NOT in the page.** Right-click → View Source (or DevTools)
   on article 4: only the short excerpt is present, not the full body.
   *(Confirms blur is cosmetic and content stays server-side gated.)*
4. **Pop-up card shows.** A clean white, rounded, shadowed card sits over the
   blurred teaser with the email field + Continue button.
5. **Heading is readable.** The wall heading/body is clearly legible (no
   dark-on-dark).
6. **Buttons are navy.** Continue/Subscribe (and Next, if shown) are navy
   `#0A2A66`, white text, rounded, and go darker on hover.
7. **Signup creates a WordPress user.** Complete the free signup with a test
   email → in `wp-admin → Users` (and **HarnessLink PayWall → Subscribers**) the
   new user/subscriber exists.
8. **Rebrand.** In `wp-admin`, the menu and Plugins-list entry read
   **HarnessLink PayWall**, not "Leaky Paywall".
