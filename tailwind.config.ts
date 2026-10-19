import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Theme-relative (2026-10-18): every utility below resolves through the tokens in app/theme-tokens.css,
      // so text-white / bg-black / neutral-* flip with html[data-theme] and the [data-authored] register.
      colors: {
        black: "rgb(var(--k) / <alpha-value>)",
        white: "rgb(var(--w) / <alpha-value>)",
        neutral: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, `rgb(var(--n-${n}) / <alpha-value>)`])),
        "soft-white": "var(--hx-f5f5f7)",
        "dark-gray": "var(--hx-1d1d1f)",
        "medium-gray": "var(--hx-86868b)",
        border: "rgb(var(--w) / 0.12)",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "IBM Plex Mono", "monospace"],
      },
      borderRadius: {
        xl2: "24px",
        xl3: "32px",
      },
      backdropBlur: {
        xs: "2px",
        "24": "24px",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(24px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.7s ease forwards",
      },
    },
  },
  plugins: [],
};

export default config;
