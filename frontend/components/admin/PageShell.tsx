"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { fadeUp, popIn, stagger, SPRING_SNAP } from "./motion-presets";
import { Delta } from "./primitives";

/**
 * Page chrome for admin console pages.
 *
 * The console layout (app/admin/layout.tsx) already provides the sticky top
 * bar, breadcrumb, padding and background, so PageShell is just the page
 * header + a content column. All props after `children` are optional
 * additions — existing call sites (title / subtitle / actions / children)
 * render unchanged.
 */
export function PageShell({
  title, subtitle, actions, children,
  meta, toolbar, maxWidth = 1400,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Small inline element beside the title (e.g. a count pill). */
  meta?: ReactNode;
  /** Row under the header for tabs / filters. */
  toolbar?: ReactNode;
  maxWidth?: number;
}) {
  return (
    <div className="mx-auto w-full" style={{ maxWidth }}>
      <motion.header
        initial={{ opacity: 0, y: -4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[28px]">
              {title}
            </h1>
            {meta}
          </div>
          {subtitle && (
            <p className="mt-1 max-w-2xl text-[13px] text-muted2-foreground">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </motion.header>

      {toolbar && <div className="mb-4">{toolbar}</div>}

      <motion.div variants={stagger(0, 0.03)} initial="hidden" animate="show">
        {children}
      </motion.div>
    </div>
  );
}

// ─── Animated count-up ────────────────────────────────────────────────────────

function useCountUp(target: number, enabled = true): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(enabled && !reduce ? 0 : target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || reduce) { setValue(target); return; }
    const from = 0;
    const duration = Math.min(700, 300 + Math.abs(target - from) * 4);
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
  }, [target, enabled, reduce]);
  return value;
}

// ─── Stat card ────────────────────────────────────────────────────────────────

const TONE: Record<string, { fg: string; chip: string }> = {
  neutral: { fg: "text-foreground",  chip: "bg-secondary text-muted2-foreground border-border/70" },
  good:    { fg: "text-[#2F5A3A]",   chip: "bg-[#EAF2EB] text-[#2F5A3A] border-[#CFE0D3]" },
  warn:    { fg: "text-[#7A5200]",   chip: "bg-[#FBF0DA] text-[#7A5200] border-[#EEDBB0]" },
  bad:     { fg: "text-[#9F1239]",   chip: "bg-[#FDECEF] text-[#9F1239] border-[#F7CCD5]" },
  info:    { fg: "text-[#26437F]",   chip: "bg-[#EBF0FB] text-[#26437F] border-[#D0DBF3]" },
};

export function StatCard({
  label, value, hint, tone = "neutral",
  icon: Icon, delta, deltaSuffix, goodWhen = "up", href, onClick,
}: {
  label: string;
  value: string | number;
  hint?: ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "info";
  /** Optional icon chip, tinted by tone. */
  icon?: LucideIcon;
  /** Period-over-period % change (null = no baseline). */
  delta?: number | null;
  /** e.g. "vs prior 7d" */
  deltaSuffix?: string;
  goodWhen?: "up" | "down";
  href?: string;
  onClick?: () => void;
}) {
  const c = TONE[tone] || TONE.neutral;
  const numeric = typeof value === "number" ? value : null;
  const animated = useCountUp(numeric ?? 0, numeric !== null);
  const display = numeric !== null ? animated.toLocaleString("en-GB") : value;
  const interactive = !!(href || onClick);

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-[12px] font-medium text-muted2-foreground">{label}</div>
        {Icon && (
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md border ${c.chip}`}>
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
      </div>
      <div className={`mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] ${tone === "neutral" ? "text-foreground" : c.fg}`}>
        {display}
      </div>
      {(delta !== undefined || hint) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted2-foreground">
          {delta !== undefined && <Delta value={delta} goodWhen={goodWhen} suffix={deltaSuffix} />}
          {hint && <span>{hint}</span>}
        </div>
      )}
    </>
  );

  const cls = [
    "block rounded-xl border border-border/70 bg-card p-4 text-left",
    "shadow-[0_1px_2px_rgba(26,10,20,0.04)] transition-[box-shadow,border-color] duration-150",
    interactive ? "hover:border-border hover:shadow-[0_2px_10px_rgba(26,10,20,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 cursor-pointer" : "",
  ].join(" ");

  return (
    <motion.div variants={popIn} className="min-w-0">
      {href ? (
        <Link href={href} className={cls}>{body}</Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={`${cls} w-full`}>{body}</button>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </motion.div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "danger" | "warn" | "ghost" | "success";

const BTN_CLASS: Record<ButtonVariant, string> = {
  primary:   "bg-primary text-primary-foreground border-primary hover:bg-[#C21933] shadow-[0_1px_2px_rgba(160,21,60,0.25)]",
  success:   "bg-[#3F6B4A] text-white border-[#3F6B4A] hover:bg-[#355C3F] shadow-[0_1px_2px_rgba(47,90,58,0.25)]",
  secondary: "bg-card text-foreground border-border hover:bg-secondary/70",
  danger:    "bg-card text-[#B42343] border-[#F2C4CF] hover:bg-[#FDECEF]",
  warn:      "bg-card text-[#7A5200] border-[#EEDBB0] hover:bg-[#FBF0DA]",
  ghost:     "bg-transparent text-muted2-foreground border-transparent hover:bg-secondary hover:text-foreground",
};

export function Button({
  onClick, disabled, variant = "secondary", children, style, type, title,
  size = "md", className, loading, ariaLabel, ariaKeyShortcuts,
}: {
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  children: ReactNode;
  style?: React.CSSProperties;
  type?: "button" | "submit" | "reset";
  title?: string;
  size?: "sm" | "md";
  className?: string;
  loading?: boolean;
  ariaLabel?: string;
  ariaKeyShortcuts?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      type={type || "button"}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      aria-label={ariaLabel}
      aria-keyshortcuts={ariaKeyShortcuts}
      aria-busy={loading || undefined}
      whileTap={isDisabled ? undefined : { scale: 0.98 }}
      transition={SPRING_SNAP}
      className={[
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border font-medium",
        "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "h-8 px-3 text-[12.5px]" : "h-9 px-3.5 text-[13px]",
        BTN_CLASS[variant],
        className || "",
      ].join(" ")}
      style={style}
    >
      {loading && (
        <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70" />
      )}
      {children}
    </motion.button>
  );
}

// ─── Card wrapper (name kept for compatibility) ──────────────────────────────

export function GlassCard({ children, style, hoverable = false, padding = 18, className }: {
  children: ReactNode;
  style?: React.CSSProperties;
  hoverable?: boolean;
  padding?: number;
  className?: string;
}) {
  return (
    <div
      className={[
        "rounded-xl border border-border/70 bg-card text-card-foreground shadow-[0_1px_2px_rgba(26,10,20,0.04)]",
        hoverable ? "transition-shadow duration-150 hover:shadow-[0_4px_16px_rgba(26,10,20,0.07)]" : "",
        className || "",
      ].join(" ")}
      style={{ padding, ...(style || {}) }}
    >
      {children}
    </div>
  );
}

// Re-exports for pages
export { fadeUp, popIn, stagger };
