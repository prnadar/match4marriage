import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ── Match4Marriage · Warm Luxury Rose Gold Design System ─────────────────
      colors: {
        rose: {
          50:      "#FFF5F7",
          100:     "#FFE4EA",
          200:     "#FFBDCA",
          300:     "#FF8FA3",
          400:     "#FF6B8A",
          DEFAULT: "#E8426A",
          600:     "#C4285A",
          700:     "#A01848",
          dark:    "#7D0A35",
        },
        gold: {
          50:      "#FFFBF0",
          100:     "#FFF3CC",
          200:     "#FFE499",
          300:     "#FFD166",
          DEFAULT: "#C9954A",
          500:     "#B07D35",
          dark:    "#8A5E20",
        },
        blush: {
          DEFAULT: "#FDF0F3",
          dark:    "#F9E0E8",
          deeper:  "#F2C8D4",
        },
        cream:   "#FFFAF8",
        deep:    "#1A0A12",
        muted:   "#8A7080",
        sage:    "#7A9E7E",

        // ── shadcn semantic tokens (HSL CSS vars in globals.css) ──────────
        // Use these in NEW admin code. Existing pages keep using the named
        // colors above. The two systems coexist.
        background:    "hsl(var(--background) / <alpha-value>)",
        foreground:    "hsl(var(--foreground) / <alpha-value>)",
        card: {
          DEFAULT:    "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT:    "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        primary: {
          DEFAULT:    "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted2: {                          // namespaced to avoid colliding with muted: "#8A7080"
          DEFAULT:    "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        border:        "hsl(var(--border) / <alpha-value>)",
        input:         "hsl(var(--input) / <alpha-value>)",
        ring:          "hsl(var(--ring) / <alpha-value>)",

        sidebar: {
          DEFAULT:    "hsl(var(--sidebar-background) / <alpha-value>)",
          foreground: "hsl(var(--sidebar-foreground) / <alpha-value>)",
          muted:      "hsl(var(--sidebar-muted) / <alpha-value>)",
          border:     "hsl(var(--sidebar-border) / <alpha-value>)",
          accent:     "hsl(var(--sidebar-accent) / <alpha-value>)",
          "accent-soft": "hsl(var(--sidebar-accent-soft) / <alpha-value>)",
        },
      },
      fontFamily: {
        display:     ["Playfair Display", "Georgia", "serif"],
        devanagari:  ["Noto Serif Devanagari", "serif"],
        body:        ["DM Sans", "system-ui", "sans-serif"],
      },
      fontSize: {
        body: ["1rem", { lineHeight: "1.6" }],
      },
      animation: {
        "float-in":     "floatIn 0.5s ease-out forwards",
        "heart-bloom":  "heartBloom 0.6s ease-out forwards",
        "lotus-reveal": "lotusReveal 0.8s ease-out forwards",
      },
      keyframes: {
        floatIn: {
          "0%":   { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        heartBloom: {
          "0%":   { transform: "scale(0)", opacity: "0" },
          "60%":  { transform: "scale(1.3)" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        lotusReveal: {
          "0%":   { opacity: "0", transform: "scale(0.8) rotate(-5deg)" },
          "100%": { opacity: "1", transform: "scale(1) rotate(0deg)" },
        },
      },
      boxShadow: {
        card:         "0 4px 24px rgba(232, 66, 106, 0.08)",
        "card-hover": "0 8px 40px rgba(232, 66, 106, 0.18)",
        "gold":       "0 4px 20px rgba(201, 149, 74, 0.25)",
      },
      borderRadius: {
        // shadcn convention — radius scale derives from --radius CSS var.
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        card: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
