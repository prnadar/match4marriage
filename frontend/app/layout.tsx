import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import QueryProvider from "@/lib/providers/query-provider";
import "./globals.css";

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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/*
          Brand typography stack (Match4Marriage):
            Cinzel      — primary heading serif (logo wordmark + major sections)
            Montserrat  — secondary headings, navigation, CTAs
            Open Sans   — body text — highly legible sans-serif
            Inter       — UI utility (forms, dashboards) — close cousin to Open Sans
            Great Vibes — script accent retained for hero "Become One" motif
            Fraunces / Cormorant / Playfair / Poppins / Lato — kept as fallbacks
            for legacy editorial pages still referencing them.
        */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;500;600;700;800&family=Montserrat:wght@300;400;500;600;700&family=Open+Sans:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&family=Great+Vibes&family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500;9..144,600;9..144,700;9..144,800&family=Cormorant:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,600&family=Poppins:wght@300;400;500;600;700&family=Lato:wght@300;400;700&display=swap"
          rel="stylesheet"
        />
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
