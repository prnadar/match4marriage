"use client";

import Link from "next/link";
import { Wrench, ShieldCheck } from "lucide-react";

export default function AdminComingSoonPage() {
  return (
    <div style={{
      minHeight: "calc(100vh - 60px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 40, background: "#fdfbf9",
    }}>
      <div style={{
        maxWidth: 480, textAlign: "center",
        background: "#fff",
        border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: 16, padding: 40,
        boxShadow: "0 4px 24px rgba(220,30,60,0.05)",
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: "50%",
          background: "rgba(220,30,60,0.08)",
          display: "flex", alignItems: "center", justifyContent: "center",
          margin: "0 auto 20px",
        }}>
          <Wrench style={{ width: 24, height: 24, color: "#dc1e3c" }} />
        </div>
        <h1 style={{
          fontFamily: "var(--font-playfair, serif)", fontSize: 24, fontWeight: 600,
          color: "#1a0a14", margin: "0 0 8px",
        }}>
          Coming soon
        </h1>
        <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
          This section is being rebuilt against real production data. For launch, head to
          Verifications to review new profiles.
        </p>
        <Link
          href="/admin/verifications"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 10,
            background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
            color: "#fff", fontSize: 13, fontWeight: 600,
            textDecoration: "none",
            boxShadow: "0 4px 14px rgba(220,30,60,0.25)",
          }}
        >
          <ShieldCheck style={{ width: 14, height: 14 }} /> Go to Verifications
        </Link>
      </div>
    </div>
  );
}
