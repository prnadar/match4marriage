import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { Source_Serif_4, Inter } from "next/font/google";
import QueryProvider from "@/lib/providers/query-provider";
import "./globals.css";

// ── Brand typography (see frontend/DESIGN.md → Typography) ──────────────
// Two families, self-hosted by next/font: the files are downloaded at build
// time and served from our own origin, so no visitor request (or IP address)
// goes to Google Fonts. Both are variable fonts, so one file per style covers
// every weight in use. Only the Latin subset is preloaded; Latin Extended
// (ā ī ū ṭ ḍ ṇ ś ṣ … for transliterated Indian names) is fetched on demand.
//
//   Source Serif 4 — the display serif (headings, names, the italic accent).
//                    The optical-size axis keeps 17px card titles sturdy and
//                    42–58px headlines fine.
//   Inter          — everything else: body, navigation, buttons, tables.
//
// They are exposed as --m4m-face-serif / --m4m-face-sans on <html>; the
// tokens in globals.css (--font-display, --font-nav, --font-body and the
// legacy aliases) and tailwind's fontFamily keys resolve to them.
const faceSerif = Source_Serif_4({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  display: "swap",
  variable: "--m4m-face-serif",
  fallback: ["Georgia", "Times New Roman", "serif"],
});
const faceSans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--m4m-face-sans",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
});

const Preloader = dynamic(() => import("@/components/Preloader"), { ssr: false });
const AnimatedHeartCursor = dynamic(
  () => import("@/components/ui/animated-heart-cursor").then((m) => m.AnimatedHeartCursor),
  { ssr: false }
);

// Base URL for any absolute URL Next derives (OG images, canonical, sitemap
// links). Defaults to the Vercel production hostname the team uses today —
// override with NEXT_PUBLIC_SITE_URL once a bare domain is wired up.
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : "https://m4mweb.vercel.app");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Match4Marriage: Find Your Perfect Match",
    template: "%s | Match4Marriage",
  },
  description:
    "UK's most trusted Indian matrimonial service. Connect with verified, compatible profiles from families who share your values.",
  keywords: ["matrimonial", "Indian marriage", "match4marriage", "wedding", "UK Indian matrimony", "find a match"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Match4Marriage",
  },
  formatDetection: { telephone: false },
  // Brand icon set generated from the Match 4 Marriage "M" mark:
  // favicon.ico (16/32/48/64) + PNG fallbacks, apple-touch-icon (180), and
  // the /og-default.jpg social card. All committed under /public.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: "Match4Marriage",
    title: "Match4Marriage: Find Your Perfect Match",
    description: "UK's most trusted Indian matrimonial service for families.",
    url: SITE_URL,
    images: [
      {
        url: "/og-default.jpg",
        width: 1200,
        height: 630,
        alt: "Match4Marriage — UK's most trusted Indian matrimonial service.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Match4Marriage: Find Your Perfect Match",
    description: "UK's most trusted Indian matrimonial service for families.",
    images: ["/og-default.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#dc1e3c",
  width: "device-width",
  initialScale: 1,
  // Allow pinch-zoom up to 5× — disabling user scaling fails WCAG 1.4.4
  // and hurts low-vision users on small screens.
  maximumScale: 5,
  userScalable: true,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${faceSerif.variable} ${faceSans.variable}`}>
      <head>
        {/*
          Fluid app scaling. Every desktop lays the authenticated app out at a
          fixed 1680px "design width" and scales it to fit the actual viewport,
          so a 1366px laptop and a 1728px Mac see the IDENTICAL layout — just
          scaled — instead of reflowing to fewer columns / a cramped rail.

          Mechanism: set a --app-zoom CSS var from innerWidth BEFORE first paint
          (no flash), consumed only by the (app) shell via `zoom: var(--app-zoom)`.
          Scoped to the app (not <html>/<body>) so the heart cursor and the
          marketing/auth pages keep real coordinates. Disabled below 1024px so
          phones/tablets keep their native responsive layout.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){function z(){try{var w=window.innerWidth,v=1;" +
              "if(w>=1024){v=Math.max(0.5,Math.min(1.3,w/1728));}" +
              "document.documentElement.style.setProperty('--app-zoom',String(v));}catch(e){}}" +
              "z();window.addEventListener('resize',z,{passive:true});})();",
          }}
        />
      </head>
      <body>
        <Preloader />
        <AnimatedHeartCursor />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
