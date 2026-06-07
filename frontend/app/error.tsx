"use client";

/**
 * Route-segment error boundary. Renders when a server- or client-side render
 * inside any route segment throws. Keeps the rest of the app shell (header,
 * sidebar, etc.) usable on routes that have one — only the offending segment
 * is replaced by this fallback.
 *
 * When Sentry is initialised (NEXT_PUBLIC_SENTRY_DSN set), the error is also
 * reported automatically. If Sentry isn't wired the dynamic import is a no-op.
 */

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Report to Sentry if available — wrapped so a missing module never
    // becomes the new error.
    (async () => {
      try {
        const Sentry = await import("@sentry/nextjs");
        if (Sentry && typeof Sentry.captureException === "function") {
          Sentry.captureException(error);
        }
      } catch {
        /* Sentry not installed / configured — log to console as a fallback */
        // eslint-disable-next-line no-console
        console.error("[route-error]", error);
      }
    })();
  }, [error]);

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "grid",
        placeItems: "center",
        padding: "48px 24px",
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
          padding: "36px 28px",
          boxShadow: "0 12px 36px rgba(220,30,60,0.08)",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "rgba(220,30,60,0.08)",
            marginBottom: 18,
          }}
        >
          <AlertTriangle style={{ width: 26, height: 26, color: "#dc1e3c" }} strokeWidth={1.8} />
        </span>
        <h1
          style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 26,
            fontWeight: 500,
            color: "#1a0a14",
            margin: "0 0 10px",
            letterSpacing: "-0.02em",
          }}
        >
          Something went wrong
        </h1>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: "#6a5560",
            margin: "0 0 22px",
          }}
        >
          We hit an unexpected error. The team has been notified. You can try
          again, or head back to the homepage.
        </p>
        <div style={{ display: "inline-flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            onClick={reset}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 22px",
              borderRadius: 9999,
              background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
              color: "#fff",
              border: "none",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: "0 8px 22px rgba(220,30,60,0.28)",
            }}
          >
            <RefreshCw style={{ width: 14, height: 14 }} strokeWidth={2} />
            Reload
          </button>
          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "11px 22px",
              borderRadius: 9999,
              background: "#fff",
              color: "#1a0a14",
              border: "1px solid rgba(26,10,20,0.12)",
              fontSize: 13.5,
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            <Home style={{ width: 14, height: 14 }} strokeWidth={2} />
            Home
          </Link>
        </div>
        {error?.digest && (
          <p style={{ marginTop: 18, fontSize: 11, color: "#a78a8f" }}>
            Reference: <code style={{ fontFamily: "monospace" }}>{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
