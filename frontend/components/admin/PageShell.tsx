"use client";

import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AdminBackdrop } from "./AdminBackdrop";
import { fadeUp, popIn, stagger, SPRING_SNAP } from "./motion-presets";

// ─── Chrome ───────────────────────────────────────────────────────────────────

export function PageShell({ title, subtitle, actions, children }: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <AdminBackdrop />
      <div style={{ position: "relative", zIndex: 1 }}>
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          style={{
            position: "sticky", top: 0, zIndex: 20,
            padding: "20px 28px",
            background: "rgba(253,251,249,0.75)",
            backdropFilter: "saturate(140%) blur(18px)",
            WebkitBackdropFilter: "saturate(140%) blur(18px)",
            borderBottom: "1px solid rgba(220,30,60,0.09)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 16, flexWrap: "wrap",
          }}
        >
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.05 }}
              style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: 28, fontWeight: 600, color: "#1a0a14",
                margin: 0, letterSpacing: "-0.01em",
              }}
            >
              {title}
            </motion.h1>
            {subtitle && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.12, duration: 0.4 }}
                style={{ fontSize: 13, color: "#777", margin: "4px 0 0" }}
              >
                {subtitle}
              </motion.p>
            )}
          </div>
          {actions && (
            <motion.div
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              style={{ display: "flex", gap: 8, flexWrap: "wrap" }}
            >
              {actions}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          variants={stagger(0.06, 0.05)}
          initial="hidden"
          animate="show"
          style={{ padding: 28, maxWidth: 1400, margin: "0 auto" }}
        >
          {children}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Animated count-up ────────────────────────────────────────────────────────

function useCountUp(target: number, enabled = true): number {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) { setValue(target); return; }
    const from = 0;
    const duration = Math.min(1200, 400 + Math.abs(target - from) * 8);
    const tick = (now: number) => {
      if (startRef.current === null) startRef.current = now;
      const t = Math.min(1, (now - startRef.current) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    startRef.current = null;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, enabled]);
  return value;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const TONE: Record<string, { fg: string; accent: string; bg: string }> = {
  neutral: { fg: "#1a0a14", accent: "rgba(220,30,60,0.35)",  bg: "rgba(255,255,255,0.68)" },
  good:    { fg: "#3F5937", accent: "#8DB870",               bg: "rgba(92,122,82,0.06)" },
  warn:    { fg: "#8A5F00", accent: "#C89020",               bg: "rgba(200,144,32,0.06)" },
  bad:     { fg: "#a0153c", accent: "#dc1e3c",               bg: "rgba(220,30,60,0.06)" },
  info:    { fg: "#2544a8", accent: "#5C7AEB",               bg: "rgba(90,120,230,0.06)" },
};

export function StatCard({ label, value, hint, tone = "neutral" }: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
}) {
  const c = TONE[tone];
  const numeric = typeof value === "number" ? value : null;
  const animated = useCountUp(numeric ?? 0, numeric !== null);
  const display = numeric !== null ? animated.toLocaleString() : value;

  return (
    <motion.div
      variants={popIn}
      whileHover={{ y: -2, boxShadow: "0 14px 40px rgba(26,10,20,0.08)" }}
      transition={SPRING_SNAP}
      style={{
        position: "relative",
        padding: 18,
        background: c.bg,
        border: "1px solid rgba(220,30,60,0.09)",
        borderRadius: 16,
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        overflow: "hidden",
      }}
    >
      <span aria-hidden style={{
        position: "absolute", inset: 0, top: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${c.accent}, transparent)`,
      }} />
      <div style={{ fontSize: 11, fontWeight: 600, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div style={{
        fontSize: 30, fontWeight: 700, color: c.fg, marginTop: 6,
        fontFamily: "var(--font-playfair, serif)", fontVariantNumeric: "tabular-nums",
        letterSpacing: "-0.015em",
      }}>
        {display}
      </div>
      {hint && <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>{hint}</div>}
    </motion.div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "warn" | "ghost" | "success";

export function Button({
  onClick, disabled, variant = "secondary", children, style, type, title,
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  children: ReactNode;
  style?: React.CSSProperties;
  type?: "button" | "submit" | "reset";
  title?: string;
}) {
  const styles: Record<ButtonVariant, React.CSSProperties> = {
    primary: {
      background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 100%)",
      color: "#fff",
      boxShadow: "0 6px 18px rgba(220,30,60,0.28)",
      border: "1px solid rgba(220,30,60,0.2)",
    },
    success: {
      background: "linear-gradient(135deg, #5C7A52 0%, #3F5937 100%)",
      color: "#fff",
      boxShadow: "0 6px 18px rgba(92,122,82,0.25)",
      border: "1px solid rgba(92,122,82,0.25)",
    },
    secondary: {
      background: "rgba(255,255,255,0.85)",
      color: "#1a0a14",
      border: "1px solid rgba(220,30,60,0.15)",
      backdropFilter: "blur(6px)",
    },
    danger: {
      background: "rgba(255,255,255,0.85)",
      color: "#dc1e3c",
      border: "1px solid rgba(220,30,60,0.3)",
    },
    warn: {
      background: "rgba(255,255,255,0.85)",
      color: "#9A6B00",
      border: "1px solid rgba(200,144,32,0.4)",
    },
    ghost: {
      background: "transparent",
      color: "#555",
      border: "1px solid transparent",
    },
  };

  return (
    <motion.button
      type={type || "button"}
      onClick={onClick}
      disabled={disabled}
      title={title}
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { y: 0, scale: 0.98 }}
      transition={SPRING_SNAP}
      style={{
        padding: "9px 16px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "inherit",
        transition: "opacity 0.15s",
        ...styles[variant],
        ...(style || {}),
      }}
    >
      {children}
    </motion.button>
  );
}

// ─── Glass card wrapper ───────────────────────────────────────────────────────

export function GlassCard({ children, style, hoverable = false, padding = 18 }: {
  children: ReactNode;
  style?: React.CSSProperties;
  hoverable?: boolean;
  padding?: number;
}) {
  const Comp: any = hoverable ? motion.div : "div";
  const hoverProps = hoverable ? {
    whileHover: { y: -2, boxShadow: "0 14px 40px rgba(26,10,20,0.08)" },
    transition: SPRING_SNAP,
  } : {};
  return (
    <Comp
      {...hoverProps}
      style={{
        background: "rgba(255,255,255,0.72)",
        border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: 16,
        padding,
        backdropFilter: "saturate(140%) blur(10px)",
        WebkitBackdropFilter: "saturate(140%) blur(10px)",
        boxShadow: "0 4px 24px rgba(26,10,20,0.04)",
        ...(style || {}),
      }}
    >
      {children}
    </Comp>
  );
}

// Re-exports for pages
export { fadeUp, popIn, stagger };
