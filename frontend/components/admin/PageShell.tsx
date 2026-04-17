"use client";

import type { ReactNode } from "react";

export function PageShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf9" }}>
      <div style={{
        borderBottom: "1px solid rgba(220,30,60,0.08)",
        background: "rgba(253,251,249,0.92)",
        backdropFilter: "blur(12px)",
        padding: "18px 28px",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
      }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 26, fontWeight: 600, color: "#1a0a14", margin: 0 }}>
            {title}
          </h1>
          {subtitle && (
            <p style={{ fontSize: 13, color: "#888", margin: "4px 0 0" }}>{subtitle}</p>
          )}
        </div>
        {actions && <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div>}
      </div>
      <div style={{ padding: 28 }}>
        {children}
      </div>
    </div>
  );
}

export function StatCard({ label, value, hint, tone = "neutral" }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const toneColor: Record<typeof tone, { fg: string; bg: string }> = {
    neutral: { fg: "#1a0a14", bg: "#fff" },
    good:    { fg: "#3F5937", bg: "rgba(92,122,82,0.08)" },
    warn:    { fg: "#9A6B00", bg: "rgba(200,144,32,0.08)" },
    bad:     { fg: "#a0153c", bg: "rgba(220,30,60,0.06)" },
    info:    { fg: "#1e4bc8", bg: "rgba(30,75,200,0.06)" },
  } as any;
  const c = toneColor[tone];
  return (
    <div style={{
      padding: 18,
      background: c.bg,
      border: "1px solid rgba(220,30,60,0.08)",
      borderRadius: 14,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: c.fg, marginTop: 4, fontFamily: "var(--font-playfair, serif)" }}>
        {value}
      </div>
      {hint && <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

export function Button({ onClick, disabled, variant = "secondary", children, style }: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger" | "warn" | "ghost";
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const v = variant;
  const base: React.CSSProperties = {
    padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
    border: "1px solid transparent", display: "inline-flex", alignItems: "center", gap: 6,
  };
  const variants: Record<string, React.CSSProperties> = {
    primary: { background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff", boxShadow: "0 2px 10px rgba(220,30,60,0.2)" },
    secondary: { background: "#fff", color: "#1a0a14", border: "1px solid rgba(220,30,60,0.15)" },
    danger:  { background: "#fff", color: "#dc1e3c", border: "1px solid rgba(220,30,60,0.3)" },
    warn:    { background: "#fff", color: "#9A6B00", border: "1px solid rgba(200,144,32,0.4)" },
    ghost:   { background: "transparent", color: "#666" },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[v], ...(style || {}) }}>
      {children}
    </button>
  );
}
