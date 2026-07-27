import type { Config } from "tailwindcss";

/**
 * BPM Bloodstock brand system - green-dominant, gold as accent only.
 * Tokens mirrored in lib/brand.ts (brandColors) as the single source of truth.
 *   green-900 #0E2A22  page background
 *   green-800 #1B4536  cards / surfaces (sit above the page bg)
 *   green-600 #2E5A4B  borders / hairlines
 *   gold      #C09A45  accent (primary CTA, price figure, icon) - never a fill
 *   gold-deep #A8862F  gold hover / active
 *   cream     #F3EBD8  primary body text on green
 *   sage      #A9BBB0  secondary / muted text, captions
 *   Type: Archivo (headings), Montserrat (body).
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Accent only - primary CTA, price figures, icon. Never a background fill.
        gold: {
          DEFAULT: "#C09A45",
          deep: "#A8862F", // hover / active
          // legacy tints retained for not-yet-migrated views
          50: "#FBF6E4",
          100: "#F5E9BF",
          200: "#EBD588",
          300: "#E1C258",
          400: "#D4AF37",
          500: "#B8952A",
          600: "#977721",
          700: "#75591a",
        },
        // Green carries the weight.
        green: {
          900: "#0E2A22", // page background
          800: "#1B4536", // cards / surfaces
          600: "#2E5A4B", // borders / hairlines
        },
        // Legacy green scale, kept so unmigrated views still render.
        racing: {
          DEFAULT: "#0B3D2E",
          50: "#E7F0EC",
          800: "#0F4A38",
          900: "#0B3D2E",
          950: "#072A20",
          975: "#05201A",
        },
        cream: {
          DEFAULT: "#F3EBD8",
          200: "#EFE9D8",
        },
        sage: {
          DEFAULT: "#A9BBB0", // secondary / muted text on dark
        },
        // Light-section surfaces - brand cream (warmer than near-white).
        paper: {
          DEFAULT: "#F3EBD8", // brand cream light-section background
          200: "#E6DCC4", // cream hairline / border
        },
      },
      fontFamily: {
        heading: ["var(--font-heading)", "Helvetica Neue", "Arial", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(0,0,0,0.45)",
        gold: "0 0 0 1px rgba(212,175,55,0.35), 0 8px 24px -8px rgba(212,175,55,0.25)",
      },
      backgroundImage: {
        "racing-gradient":
          "linear-gradient(180deg, #1B4536 0%, #0E2A22 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
