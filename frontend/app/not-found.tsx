import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you were looking for doesn't exist or has moved.",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "70vh",
        display: "grid",
        placeItems: "center",
        padding: "64px 24px",
        background: "#fdfbf9",
        fontFamily: "var(--font-poppins, sans-serif)",
      }}
    >
      <div
        style={{
          maxWidth: 460,
          width: "100%",
          textAlign: "center",
          background: "#fff",
          border: "1px solid rgba(220,30,60,0.10)",
          borderRadius: 18,
          padding: "44px 28px",
          boxShadow: "0 12px 36px rgba(220,30,60,0.06)",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.18em",
            color: "#a78a8f",
            margin: 0,
            textTransform: "uppercase",
          }}
        >
          404
        </p>
        <h1
          style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 32,
            fontWeight: 500,
            color: "#1a0a14",
            margin: "10px 0 12px",
            letterSpacing: "-0.022em",
            lineHeight: 1.1,
          }}
        >
          Page not found
        </h1>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: 1.6,
            color: "#6a5560",
            margin: "0 0 28px",
          }}
        >
          We couldn&apos;t find the page you were looking for. It may have
          moved, or the link might be out of date.
        </p>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 24px",
            borderRadius: 9999,
            background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
            color: "#fff",
            border: "none",
            fontSize: 13.5,
            fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 8px 22px rgba(220,30,60,0.28)",
          }}
        >
          Back to homepage
        </Link>
      </div>
    </div>
  );
}
