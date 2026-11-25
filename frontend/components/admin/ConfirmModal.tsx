"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, HelpCircle } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

const CHIP = { danger: "adm-soft-bad", warning: "adm-soft-warn", default: "adm-soft-brand" } as const;
// A destructive confirm is the one place a filled status colour is allowed:
// the button must say "this is the dangerous one" before it is read.
const CONFIRM = {
  danger:  "border-[#9F1239] bg-[#9F1239] text-white hover:bg-[#881337]",
  warning: "border-[#7A5200] bg-[#7A5200] text-white hover:bg-[#654400]",
  default: "border-primary bg-primary text-primary-foreground hover:bg-[#C21933]",
} as const;

/**
 * The console's one confirmation dialog. Esc and the scrim cancel; focus
 * starts on Cancel so Enter never confirms a destructive action by accident,
 * and returns to whatever opened the dialog when it closes.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const raf = requestAnimationFrame(() => cancelRef.current?.focus());
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCancelRef.current(); return; }
      if (e.key === "Tab") {
        // Two-stop focus trap.
        const first = cancelRef.current, last = confirmRef.current;
        if (!first || !last) return;
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        else if (document.activeElement !== first && document.activeElement !== last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey, true);
      previous?.focus?.();
    };
  }, [open]);

  const Icon = variant === "default" ? HelpCircle : AlertTriangle;

  return (
    <AnimatePresence>
      {open && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
          aria-describedby="confirm-modal-message"
          className="fixed inset-0 z-[1100] flex items-end justify-center p-4 sm:items-center"
        >
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-[#1A0A14]/45"
            onClick={onCancel}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-[var(--adm-shadow-modal)]"
          >
            <div className="flex items-start gap-3.5">
              <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border ${CHIP[variant]}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-modal-title" className="font-display text-[18px] font-semibold leading-tight text-foreground">{title}</h2>
                <p id="confirm-modal-message" className="mt-1.5 whitespace-pre-line text-[13px] leading-relaxed text-muted2-foreground">{message}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-border bg-card px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1"
              >
                {cancelLabel}
              </button>
              <button
                ref={confirmRef}
                type="button"
                onClick={onConfirm}
                className={`inline-flex h-9 items-center justify-center rounded-lg border px-3.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1 ${CONFIRM[variant]}`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
