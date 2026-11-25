import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // ── Match4Marriage · Ruby Red + Navy Blue brand palette ──────────────────
      colors: {
        ruby: {
          50:      "#FFF1F4",
          100:     "#FFD9E0",
          200:     "#FFB1BE",
          300:     "#F77C92",
          DEFAULT: "#DC1E3C",   // Primary ruby red — used in CTAs, accents, links
          600:     "#B5102C",
          700:     "#8A0820",
          dark:    "#5E0218",
        },
        navy: {
          50:      "#EEF1F8",
          100:     "#D5DCEC",
          200:     "#9FAEC9",
          300:     "#5F73A1",
          DEFAULT: "#1F2D5C",   // Primary navy blue — pairs with ruby across UI
          600:     "#152144",
          700:     "#0E1832",
          dark:    "#070D1E",
        },
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

        // ── Match4Marriage design system (frontend/DESIGN.md) ─────────────
        // Role tokens from the "MATCH4MARRIAGE DESIGN SYSTEM" block in
        // globals.css. Use these in NEW and migrated member/public UI.
        // Alpha is part of each role, so opacity modifiers (`/50`) are
        // intentionally unsupported on m4m colours.
        m4m: {
          ink: {
            950: "var(--m4m-ink-950)",
            900: "var(--m4m-ink-900)",
            850: "var(--m4m-ink-850)",
            800: "var(--m4m-ink-800)",
          },
          ivory: {
            DEFAULT: "var(--m4m-ivory)",
            deep:    "var(--m4m-ivory-deep)",
          },
          paper: "var(--m4m-paper)",
          surface: {
            bar:    "var(--m4m-surface-bar)",
            card:   "var(--m4m-surface-card)",
            quiet:  "var(--m4m-surface-quiet)",
            hover:  "var(--m4m-surface-hover)",
            active: "var(--m4m-surface-active)",
            sheet:  "var(--m4m-surface-sheet)",
            scrim:  "var(--m4m-surface-scrim)",
          },
          hairline: {
            DEFAULT:       "var(--m4m-hairline)",
            strong:        "var(--m4m-hairline-strong)",
            control:       "var(--m4m-hairline-control)",
            gold:          "var(--m4m-hairline-gold)",
            "gold-strong": "var(--m4m-hairline-gold-strong)",
            light:         "var(--m4m-hairline-light)",
          },
          fg: {
            DEFAULT: "var(--m4m-fg)",
            body:    "var(--m4m-fg-body)",
            soft:    "var(--m4m-fg-soft)",
            muted:   "var(--m4m-fg-muted)",
            faint:   "var(--m4m-fg-faint)",
          },
          "ink-text": {
            DEFAULT: "var(--m4m-ink-text)",
            soft:    "var(--m4m-ink-text-soft)",
            muted:   "var(--m4m-ink-text-muted)",
          },
          rose: {
            DEFAULT: "var(--m4m-rose)",
            deep:    "var(--m4m-rose-deep)",
            soft:    "var(--m4m-rose-soft)",
            blush:   "var(--m4m-rose-blush)",
          },
          gold: {
            DEFAULT:   "var(--m4m-gold)",
            label:     "var(--m4m-gold-label)",
            champagne: "var(--m4m-gold-champagne)",
            deep:      "var(--m4m-gold-deep)",
          },
          verified: {
            DEFAULT: "var(--m4m-verified)",
            deep:    "var(--m4m-verified-deep)",
          },
          "focus-dark":  "var(--m4m-focus-ring-dark)",
          "focus-light": "var(--m4m-focus-ring-light)",
        },
      },
      fontFamily: {
        // Brand faces — Source Serif 4 (display serif) + Inter (sans), self-
        // hosted via next/font (app/layout.tsx). The key NAMES are unchanged so
        // every existing class keeps working; they all resolve to the two
        // CSS variables defined in globals.css. `editorial` (was Cormorant) and
        // `script` (was Great Vibes, unused) now alias the display serif.
        display:     ["var(--font-display)"],
        nav:         ["var(--font-nav)"],
        editorial:   ["var(--font-display)"],
        script:      ["var(--font-display)"],
        devanagari:  ["Noto Serif Devanagari", "serif"],
        body:        ["var(--font-body)"],
      },
      fontSize: {
        body: ["1rem", { lineHeight: "1.6" }],
        // m4m type scale. Sans steps carry their own leading; the display
        // steps pair with `font-display` (see components/m4m/DisplayHeading).
        "m4m-kicker-sm":  ["var(--m4m-type-kicker-sm)",  { lineHeight: "1",   letterSpacing: "var(--m4m-tracking-kicker)", fontWeight: "600" }],
        "m4m-kicker":     ["var(--m4m-type-kicker)",     { lineHeight: "1.3", letterSpacing: "var(--m4m-tracking-kicker)", fontWeight: "600" }],
        "m4m-status":     ["var(--m4m-type-status)",     { lineHeight: "1.3", letterSpacing: "var(--m4m-tracking-status)", fontWeight: "600" }],
        "m4m-caption":    ["var(--m4m-type-caption)",    { lineHeight: "1.5" }],
        "m4m-small":      ["var(--m4m-type-small)",      { lineHeight: "1.55" }],
        "m4m-ui":         ["var(--m4m-type-ui)",         { lineHeight: "1.4", letterSpacing: "var(--m4m-tracking-ui)" }],
        "m4m-body":       ["var(--m4m-type-body)",       { lineHeight: "var(--m4m-leading-relaxed)" }],
        "m4m-lead":       ["var(--m4m-type-lead)",       { lineHeight: "var(--m4m-leading-relaxed)" }],
        "m4m-title":      ["var(--m4m-type-title)",      { lineHeight: "var(--m4m-leading-title)",   letterSpacing: "var(--m4m-tracking-display)" }],
        "m4m-section":    ["var(--m4m-type-section)",    { lineHeight: "var(--m4m-leading-title)",   letterSpacing: "var(--m4m-tracking-display)" }],
        "m4m-section-lg": ["var(--m4m-type-section-lg)", { lineHeight: "var(--m4m-leading-title)",   letterSpacing: "var(--m4m-tracking-display)" }],
        "m4m-page":       ["var(--m4m-type-page)",       { lineHeight: "var(--m4m-leading-display)", letterSpacing: "var(--m4m-tracking-display)" }],
        "m4m-page-lg":    ["var(--m4m-type-page-lg)",    { lineHeight: "var(--m4m-leading-display)", letterSpacing: "var(--m4m-tracking-display)" }],
        "m4m-hero":       ["var(--m4m-type-hero)",       { lineHeight: "1.08",                       letterSpacing: "var(--m4m-tracking-display)" }],
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
        // m4m elevation: hairline first, neutral shadow only when floating.
        "m4m-inset":     "var(--m4m-elev-inset)",
        "m4m-ring-gold": "var(--m4m-elev-ring-gold)",
        "m4m-raised":    "var(--m4m-elev-raised)",
        "m4m-float":     "var(--m4m-elev-float)",
        "m4m-sheet":     "var(--m4m-elev-sheet)",
      },
      borderRadius: {
        // shadcn convention — radius scale derives from --radius CSS var.
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        card: "1.25rem",
        "m4m-xs":   "var(--m4m-radius-xs)",
        "m4m-sm":   "var(--m4m-radius-sm)",
        "m4m-md":   "var(--m4m-radius-md)",
        "m4m-lg":   "var(--m4m-radius-lg)",
        "m4m-pill": "var(--m4m-radius-pill)",
      },
      // ── Match4Marriage design system · remaining scales (new keys only) ──
      backgroundImage: {
        "m4m-ground": "var(--m4m-surface-ground)",
        "m4m-rail":   "var(--m4m-surface-rail)",
        "m4m-rose-fill": "var(--m4m-rose-fill)",
      },
      transitionTimingFunction: {
        "m4m-out": "var(--m4m-ease-out)",
      },
      transitionDuration: {
        "m4m-press":    "var(--m4m-dur-press)",
        "m4m-fast":     "var(--m4m-dur-fast)",
        "m4m-base":     "var(--m4m-dur-base)",
        "m4m-slow":     "var(--m4m-dur-slow)",
        "m4m-entrance": "var(--m4m-dur-entrance)",
      },
      spacing: {
        "m4m-tap":       "var(--m4m-tap)",
        "m4m-bar":       "var(--m4m-bar-h)",
        "m4m-gutter":    "var(--m4m-gutter)",
        "m4m-gutter-md": "var(--m4m-gutter-md)",
        "m4m-gutter-lg": "var(--m4m-gutter-lg)",
      },
      maxWidth: {
        "m4m-measure": "var(--m4m-measure)",
        "m4m-content": "var(--m4m-content)",
      },
    },
  },
  plugins: [],
};

export default config;
