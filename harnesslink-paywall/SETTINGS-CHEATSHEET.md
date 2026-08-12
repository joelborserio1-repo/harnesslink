# Leaky Paywall settings cheat-sheet (HarnessLink)

These are **Leaky Paywall settings** (now branded "HarnessLink PayWall"), not
the companion plugin's code. Anyone with admin access can change them — no
developer needed.

## Goal: "3 free stories, international / site-wide"

By default Leaky Paywall counts allowances **per restriction row**, and rows
scoped to a category/taxonomy count **per section** — which is why the sign-in
wall was appearing separately across different country sections. To make it a
single global counter:

1. Go to **wp-admin → HarnessLink PayWall → Settings → Restrictions**.
2. Tick **Combined Restrictions**
   *("Use a single value for total number allowed regardless of content type or taxonomy")*.
3. Set **Combined Restrictions Total Allowed** = **3**.
4. **Save**.

Result: 3 free articles total across the *whole* site (every country section /
post type combined), then the wall — for everyone.

## If the wall still appears erratically → caching

The meter is **cookie-based** (cookie `issuem_lp`, ~30-day expiry, per browser/
device). Full-page caching/CDNs can make it fire inconsistently.

- In the same Restrictions settings, keep **Enable JS cookie restrictions**
  **ON** (it's the cached-site mode and is on by default).
- After changing settings, **purge your cache** and test in a fresh incognito
  window.

## How to test the count (incognito)

1. New incognito window → open 3 different articles in *different* country
   sections → all should read in full.
2. Open a 4th (any section) → the wall should appear.
3. This confirms the count is global, not per-section.

## Conversion analytics (GA4 / Google Tag Manager)

The plugin pushes events to the `dataLayer` (and calls `gtag` if present) so you
can measure the funnel:

| Event | Fires when |
| --- | --- |
| `paywall_view` | the wall is shown to a visitor |
| `sign_up` | a new account is created at the wall |
| `profile_complete` | the "complete your profile" card is saved |

- **GTM:** create triggers on these Custom Events and forward to GA4.
- **GA4 (gtag):** they arrive as events automatically; mark `sign_up` /
  `profile_complete` as conversions in GA4 → Admin → Events.

This lets you track real conversion instead of estimating from raw counts.

## Notes

- **Logged-in subscribers never see the wall** — the meter only applies to
  logged-out visitors.
- The count is per-device. Clearing cookies / new browser / incognito resets
  it (normal for cookie meters).
- Captured signup data (first name, last name, mobile, Insider opt-in) lives on
  each WordPress user and is exportable at **Users → Insider Opt-ins**.
