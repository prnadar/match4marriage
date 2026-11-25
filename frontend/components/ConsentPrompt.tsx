"use client";

/**
 * ConsentPrompt — asks existing members to confirm the current Terms/Privacy
 * Policy and give explicit consent for sensitive-data matching (UK GDPR).
 *
 * Deliberately NON-BLOCKING: a small card in the corner that never stops a
 * member browsing, messaging or paying. "Later" hides it for this session.
 * Any error (API down, table not created yet) → renders nothing.
 *
 * Also flushes consents stashed by onboarding if the signup-time POST failed.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";

const PENDING_KEY = "m4m_pending_consents";
const SNOOZE_KEY = "m4m_consent_snoozed";

export default function ConsentPrompt() {
  const [open, setOpen] = useState(false);
  const [terms, setTerms] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<any>("/api/v1/consents/me");
        const data = (res.data as any)?.data ?? res.data;
        if (!data?.needs_consent) return;

        // Signup consents that failed to save → retry silently.
        let pending: Record<string, boolean> | null = null;
        try { pending = JSON.parse(localStorage.getItem(PENDING_KEY) || "null"); } catch { /* ignore */ }
        if (pending?.terms_privacy && pending?.sensitive_data) {
          try {
            await api.post("/api/v1/consents", { consents: pending, source: "signup" });
            try { localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ }
            return;
          } catch { /* fall through to the prompt */ }
        }

        let snoozed = false;
        try { snoozed = sessionStorage.getItem(SNOOZE_KEY) === "1"; } catch { /* ignore */ }
        if (!cancelled && !snoozed) {
          setMarketing(!!data?.consents?.marketing_email?.granted);
          setOpen(true);
        }
      } catch {
        /* never surface errors here */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (!open) return null;

  const snooze = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, "1"); } catch { /* ignore */ }
    setOpen(false);
  };

  const save = async () => {
    setSaving(true);
    setError("");
    try {
      await api.post("/api/v1/consents", {
        consents: { terms_privacy: true, sensitive_data: true, marketing_email: marketing },
        source: "reconsent_prompt",
      });
      setOpen(false);
    } catch {
      setError("Couldn't save just now — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-labelledby="consent-title"
      style={{
        position: "fixed", right: 16, bottom: 16, zIndex: 60,
        width: "min(420px, calc(100vw - 32px))",
        background: "#fff", borderRadius: 16,
        border: "1px solid rgba(26,10,20,0.08)",
        boxShadow: "0 24px 60px -20px rgba(26,10,20,0.35), 0 2px 8px rgba(26,10,20,0.06)",
        padding: "18px 18px 16px",
      }}
    >
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
        <span style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          background: "rgba(220,30,60,0.08)", display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <ShieldCheck style={{ width: 16, height: 16, color: "#dc1e3c" }} strokeWidth={2} />
        </span>
        <h2 id="consent-title" style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1a0a14" }}>
          Your privacy choices
        </h2>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, lineHeight: 1.55, color: "#78686e" }}>
        We&apos;ve updated how we record consent under UK data protection law. Please confirm to keep things up to date.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
        <Check checked={terms} onChange={setTerms}>
          I agree to the{" "}
          <Link href="/terms" target="_blank" style={link}>Terms</Link> and{" "}
          <Link href="/privacy" target="_blank" style={link}>Privacy Policy</Link>.
        </Check>
        <Check checked={sensitive} onChange={setSensitive}>
          I explicitly consent to Match4Marriage using my religion, community and horoscope
          details to find and show me matches.
        </Check>
        <Check checked={marketing} onChange={setMarketing}>
          Send me news and offers by email (optional).
        </Check>
      </div>

      {error && <p role="alert" style={{ margin: "10px 0 0", fontSize: 12.5, color: "#a0153c" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 14, justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={snooze}
          style={{
            background: "none", border: "1px solid rgba(26,10,20,0.12)", borderRadius: 999,
            padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#78686e", cursor: "pointer",
          }}
        >
          Later
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!terms || !sensitive || saving}
          style={{
            background: "#dc1e3c", border: "none", borderRadius: 999,
            padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#fff",
            cursor: !terms || !sensitive || saving ? "not-allowed" : "pointer",
            opacity: !terms || !sensitive || saving ? 0.5 : 1,
          }}
        >
          {saving ? "Saving…" : "Confirm"}
        </button>
      </div>
    </div>
  );
}

const link: React.CSSProperties = { color: "#dc1e3c", fontWeight: 600, textDecoration: "none" };

function Check({ checked, onChange, children }: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", gap: 9, alignItems: "flex-start", fontSize: 12.5, lineHeight: 1.5, color: "#1a0a14", cursor: "pointer" }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 15, height: 15, flexShrink: 0, accentColor: "#dc1e3c", cursor: "pointer" }}
      />
      <span>{children}</span>
    </label>
  );
}
