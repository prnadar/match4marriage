"use client";

/**
 * Root error boundary — replaces the entire root layout when even the
 * layout itself throws (e.g. broken imports, font loader crash, provider
 * crash). Because we're replacing the document, we must render our own
 * <html> and <body>.
 */

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    (async () => {
      try {
        const Sentry = await import("@sentry/nextjs");
        if (Sentry && typeof Sentry.captureException === "function") {
          Sentry.captureException(error);
        }
      } catch {
        // eslint-disable-next-line no-console
        console.error("[global-error]", error);
      }
    })();
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#fdfbf9",
          color: "#1a0a14",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          display: "grid",
          placeItems: "center",
          padding: "48px 24px",
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
          <div
            aria-hidden
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(220,30,60,0.08)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 18,
              color: "#dc1e3c",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            !
          </div>
          <h1
            style={{
              fontSize: 26,
              fontWeight: 500,
              margin: "0 0 10px",
              letterSpacing: "-0.02em",
            }}
          >
            We hit a snag
          </h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#6a5560", margin: "0 0 22px" }}>
            Something on our end stopped the page from loading. Please try
            again — if it keeps happening, refresh in a minute or two.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              padding: "11px 22px",
              borderRadius: 9999,
              background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
              color: "#fff",
              border: "none",
              fontSize: 13.5,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 8px 22px rgba(220,30,60,0.28)",
            }}
          >
            Try again
          </button>
          {error?.digest && (
            <p style={{ marginTop: 18, fontSize: 11, color: "#a78a8f" }}>
              Reference: <code style={{ fontFamily: "monospace" }}>{error.digest}</code>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
