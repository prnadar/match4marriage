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
        {/* Consistent cross-resolution scaling. The desktop UI is pinned to a
            reference width (REF) and the whole page is zoomed to match the
            actual viewport, so the site keeps the SAME apparent size / feel on
            1080p, 1440p and 4K monitors instead of looking tiny on wide or
            high-DPI screens. Runs in <head> before first paint (no flash);
            mobile/tablet (<1024px) keep their native responsive layout. REF is
            the single tuning knob — raise it to make everything smaller, lower
            it to make everything larger. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var REF=1600,MIN=0.9,MAX=2,raf=0;" +
              "function a(){raf=0;try{var w=window.innerWidth||document.documentElement.clientWidth,z='';" +
              "if(w>=1024){var r=Math.min(Math.max(w/REF,MIN),MAX);if(Math.abs(r-1)>0.005)z=String(Math.round(r*1000)/1000);}" +
              "document.documentElement.style.zoom=z;}catch(e){}}" +
              "function s(){if(!raf)raf=requestAnimationFrame(a);}a();" +
              "window.addEventListener('resize',s,{passive:true});})();",
          }}
        />
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
      </head>
      <body>
        <Preloader />
        <AnimatedHeartCursor />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
