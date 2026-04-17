"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Mail, Phone, Camera, ShieldCheck, ChevronRight, Sparkles } from "lucide-react";
import { api } from "@/lib/api";

type BadgeState = "locked" | "pending" | "verified";

interface MissingField {
  key: string;
  label: string;
  tab: string;
}

interface CompletionData {
  score: number;
  status: string;
  missing: MissingField[];
  badges: { email: BadgeState; phone: BadgeState; photo: BadgeState; id: BadgeState };
}

interface Props {
  /** Profile completeness from the parent (used as a fallback while /completion loads). */
  fallbackScore?: number;
  /** Called when the user clicks the "next action" CTA — parent should switch tab. */
  onJumpToTab?: (tabId: string) => void;
  /** Bumps re-fetch when the parent has just saved. Pass autoSaveState === "saved" timestamp or a counter. */
  refreshKey?: number | string;
}

/**
 * Hero-treatment completion strip that sits above the tab panel.
 * Shows: animated radial completion %, the next missing field as a CTA,
 * and the four trust badges (email, phone, photo, ID).
 *
 * Reads from GET /api/v1/profile/me/completion. Falls back to fallbackScore while loading.
 */
export function CompletionStrip({ fallbackScore = 0, onJumpToTab, refreshKey }: Props) {
  const [data, setData] = useState<CompletionData | null>(null);
  const [loading, setLoading] = useState(true);
  const reduce = useReducedMotion();

  // Track the previously-rendered score so we only animate the bump on changes.
  const prevScoreRef = useRef<number>(fallbackScore);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ data: CompletionData }>("/api/v1/profile/me/completion");
        if (cancelled) return;
        const payload = (res.data as any)?.data as CompletionData | undefined;
        if (payload) setData(payload);
      } catch {
        // Strip stays in fallback mode — never blocks the page.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const score = data?.score ?? fallbackScore;
  const previous = prevScoreRef.current;
  prevScoreRef.current = score;

  const next = data?.missing?.[0];
  const total = data?.missing?.length ?? 0;
  const isComplete = score >= 100 && total === 0;

  // ── Radial progress (SVG circle, animated stroke-dashoffset) ──────────────
  const SIZE = 84;
  const STROKE = 8;
  const R = (SIZE - STROKE) / 2;
  const C = 2 * Math.PI * R;
  const targetOffset = C - (Math.min(100, Math.max(0, score)) / 100) * C;
  const initialOffset = reduce ? targetOffset : C - (Math.min(100, Math.max(0, previous)) / 100) * C;

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "relative",
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        gap: 20,
        alignItems: "center",
        padding: "16px 20px",
        marginBottom: 16,
        borderRadius: 16,
        background: isComplete
          ? "linear-gradient(135deg, #fff8ec 0%, #ffe8c2 100%)"
          : "linear-gradient(135deg, #fffaf6 0%, #fff1f3 100%)",
        border: `1px solid ${isComplete ? "rgba(201,149,74,0.35)" : "rgba(220,30,60,0.12)"}`,
        boxShadow: isComplete
          ? "0 8px 28px rgba(201,149,74,0.18)"
          : "0 6px 22px rgba(220,30,60,0.06)",
        overflow: "hidden",
      }}
      className="m4m-completion-strip"
    >
      {/* Soft ambient glow */}
      <div aria-hidden style={{
        position: "absolute", top: -40, right: -40, width: 220, height: 220, borderRadius: "50%",
        background: isComplete
          ? "radial-gradient(circle, rgba(240,201,135,0.45), transparent 70%)"
          : "radial-gradient(circle, rgba(220,30,60,0.10), transparent 70%)",
        filter: "blur(30px)", pointerEvents: "none",
      }} />

      {/* ── Radial progress ── */}
      <div style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            stroke="rgba(26,10,20,0.07)" strokeWidth={STROKE} fill="none"
          />
          <motion.circle
            cx={SIZE / 2} cy={SIZE / 2} r={R}
            stroke={isComplete ? "#c9954a" : "#dc1e3c"}
            strokeWidth={STROKE} strokeLinecap="round" fill="none"
            strokeDasharray={C}
            initial={{ strokeDashoffset: initialOffset }}
            animate={{ strokeDashoffset: targetOffset }}
            transition={{ duration: reduce ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
            style={{
              filter: isComplete
                ? "drop-shadow(0 0 8px rgba(201,149,74,0.6))"
                : "drop-shadow(0 0 6px rgba(220,30,60,0.35))",
            }}
          />
        </svg>
        <div style={{
          position: "absolute", inset: 0, display: "grid", placeItems: "center",
          flexDirection: "column",
        }}>
          <div style={{ textAlign: "center", lineHeight: 1 }}>
            <div style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 22, fontWeight: 700,
              color: isComplete ? "#7a5a1d" : "#1a0a14",
            }}>
              {score}<span style={{ fontSize: 12, marginLeft: 1 }}>%</span>
            </div>
            <div style={{
              fontSize: 9, fontWeight: 700, color: "#888",
              textTransform: "uppercase", letterSpacing: "0.08em", marginTop: 2,
            }}>
              Complete
            </div>
          </div>
        </div>
      </div>

      {/* ── Headline + next action ── */}
      <div style={{ minWidth: 0, position: "relative", zIndex: 1 }}>
        {loading ? (
          <div style={{ height: 18, width: 220, borderRadius: 6, background: "rgba(0,0,0,0.05)" }} />
        ) : isComplete ? (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 17, fontWeight: 700, color: "#7a5a1d", marginBottom: 2,
            }}>
              <Sparkles style={{ width: 16, height: 16 }} />
              Your profile is fully set up.
            </div>
            <div style={{ fontSize: 12, color: "#7a5a1d99" }}>
              Submit it for verification to start matching.
            </div>
          </>
        ) : next ? (
          <>
            <div style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 17, fontWeight: 600, color: "#1a0a14", marginBottom: 4,
            }}>
              {total === 1
                ? "One step from a complete profile"
                : `${total} steps from a complete profile`}
            </div>
            <button
              onClick={() => onJumpToTab?.(next.tab)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "transparent", border: "none", padding: 0,
                fontFamily: "var(--font-poppins, sans-serif)", fontSize: 13,
                color: "#a0153c", fontWeight: 600, cursor: "pointer",
              }}
            >
              Next: add your {next.label.toLowerCase()}
              <ChevronRight style={{ width: 14, height: 14 }} />
            </button>
          </>
        ) : (
          <div style={{ fontSize: 13, color: "#888" }}>Loading completion…</div>
        )}
      </div>

      {/* ── Trust badges ── */}
      <div className="m4m-badges-row" style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <Badge icon={Mail}        label="Email" state={data?.badges.email ?? "locked"} reduce={!!reduce} />
        <Badge icon={Phone}       label="Phone" state={data?.badges.phone ?? "locked"} reduce={!!reduce} />
        <Badge icon={Camera}      label="Photo" state={data?.badges.photo ?? "locked"} reduce={!!reduce} />
        <Badge icon={ShieldCheck} label="ID"    state={data?.badges.id    ?? "locked"} reduce={!!reduce} />
      </div>

      {/* Mobile responsive: stack badges below */}
      <style jsx>{`
        @media (max-width: 720px) {
          :global(.m4m-completion-strip) {
            grid-template-columns: auto 1fr !important;
          }
          :global(.m4m-completion-strip .m4m-badges-row) {
            grid-column: 1 / -1 !important;
            justify-content: flex-start !important;
            flex-wrap: wrap;
          }
        }
      `}</style>
    </motion.div>
  );
}

