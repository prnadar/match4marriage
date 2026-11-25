"use client";

/**
 * Building blocks for the member-page admin panels (Member 360, membership,
 * consent, edit-on-behalf). Everything here composes the console's shared
 * primitives — Panel, Pill, Button, FIELD — so a restyle of those restyles
 * these panels too.
 */

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/admin/PageShell";
import { ErrorState, FIELD, type Tone } from "@/components/admin/primitives";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

export const PLAN_LABEL: Record<string, string> = { free: "Free", silver: "Basic", gold: "Premium", platinum: "Elite" };
export const REASON_MIN = 5;

export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ApiError) return e.message.replace(/^\d{3}:\s*/, "") || fallback;
  if (e instanceof Error) return e.message || fallback;
  return fallback;
}

export function money(pence: number | null | undefined, currency = "GBP"): string {
  const n = Number(pence || 0) / 100;
  try {
    return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: n % 1 === 0 ? 0 : 2 }).format(n);
  } catch {
    return `£${n.toLocaleString("en-GB")}`;
  }
}

export function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  const s = v.replace(/[._]/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const STATUS_TONE: Record<string, Tone> = {
  // interests / matches
  accepted: "good", mutual: "good", pending: "warn", interested: "info", declined: "bad", rejected: "bad",
  withdrawn: "neutral", expired: "neutral",
  // subscriptions
  active: "good", cancelled: "bad", past_due: "warn", paused: "warn",
  // verification
  approved: "good", verified: "good", submitted: "warn", in_review: "warn", failed: "bad", draft: "neutral",
  // account
  deleted: "bad", suspended: "bad", deactivated: "warn",
};
export function statusTone(status: string | null | undefined): Tone {
  return STATUS_TONE[(status || "").toLowerCase()] || "neutral";
}

/** Label / value pair for read-only facts. */
export function Fact({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11.5px] font-medium text-muted2-foreground">{label}</dt>
      <dd className={cn("mt-0.5 break-words text-[13px]", empty ? "text-muted2-foreground" : "text-foreground")}>{empty ? "—" : children}</dd>
    </div>
  );
}

export function FactGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <dl className={cn("grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3", className)}>{children}</dl>;
}

/** A labelled number, for "counts only" summaries. */
export function Count({ label, value, hint }: { label: string; value: number | string; hint?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5">
      <div className="text-[11.5px] font-medium text-muted2-foreground">{label}</div>
      <div className="mt-0.5 text-[20px] font-semibold leading-tight tabular-nums text-foreground">
        {typeof value === "number" ? value.toLocaleString("en-GB") : value}
      </div>
      {hint && <div className="mt-0.5 text-[11.5px] text-muted2-foreground">{hint}</div>}
    </div>
  );
}

// ─── Form bits ───────────────────────────────────────────────────────────────

export function FormField({ label, htmlFor, hint, error, required, children, className }: {
  label: string; htmlFor: string; hint?: React.ReactNode; error?: string | null; required?: boolean;
  children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-foreground">
        {label}{required && <span className="adm-fg-bad" aria-hidden> *</span>}
      </label>
      {children}
      {error
        ? <p role="alert" className="adm-fg-bad mt-1 text-[11.5px]">{error}</p>
        : hint ? <p className="mt-1 text-[11.5px] text-muted2-foreground">{hint}</p> : null}
    </div>
  );
}

export const INPUT = cn(FIELD, "h-9");
export const TEXTAREA = cn(FIELD, "min-h-[72px] resize-y py-2 leading-relaxed");

/** The reason every staff write must carry — it is stored in the audit log. */
export function ReasonField({ id, value, onChange, placeholder, showError }: {
  id: string; value: string; onChange: (v: string) => void; placeholder?: string; showError?: boolean;
}) {
  const tooShort = value.trim().length < REASON_MIN;
  return (
    <FormField
      label="Reason" htmlFor={id} required
      hint="Recorded in the audit log with your name."
      error={showError && tooShort ? "Add a short reason (at least 5 characters)." : null}
    >
      <textarea
        id={id} value={value} maxLength={500} required
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || "e.g. Member phoned to ask for this"}
        className={TEXTAREA}
        aria-invalid={showError && tooShort ? true : undefined}
      />
    </FormField>
  );
}

// ─── Form dialog (same surface as ConfirmModal, but holds a form) ────────────

export function FormDialog({
  open, title, description, children, onClose, onSubmit, submitLabel = "Save", submitVariant = "primary",
  busy, error, wide, submitDisabled,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  submitVariant?: "primary" | "danger" | "warn";
  busy?: boolean;
  error?: string | null;
  wide?: boolean;
  submitDisabled?: boolean;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)");
      (first || panelRef.current)?.focus();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) closeRef.current();
      if (e.key === "Tab" && panelRef.current) {
        const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
        ));
        if (nodes.length === 0) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => { cancelAnimationFrame(raf); document.removeEventListener("keydown", onKey); previous?.focus?.(); };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div role="dialog" aria-modal="true" aria-labelledby={titleId}
          className="fixed inset-0 z-[1000] flex items-end justify-center p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-[#1A0A14]/45" onClick={busy ? undefined : onClose} aria-hidden="true"
          />
          <motion.div
            ref={panelRef} tabIndex={-1}
            initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              "relative flex max-h-[calc(100dvh-2rem)] w-full flex-col rounded-2xl border border-border bg-card shadow-[var(--adm-shadow-modal)] outline-none",
              wide ? "max-w-2xl" : "max-w-lg",
            )}
          >
            <form
              className="flex min-h-0 flex-col"
              onSubmit={(e) => { e.preventDefault(); if (!busy) onSubmit(); }}
              noValidate
            >
              <header className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
                <div className="min-w-0">
                  <h2 id={titleId} className="font-display text-[18px] font-semibold leading-tight text-foreground">{title}</h2>
                  {description && <p className="mt-1 text-[12.5px] leading-relaxed text-muted2-foreground">{description}</p>}
                </div>
                <button type="button" onClick={onClose} disabled={busy} aria-label="Close"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </header>
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 pb-1" data-admin-scroll>
                {children}
                {error && <ErrorState compact message={error} />}
              </div>
              <footer className="flex flex-col-reverse gap-2 px-5 pb-5 pt-4 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
                <Button type="submit" variant={submitVariant} loading={busy} disabled={submitDisabled}>{submitLabel}</Button>
              </footer>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
