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
        card: "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