function Badge({
  icon: Icon, label, state, reduce,
}: {
  icon: any; label: string; state: BadgeState; reduce: boolean;
}) {
  const palette: Record<BadgeState, { bg: string; fg: string; border: string; ring: string }> = {
    verified: { bg: "rgba(201,149,74,0.12)", fg: "#7a5a1d", border: "rgba(201,149,74,0.42)", ring: "0 0 0 3px rgba(201,149,74,0.18)" },
    pending:  { bg: "rgba(220,30,60,0.06)",  fg: "#a0153c", border: "rgba(220,30,60,0.25)",  ring: "none" },
    locked:   { bg: "rgba(0,0,0,0.03)",      fg: "#9aa3a8", border: "rgba(0,0,0,0.06)",     ring: "none" },
  };
  const p = palette[state];
  return (
    <motion.div
      whileHover={reduce ? undefined : { y: -1 }}
      transition={{ type: "spring", stiffness: 350, damping: 24 }}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "8px 10px", borderRadius: 10,
        background: p.bg, border: `1px solid ${p.border}`,
        boxShadow: p.ring,
        fontSize: 11, fontWeight: 600, color: p.fg,
        whiteSpace: "nowrap",
      }}
      title={`${label}: ${state}`}
    >
      <Icon style={{ width: 13, height: 13 }} />
      {label}
      {state === "verified" && (
        <motion.span
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 500, damping: 20 }}
          style={{
            marginLeft: 2, width: 5, height: 5, borderRadius: "50%",
            background: "#c9954a",
            boxShadow: "0 0 6px rgba(201,149,74,0.6)",
          }}
        />
      )}
    </motion.div>
  );
}
