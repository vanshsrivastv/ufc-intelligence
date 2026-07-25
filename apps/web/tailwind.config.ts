import type { Config } from "tailwindcss";

// Every color here reads from the CSS variables in
// packages/ui-tokens/src/tokens.css, imported once in app/globals.css.
// Never add a raw hex value to this file — add it to tokens.css instead
// so design-system.md, tokens.css, and Tailwind stay in lockstep.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "var(--color-bg-primary)",
          elevated: "var(--color-bg-elevated)",
          "elevated-2": "var(--color-bg-elevated-2)",
        },
        gold: {
          100: "var(--color-gold-100)",
          300: "var(--color-gold-300)",
          500: "var(--color-gold-500)",
          700: "var(--color-gold-700)",
          900: "var(--color-gold-900)",
        },
        text: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted: "var(--color-text-muted)",
          "on-gold": "var(--color-text-on-gold)",
        },
        live: "var(--color-live)",
        success: "var(--color-success)",
        danger: "var(--color-danger)",
        border: {
          DEFAULT: "var(--color-border)",
          strong: "var(--color-border-strong)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        sans: ["var(--font-sans)"],
      },
      borderRadius: {
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
      },
      transitionDuration: {
        standard: "300ms",
        fast: "150ms",
      },
    },
  },
  plugins: [],
};

export default config;
