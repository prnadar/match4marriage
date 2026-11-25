"use client";

/**
 * Admin console primitives — small, token-based building blocks shared by the
 * console pages (Panel, Pill, Segmented, SearchField, EmptyState, Skeleton,
 * Kbd, Delta, Avatar) plus formatting helpers. Tailwind + the shadcn semantic
 * tokens in globals.css; no inline colour literals except tone maps.
 */

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight, Search, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Formatting helpers ──────────────────────────────────────────────────────

export function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const future = diff < 0;
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const wrap = (s: string) => (future ? `in ${s}` : `${s} ago`);
  if (mins < 1) return future ? "soon" : "just now";
  if (mins < 60) return wrap(`${mins}m`);
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return wrap(`${hrs}h`);
  const days = Math.floor(hrs / 24);
  if (days < 30) return wrap(`${days}d`);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: days > 300 ? "numeric" : undefined });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Hours since an ISO timestamp (naive server timestamps are treated as UTC). */
export function hoursSince(iso?: string | null): number | null {
  if (!iso) return null;
  const s = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return (Date.now() - d.getTime()) / 3600000;
}

export function waitingLabel(hours: number | null): string {
  if (hours === null) return "—";
  if (hours < 1) return "<1h";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const d = Math.floor(hours / 24);
  return `${d}d`;
}

/** Percent change; null when there's no baseline to compare against. */
export function pctChange(current: number, previous: number): number | null {
  if (!previous) return current > 0 ? null : 0;
  return ((current - previous) / previous) * 100;
}

export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (Math.abs(n) < 10000) return n.toLocaleString("en-GB");
  return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase() || "").join("") || "?";
}

// ─── Panel (section card with header) ───────────────────────────────────────

export function Panel({
  title, description, actions, children, className, bodyClassName, id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-xl border border-border/70 bg-card text-card-foreground",
        "shadow-[0_1px_2px_rgba(26,10,20,0.04)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div className="min-w-0">
            {title && <h2 className="text-[14px] font-semibold text-foreground leading-tight">{title}</h2>}
            {description && <p className="mt-0.5 text-[12px] text-muted2-foreground">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={cn(title || actions ? "px-5 pb-5" : "p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

// ─── Pill (status chip; always text + colour, never colour alone) ───────────

export type Tone = "neutral" | "good" | "warn" | "bad" | "info" | "brand";

const PILL_TONE: Record<Tone, string> = {
  neutral: "bg-muted2 text-muted2-foreground border-border/60",
  good:    "bg-[#EAF2EB] text-[#2F5A3A] border-[#CFE0D3]",
  warn:    "bg-[#FBF0DA] text-[#7A5200] border-[#EEDBB0]",
  bad:     "bg-[#FDECEF] text-[#9F1239] border-[#F7CCD5]",
  info:    "bg-[#EBF0FB] text-[#26437F] border-[#D0DBF3]",
  brand:   "bg-primary/10 text-primary border-primary/20",
};

export function Pill({ tone = "neutral", children, className, dot }: {
  tone?: Tone; children: React.ReactNode; className?: string; dot?: boolean;
}) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-[2px] text-[11px] font-medium leading-4",
      PILL_TONE[tone], className,
    )}>
      {dot && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

// ─── Segmented control (tabs with counts) ───────────────────────────────────

export function Segmented<T extends string>({
  options, value, onChange, layoutId = "seg-pill", size = "md", className, ariaLabel,
}: {
  options: Array<{ value: NoInfer<T>; label: React.ReactNode; count?: number | null }>;
  value: T;
  onChange: (v: NoInfer<T>) => void;
  layoutId?: string;
  size?: "sm" | "md";
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-secondary/60 p-0.5", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "relative inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
              size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[12.5px]",
              active ? "text-foreground" : "text-muted2-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                className="absolute inset-0 rounded-md bg-card shadow-[0_1px_2px_rgba(26,10,20,0.08),0_0_0_1px_rgba(26,10,20,0.04)]"
              />
            )}
            <span className="relative">{o.label}</span>
            {typeof o.count === "number" && (
              <span className={cn(
                "relative min-w-[18px] rounded-full px-1.5 text-center text-[10.5px] font-semibold tabular-nums leading-4",
                active ? "bg-primary/10 text-primary" : "bg-border/60 text-muted2-foreground",
              )}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Search field ────────────────────────────────────────────────────────────

export const SearchField = React.forwardRef<HTMLInputElement, {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}>(function SearchField({ value, onChange, placeholder = "Search…", className, autoFocus, ariaLabel }, ref) {
  return (
    <label className={cn(
      "flex h-9 items-center gap-2 rounded-lg border border-border/80 bg-card px-3",
      "focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/15 transition-shadow",
      className,
    )}>
      <Search className="h-3.5 w-3.5 shrink-0 text-muted2-foreground" aria-hidden />
      <input
        ref={ref}
        type="search"
        value={value}
        autoFocus={autoFocus}
        aria-label={ariaLabel || placeholder}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted2-foreground/80 outline-none [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="grid h-5 w-5 place-items-center rounded text-muted2-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-3 w-3" />
        </button>
      )}
    </label>
  );
});

// ─── Empty state ─────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, description, action, compact, className }: {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "py-6" : "py-12", className)}>
      {Icon && (
        <div className="mb-3 grid h-10 w-10 place-items-center rounded-full border border-border/70 bg-secondary/70">
          <Icon className="h-4 w-4 text-muted2-foreground" aria-hidden />
        </div>
      )}
      <p className="text-[13px] font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12.5px] text-muted2-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("m4m-shimmer rounded-md", className)} />;
}

export function SkeletonRows({ rows = 6, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-11" />)}
    </div>
  );
}

// ─── Kbd ─────────────────────────────────────────────────────────────────────

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd className={cn(
      "inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-card px-1",
      "font-sans text-[10.5px] font-medium text-muted2-foreground shadow-[0_1px_0_rgba(26,10,20,0.06)]",
      className,
    )}>
      {children}
    </kbd>
  );
}

// ─── Delta (period-over-period change) ──────────────────────────────────────

export function Delta({ value, goodWhen = "up", suffix, className }: {
  value: number | null | undefined;
  goodWhen?: "up" | "down";
  suffix?: string;
  className?: string;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return suffix ? <span className={cn("text-[11.5px] text-muted2-foreground", className)}>{suffix}</span> : null;
  }
  const flat = Math.abs(value) < 0.5;
  const up = value > 0;
  const good = flat ? null : (up ? goodWhen === "up" : goodWhen === "down");
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11.5px] text-muted2-foreground", className)}>
      <span className={cn(
        "inline-flex items-center gap-0.5 font-semibold tabular-nums",
        good === null ? "text-muted2-foreground" : good ? "text-[#2F6B3F]" : "text-[#B42343]",
      )}>
        {!flat && (up ? <ArrowUpRight className="h-3 w-3" aria-hidden /> : <ArrowDownRight className="h-3 w-3" aria-hidden />)}
        <span className="sr-only">{flat ? "No change" : up ? "Up" : "Down"}</span>
        {flat ? "0%" : `${Math.abs(value) >= 100 ? Math.round(Math.abs(value)) : Math.abs(value).toFixed(0)}%`}
      </span>
      {suffix && <span>{suffix}</span>}
    </span>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({ name, url, size = 32, className }: { name: string; url?: string | null; size?: number; className?: string }) {
  return (
    <span
      className={cn("relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground ring-1 ring-border/70", className)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
      aria-hidden
    >
      {url
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
        : initials(name)}
    </span>
  );
}

// ─── Toolbar row ─────────────────────────────────────────────────────────────

export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("mb-4 flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
