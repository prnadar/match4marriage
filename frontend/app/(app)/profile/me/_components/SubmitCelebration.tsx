"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Sparkles } from "lucide-react";

interface Props {
  open: boolean;
  /** Called when the overlay auto-dismisses (~3.2s) or the user dismisses early. */
  onDone: () => void;
}

/**
 * Full-screen celebration shown when a user successfully submits their
 * profile for verification. Auto-dismisses after ~3.2s.
 *
 * Visuals: backdrop blur → animated check mark (SVG path-draw) → headline
 * + subhead → vanilla canvas confetti burst. All motion respects
 * prefers-reduced-motion (degrades to a calm fade-in).
 */
export function SubmitCelebration({ open, onDone }: Props) {
  const reduce = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Auto-dismiss
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onDone, 3200);
    return () => clearTimeout(t);
  }, [open, onDone]);

  // Confetti burst (canvas, no dependency). Skipped under reduced motion.
  useEffect(() => {
    if (!open || reduce) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.scale(dpr, dpr);

    const COLORS = ["#dc1e3c", "#a0153c", "#c9954a", "#f0c987", "#fff", "#ff98ae"];
    type Particle = { x: number; y: number; vx: number; vy: number; r: number; rot: number; vr: number; color: string; shape: "rect" | "circ" };
    const N = Math.min(180, Math.floor(window.innerWidth / 6));
    const particles: Particle[] = [];
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2 - 40;
    for (let i = 0; i < N; i++) {
      const angle = (Math.PI * 2) * (i / N) + Math.random() * 0.4;
      const speed = 6 + Math.random() * 8;
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 4,
        r: 4 + Math.random() * 5,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        shape: Math.random() > 0.5 ? "rect" : "circ",
      });
    }

    let raf = 0;
    let alive = true;
    const start = performance.now();
    const tick = (t: number) => {
      if (!alive) return;
      const elapsed = t - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let anyVisible = false;
      for (const p of particles) {
        p.vy += 0.22;     // gravity
        p.vx *= 0.992;    // drag
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        const opacity = Math.max(0, 1 - elapsed / 2800);
        if (opacity <= 0 || p.y > window.innerHeight + 50) continue;
        anyVisible = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = opacity;
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (anyVisible && elapsed < 3200) {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    };
  }, [open, reduce]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="celebration-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onClick={onDone}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(26,10,20,0.55)",
            backdropFilter: "blur(8px)",
            display: "grid", placeItems: "center",
            cursor: "pointer",
          }}
          aria-modal="true"
          role="dialog"
          aria-label="Profile submitted for verification"
        >
          {/* Confetti canvas sits behind the card */}
          <canvas
            ref={canvasRef}
            style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
            aria-hidden
          />

          <motion.div
            key="celebration-card"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.86, y: 12 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "relative",
              padding: "36px 44px 32px",
              borderRadius: 24,
              background: "linear-gradient(160deg, #fffaf6 0%, #fff1f3 100%)",
              border: "1px solid rgba(220,30,60,0.14)",
              boxShadow: "0 24px 60px rgba(220,30,60,0.28), 0 0 0 1px rgba(255,255,255,0.6) inset",
              maxWidth: 420, width: "calc(100% - 32px)",
              textAlign: "center",
              cursor: "default",
            }}
          >
            {/* Animated check mark */}
            <div style={{ position: "relative", width: 88, height: 88, margin: "0 auto 18px" }}>
              <motion.div
                initial={reduce ? false : { scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.05 }}
                style={{
                  position: "absolute", inset: 0,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #c9954a 0%, #f0c987 100%)",
                  boxShadow: "0 12px 30px rgba(201,149,74,0.45), inset 0 0 0 4px rgba(255,255,255,0.35)",
                }}
              />
              <svg
                viewBox="0 0 56 56"
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                aria-hidden
              >
                <motion.path
                  d="M16 28 L25 37 L41 20"
                  fill="none"
                  stroke="#fff"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={reduce ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: reduce ? 0 : 0.55, ease: [0.65, 0, 0.35, 1], delay: 0.25 }}
                />
              </svg>

              {/* Sparkle accent */}
              <motion.div
                initial={reduce ? false : { scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.55, type: "spring", stiffness: 400, damping: 20 }}
                style={{
                  position: "absolute", top: -6, right: -10,
                  width: 26, height: 26, borderRadius: "50%",
                  background: "#fff",
                  display: "grid", placeItems: "center",
                  boxShadow: "0 4px 14px rgba(220,30,60,0.25)",
                }}
              >
                <Sparkles style={{ width: 14, height: 14, color: "#dc1e3c" }} />
              </motion.div>
            </div>

            <motion.h2
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: 24, fontWeight: 700, color: "#1a0a14",
                margin: "0 0 6px",
                letterSpacing: "-0.01em",
              }}
            >
              Profile submitted
            </motion.h2>

            <motion.p
              initial={reduce ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.35 }}
              style={{
                fontFamily: "var(--font-poppins, sans-serif)",
                fontSize: 13.5, color: "#666",
                margin: 0, lineHeight: 1.55,
              }}
            >
              Our team reviews submissions within 24 hours. We&apos;ll notify you the moment your profile goes live.
            </motion.p>

            <motion.button
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.6, duration: 0.4 }}
              onClick={onDone}
              style={{
                marginTop: 22, padding: "10px 22px",
                borderRadius: 10, border: "none",
                background: "linear-gradient(135deg, #dc1e3c, #7B2D3A)",
                color: "#fff", fontWeight: 600, fontSize: 13,
                cursor: "pointer",
                boxShadow: "0 6px 18px rgba(220,30,60,0.28)",
                fontFamily: "inherit",
              }}
            >
              Got it
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
