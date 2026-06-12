"use client";

import { useEffect, useState } from "react";
import * as Sentry from "@sentry/nextjs";
import { api } from "@/lib/api";

// Admin-only Sentry connection test. Visit /debug-sentry while signed in as an
// admin, click the buttons, and confirm the events land in your Sentry projects
// (web + api). Safe to keep in prod — non-admins just see "not available" and
// nothing fires without a deliberate click. Ask me to remove it once verified.
export default function DebugSentryPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api
      .get("/api/v1/auth/me")
      .then((r) => {
        const d = (r.data as any)?.data ?? r.data;
        setIsAdmin(!!d?.is_admin);
      })
      .catch(() => setIsAdmin(false));
  }, []);

  if (isAdmin === null) return <Shell>Checking access…</Shell>;
  if (!isAdmin) return <Shell>Not available.</Shell>;

  return (
    <Shell>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Sentry connection test</h1>
      <p style={{ color: "#666", marginBottom: 24, lineHeight: 1.5 }}>
        Each button sends a test event. Check your Sentry <strong>web</strong> and{" "}
        <strong>api</strong> projects — events appear within ~30 seconds.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <button
          style={btn}
          onClick={() => {
            Sentry.captureException(new Error("Sentry FRONTEND test (captureException)"));
            setStatus("✅ Sent a frontend error → check your web project.");
          }}
        >
          1 · Send frontend error
        </button>
        <button
          style={btn}
          onClick={() => {
            throw new Error("Sentry FRONTEND test (uncaught throw — exercises replay)");
          }}
        >
          2 · Throw uncaught frontend error (also tests Session Replay)
        </button>
        <button
          style={btn}
          onClick={async () => {
            setStatus("Calling backend… (a 500 is expected — that's the point)");
            try {
              await api.get("/api/v1/admin/debug/sentry-test");
              setStatus("Backend returned OK — unexpected (is the route deployed?).");
            } catch {
              setStatus("✅ Triggered a backend 500 → check your api project.");
            }
          }}
        >
          3 · Trigger backend error
        </button>
      </div>
      {status && <p style={{ marginTop: 20, fontWeight: 600 }}>{status}</p>}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 560,
        margin: "60px auto",
        padding: 24,
        fontFamily: "system-ui, sans-serif",
        color: "#111",
      }}
    >
      {children}
    </main>
  );
}

const btn: React.CSSProperties = {
  padding: "12px 16px",
  borderRadius: 10,
  border: "none",
  background: "#dc1e3c",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
  textAlign: "left",
};
