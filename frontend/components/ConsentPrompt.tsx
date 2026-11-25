"use client";

/**
 * ConsentPrompt — asks existing members to confirm the current Terms/Privacy
 * Policy and give explicit consent for sensitive-data matching (UK GDPR).
 *
 * Deliberately NON-BLOCKING: a small card in the corner that never stops a
 * member browsing, messaging or paying. "Later" hides it for this session.
 * Any error (API down, table not created yet) → renders nothing.
 *
 * Presentation: a dark card in the bottom-right corner from 640px up. On
 * phones it first appears as a small pill beside the Menu button (so it never
 * sits on top of a page's primary action) and opens into a bottom sheet with
 * exactly the same choices when tapped.
 *
 * Also flushes consents stashed by onboarding if the signup-time POST failed.
 */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
  // Phones start collapsed to a pill; everything else shows the card straight away.
  const [expanded, setExpanded] = useState(true);
  const openedByTap = useRef(false);
  const reduce = useReducedMotion();

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
          let phone = false;
          try { phone = window.matchMedia("(max-width: 639px)").matches; } catch { /* ignore */ }
          setExpanded(!phone);
          setOpen(true);
        }
      } catch {
        /* never surface errors here */
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  const blocked = !terms || !sensitive || saving;
  const enter = reduce ? { opacity: 0 } : { opacity: 0, y: 18 };
  const rest = { opacity: 1, y: 0 };
  const leave = reduce ? { opacity: 0 } : { opacity: 0, y: 14 };

  return (
    <AnimatePresence mode="wait" initial>
      {open && !expanded && (
        <motion.button
          key="consent-pill"
          type="button"
          aria-label="Review your privacy choices"
          aria-expanded={false}
          onClick={() => { openedByTap.current = true; setExpanded(true); }}
          initial={enter}
          animate={rest}
          exit={leave}
          transition={{ duration: 0.3, ease: EASE_OUT, delay: 0.3 }}
          className={`fixed right-4 z-[60] inline-flex h-12 max-w-[calc(100vw-9.5rem)] items-center gap-2 rounded-full border border-white/15 bg-[#1a0a14] pl-3.5 pr-4 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(0,0,0,0.45)] ${FOCUS_RING}`}
          style={{ bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
        >
          <ShieldCheck aria-hidden className="h-4 w-4 flex-shrink-0 text-[#f3c9a8]" strokeWidth={1.75} />
          <span className="truncate">Privacy choices</span>
        </motion.button>
      )}

      {open && expanded && (
        <motion.div
          key="consent-panel"
          // When the member opens the sheet from the pill, move focus into it (once).
          ref={(el) => {
            if (el && openedByTap.current) { openedByTap.current = false; el.focus(); }
          }}
          tabIndex={-1}
          role="dialog"
          aria-modal="false"
          aria-labelledby="consent-title"
          initial={enter}
          animate={rest}
          exit={leave}
          transition={{ duration: 0.4, ease: EASE_OUT }}
          className="fixed inset-x-0 bottom-0 z-[60] max-h-[85vh] overflow-y-auto rounded-t-[20px] border border-b-0 border-white/[0.14] bg-[#1a0a14] px-5 pt-5 text-[#e7dde0] shadow-[0_-12px_40px_rgba(0,0,0,0.5)] outline-none sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[min(420px,calc(100vw-32px))] sm:rounded-[16px] sm:border-b sm:px-[22px] sm:pt-[20px] sm:shadow-[0_18px_44px_rgba(0,0,0,0.5)]"
          style={{ paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))", colorScheme: "dark" }}
        >
          <div className="flex items-center gap-2.5">
            <ShieldCheck aria-hidden className="h-[18px] w-[18px] flex-shrink-0 text-[#f3c9a8]" strokeWidth={1.75} />
            <h2 id="consent-title" className="m-0 font-display text-[18px] font-semibold leading-tight text-white">
              Your privacy choices
            </h2>
          </div>
          <p className="mb-0 mt-2.5 text-[13px] leading-[1.6] text-white/70">
            We&apos;ve updated how we record consent under UK data protection law. Please confirm to keep things up to date.
          </p>

          <div className="mt-3.5 border-t border-white/10">
            <Check checked={terms} onChange={setTerms}>
              I agree to the{" "}
              <Link href="/terms" target="_blank" className={LINK}>Terms</Link> and{" "}
              <Link href="/privacy" target="_blank" className={LINK}>Privacy Policy</Link>.
            </Check>
            <Check checked={sensitive} onChange={setSensitive}>
              I explicitly consent to Match4Marriage using my religion, community and horoscope
              details to find and show me matches.
            </Check>
            <Check checked={marketing} onChange={setMarketing}>
              Send me news and offers by email (optional).
            </Check>
          </div>

          {error && <p role="alert" className="mb-0 mt-3 text-[12.5px] text-[#ff8aa3]">{error}</p>}

          <div className="mt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={snooze}
              className={`rounded-full border border-white/20 bg-transparent px-4 py-2.5 text-[13px] font-semibold text-white/80 transition-colors duration-200 hover:border-white/35 hover:text-white ${FOCUS_RING}`}
            >
              Later
            </button>
            <button
              type="button"
              onClick={save}
              disabled={blocked}
              className={`rounded-full border-0 bg-[#dc1e3c] px-5 py-2.5 text-[13px] font-bold text-white transition-[filter,opacity] duration-200 enabled:hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-45 ${FOCUS_RING}`}
            >
              {saving ? "Saving…" : "Confirm"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ffd4dc]";
const LINK = `font-semibold text-[#ffd4dc] underline decoration-[rgba(255,212,220,0.45)] underline-offset-2 hover:decoration-[#ffd4dc] ${FOCUS_RING}`;

function Check({ checked, onChange, children }: {
  checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 border-b border-white/10 py-3 text-[13px] leading-[1.55] text-white/90">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className={`mt-[3px] h-4 w-4 flex-shrink-0 cursor-pointer ${FOCUS_RING}`}
        style={{ accentColor: "#dc1e3c" }}
      />
      <span>{children}</span>
    </label>
  );
}
