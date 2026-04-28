"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * Animated heart cursor.
 *
 * Hides on touch devices (no hover capability) and when the OS reports
 * prefers-reduced-motion. Falls back gracefully — if the component does not
 * mount, the global CSS still leaves the native cursor visible.
 */
export function AnimatedHeartCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [clicking, setClicking] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);

  // Two springs — "tip" follows tightly, "trail" lags slightly for a soft trailing glow.
  const tipX = useSpring(x, { stiffness: 600, damping: 30, mass: 0.4 });
  const tipY = useSpring(y, { stiffness: 600, damping: 30, mass: 0.4 });
  const trailX = useSpring(x, { stiffness: 140, damping: 18, mass: 0.6 });
  const trailY = useSpring(y, { stiffness: 140, damping: 18, mass: 0.6 });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const noHover = window.matchMedia("(hover: none)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (noHover || reduced) return;

    setEnabled(true);
    document.body.classList.add("heart-cursor-active");

    const onMove = (e: MouseEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const onDown = () => setClicking(true);
    const onUp = () => setClicking(false);
    const onLeave = () => {
      x.set(-100);
      y.set(-100);
    };

    const interactiveSelector =
      'a, button, [role="button"], [data-cursor-hover], summary, label, select, input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"]';

    const onOver = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest(interactiveSelector)) setHovering(true);
    };
    const onOut = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && t.closest && t.closest(interactiveSelector)) setHovering(false);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mouseover", onOver);
    window.addEventListener("mouseout", onOut);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      document.body.classList.remove("heart-cursor-active");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mouseover", onOver);
      window.removeEventListener("mouseout", onOut);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, [x, y]);

  if (!enabled) return null;

  return (
    <>
      {/* Soft trailing glow — lags slightly behind for a romantic blur */}
      <motion.div
        aria-hidden
        style={{
          translateX: trailX,
          translateY: trailY,
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 9998,
          width: 36,
          height: 36,
          marginLeft: -18,
          marginTop: -18,
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 50% 50%, rgba(255,80,120,0.55) 0%, rgba(220,30,60,0.18) 45%, rgba(220,30,60,0) 70%)",
          filter: "blur(2px)",
          mixBlendMode: "screen",
        }}
        animate={{ scale: hovering ? 2.1 : clicking ? 1.4 : 1 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
      />

      {/* The heart itself */}
      <motion.div
        aria-hidden
        style={{
          translateX: tipX,
          translateY: tipY,
          position: "fixed",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 9999,
          width: 22,
          height: 22,
          marginLeft: -11,
          marginTop: -11,
          willChange: "transform",
        }}
        animate={{
          scale: clicking ? 0.78 : hovering ? 1.45 : 1,
        }}
        transition={{ type: "spring", stiffness: 520, damping: 26 }}
      >
        <div className="heart-cursor-pulse" style={{ width: "100%", height: "100%" }}>
          <svg
            viewBox="0 0 24 24"
            width="100%"
            height="100%"
            style={{
              display: "block",
              filter: "drop-shadow(0 2px 6px rgba(220,30,60,0.45))",
            }}
          >
            <defs>
              <linearGradient id="heartCursorGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff6b8a" />
                <stop offset="55%" stopColor="#dc1e3c" />
                <stop offset="100%" stopColor="#a0153c" />
              </linearGradient>
              <linearGradient id="heartCursorShine" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgba(255,255,255,0.55)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
            </defs>
            <path
              d="M12 21s-7.5-4.6-9.6-9.4C1 7.9 3.4 4.5 6.7 4.5c2 0 3.4 1 4.4 2.4l.9 1.3.9-1.3c1-1.4 2.4-2.4 4.4-2.4 3.3 0 5.7 3.4 4.3 7.1C19.5 16.4 12 21 12 21z"
              fill="url(#heartCursorGrad)"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth="0.6"
              strokeLinejoin="round"
            />
            {/* Subtle highlight on top-left lobe */}
            <ellipse cx="8.4" cy="8.5" rx="1.6" ry="1" fill="url(#heartCursorShine)" opacity="0.85" />
          </svg>
        </div>
      </motion.div>

      <style>{`
        /* Idle heartbeat pulse on the heart — runs only while cursor is active */
        .heart-cursor-pulse {
          animation: heartCursorBeat 1.4s ease-in-out infinite;
          transform-origin: 50% 55%;
        }
        @keyframes heartCursorBeat {
          0%, 28%, 70%, 100% { transform: scale(1); }
          14% { transform: scale(1.12); }
          42% { transform: scale(1.05); }
        }

        /* Hide native cursor everywhere when the heart is active. Inputs and
           text-editable surfaces keep the I-beam so users can see selection. */
        body.heart-cursor-active,
        body.heart-cursor-active * {
          cursor: none !important;
        }
        body.heart-cursor-active input[type="text"],
        body.heart-cursor-active input[type="email"],
        body.heart-cursor-active input[type="tel"],
        body.heart-cursor-active input[type="password"],
        body.heart-cursor-active input[type="search"],
        body.heart-cursor-active input[type="number"],
        body.heart-cursor-active input[type="url"],
        body.heart-cursor-active input:not([type]),
        body.heart-cursor-active textarea,
        body.heart-cursor-active [contenteditable="true"] {
          cursor: text !important;
        }

        /* Touch / coarse pointers — no custom cursor at all */
        @media (hover: none), (pointer: coarse) {
          .heart-cursor-pulse { animation: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .heart-cursor-pulse { animation: none; }
        }
      `}</style>
    </>
  );
}

export default AnimatedHeartCursor;
