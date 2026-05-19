import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import QueryProvider from "@/lib/providers/query-provider";
import "./globals.css";

const Preloader = dynamic(() => import("@/components/Preloader"), { ssr: false });
const AnimatedHeartCursor = dynamic(
  () => import("@/components/ui/animated-heart-cursor").then((m) => m.AnimatedHeartCursor),
  { ssr: false }
);

export const metadata: Metadata = {
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
  openGraph: {
    type: "website",
    siteName: "Match4Marriage",
    title: "Match4Marriage: Find Your Perfect Match",
    description: "UK's most trusted Indian matrimonial service for families.",
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
      </head>
      <body>
        <Preloader />
        <AnimatedHeartCursor />
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
