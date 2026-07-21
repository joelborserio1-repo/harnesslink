import type { Config } from "tailwindcss";

/**
 * BPM Bloodstock brand system.
 * Source of truth: brand sheet — "Get Your Heart Racing".
 *   Heritage Gold  #D4AF37
 *   Racing Green   #0B3D2E
 *   Cream          #F5F2E9
 *   Primary type   Cinzel (headings)
 *   Secondary type Montserrat (body/UI)
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: "#D4AF37",
          50: "#FBF6E4",
          100: "#F5E9BF",
          200: "#EBD588",
          300: "#E1C258",
          400: "#D4AF37",
          500: "#B8952A",
          600: "#977721",
          700: "#75591a",
        },
        racing: {
          DEFAULT: "#0B3D2E",
          50: "#E7F0EC",
          800: "#0F4A38",
          900: "#0B3D2E",
          950: "#072A20",
          975: "#05201A",
        },
        cream: {
          DEFAULT: "#F5F2E9",
          200: "#EFE9D8",
        },
      },
      fontFamily: {
        heading: ["var(--font-cinzel)", "Georgia", "serif"],
        body: ["var(--font-montserrat)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 10px 30px -12px rgba(0,0,0,0.45)",
        gold: "0 0 0 1px rgba(212,175,55,0.35), 0 8px 24px -8px rgba(212,175,55,0.25)",
      },
      backgroundImage: {
        "racing-gradient":
          "radial-gradient(1200px 600px at 80% -10%, rgba(212,175,55,0.10), transparent 60%), linear-gradient(180deg, #0B3D2E 0%, #072A20 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
