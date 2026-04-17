"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, AlertCircle } from "lucide-react";

type SaveState = "idle" | "saving" | "saved" | "error";

interface Props {
  state: SaveState;
  /** Optional error text shown on hover when state === "error". */
  errorText?: string;
}

/**
 * Floating autosave indicator pinned to the bottom-right of the viewport.
 * Visible while saving / immediately after saving / when an error occurs.
 * Auto-hides ~1.6s after a successful save.
 */
export function SavedPill({ state, errorText }: Props) {
  const reduce = useReducedMotion();
  // Hold the visible state separately so the "saved" pill lingers briefly.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (state === "idle") {
      setShow(false);
      return;
    }
    setShow(true);
    if (state === "saved") {
      const t = setTimeout(() => setShow(false), 1600);
      return () => clearTimeout(t);
    }
    // saving / error: stay visible until the next state change.
  }, [state]);

  const palette: Record<SaveState, { bg: string; fg: string; border: string }> = {
    idle:   { bg: "#fff",                 fg: "#888",    border: "rgba(0,0,0,0.06)" },
    saving: { bg: "rgba(255,255,255,0.95)", fg: "#1a0a14", border: "rgba(220,30,60,0.18)" },
    saved:  { bg: "rgba(255,250,242,0.98)", fg: "#7a5a1d", border: "rgba(201,149,74,0.42)" },
    error:  { bg: "rgba(255,238,238,0.98)", fg: "#a0153c", border: "rgba(220,30,60,0.30)" },
  };
  const p = palette[state];

  return (
    <AnimatePresence>
      {show && state !== "idle" && (
        <motion.div
          key={state}
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
          style={{
            position: "fixed",
            right: 24, bottom: 24,
            zIndex: 900,
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "10px 14px",
            borderRadius: 999,
            background: p.bg,
            border: `1px solid ${p.border}`,
            boxShadow: state === "saved"
              ? "0 10px 28px rgba(201,149,74,0.30), 0 0 0 1px rgba(255,255,255,0.6) inset"
              : "0 10px 28px rgba(0,0,0,0.10), 0 0 0 1px rgba(255,255,255,0.6) inset",
            backdropFilter: "blur(8px)",
            fontSize: 12.5, fontWeight: 600, color: p.fg,
            fontFamily: "var(--font-poppins, sans-serif)",
            pointerEvents: state === "error" ? "auto" : "none",
          }}
          title={state === "error" ? (errorText || "Save failed") : undefined}
        >
          {state === "saving" && (
            <>
              <motion.div
                animate={reduce ? {} : { rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
                style={{ display: "inline-flex" }}
              >
                <Loader2 style={{ width: 13, height: 13 }} />
              </motion.div>
              Saving…
            </>
          )}
          {state === "saved" && (
            <>
              <motion.div
                initial={reduce ? false : { scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 18 }}
                style={{
                  display: "grid", placeItems: "center",
                  width: 18, height: 18, borderRadius: "50%",
                  background: "linear-gradient(135deg, #f0c987, #c9954a)",
                  boxShadow: "0 2px 8px rgba(201,149,74,0.42)",
                }}
              >
                <Check style={{ width: 11, height: 11, color: "#fff" }} strokeWidth={3} />
              </motion.div>
              Saved
            </>
          )}
          {state === "error" && (
            <>
              <AlertCircle style={{ width: 13, height: 13 }} />
              Save failed
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
