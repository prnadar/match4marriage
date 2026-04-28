"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";

/**
 * Premium animated preloader for Match4Marriage.
 *
 * Sequence (≈2.6s total):
 *   1. Cream backdrop fades in with a radial rose aura.
 *   2. Two unity rings draw themselves in counter-rotation (gold + rose).
 *   3. A small gem/diamond pulses into the centre with a sparkle burst.
 *   4. Wordmark types in letter-by-letter (Fraunces, with the rose "4").
 *   5. A gold-to-rose hairline sweeps across underneath the wordmark.
 *   6. Tagline reveals with character stagger.
 *   7. Whole stage exits with a soft scale-down + blur.
 *
 * Respects prefers-reduced-motion (renders the static end-state).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const wordmark = {
  before: "Match",
  middle: "4",
  after:  "Marriage",
};

const TAGLINE = "ELITE INDIAN MATRIMONY · UNITED KINGDOM";

export default function Preloader() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduced ? 600 : 2900);
    return () => clearTimeout(t);
  }, [reduced]);

  /* Variants ─────────────────────────────────────────────────── */
  const stage: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { duration: 0.4, ease: EASE, when: "beforeChildren" },
    },
    exit: {
      opacity: 0,
      filter: "blur(8px)",
      scale: 1.04,
      transition: { duration: 0.55, ease: EASE },
    },
  };

  const ring: Variants = {
    hidden: { pathLength: 0, opacity: 0 },
    show:   {
      pathLength: 1,
      opacity: 1,
      transition: { pathLength: { duration: 1.0, ease: EASE }, opacity: { duration: 0.3 } },
    },
  };

  const gem: Variants = {
    hidden: { scale: 0, rotate: -25, opacity: 0 },
    show: {
      scale: 1,
      rotate: 0,
      opacity: 1,
      transition: { delay: 0.7, type: "spring", stiffness: 280, damping: 18, mass: 0.7 },
    },
  };

  const sparkle: Variants = {
    hidden: { scale: 0, opacity: 0 },
    show:   {
      scale: [0, 1.4, 1.6],
      opacity: [0, 0.85, 0],
      transition: { delay: 0.85, duration: 0.9, times: [0, 0.4, 1], ease: EASE },
    },
  };

  const wordWrap: Variants = {
    hidden: {},
    show:   { transition: { delayChildren: 1.05, staggerChildren: 0.04 } },
  };
  const letter: Variants = {
    hidden: { y: 20, opacity: 0, filter: "blur(6px)" },
    show:   { y: 0,  opacity: 1, filter: "blur(0px)", transition: { duration: 0.55, ease: EASE } },
  };

  const four: Variants = {
    hidden: { y: 16, opacity: 0, scale: 0.6 },
    show:   { y: 0,  opacity: 1, scale: 1, transition: { delay: 1.35, type: "spring", stiffness: 320, damping: 18 } },
  };

  const underline: Variants = {
    hidden: { scaleX: 0, opacity: 0 },
    show:   { scaleX: 1, opacity: 1, transition: { delay: 1.55, duration: 0.6, ease: EASE } },
  };

  const tag: Variants = {
    hidden: {},
    show:   { transition: { delayChildren: 1.7, staggerChildren: 0.012 } },
  };
  const tagChar: Variants = {
    hidden: { y: 6, opacity: 0 },
    show:   { y: 0, opacity: 1, transition: { duration: 0.32, ease: EASE } },
  };

  /* ─────────────────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="m4m-preloader"
          variants={stage}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 45%, #FFF6F1 0%, #FBF7F0 60%, #fdfbf9 100%)",
            overflow: "hidden",
          }}
          aria-label="Loading Match4Marriage"
        >
          {/* Drifting heart particles (very subtle backdrop) */}
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {[
                { left: "12%", delay: 0,    dur: 16, size: 12, hue: "#f0c0d0" },
                { left: "26%", delay: 4,    dur: 14, size: 10, hue: "#e8a0b8" },
                { left: "42%", delay: 8,    dur: 18, size: 14, hue: "#ffb5c5" },
                { left: "58%", delay: 2,    dur: 17, size: 11, hue: "#e8c98a" },
                { left: "72%", delay: 6,    dur: 13, size: 13, hue: "#f0c0d0" },
                { left: "86%", delay: 10,   dur: 15, size: 10, hue: "#e8a0b8" },
              ].map((p, i) => (
                <span
                  key={i}
                  className="heart-particle"
                  style={{
                    left: p.left, bottom: -40,
                    width: p.size, height: p.size,
                    background: `radial-gradient(circle at 30% 30%, ${p.hue}, ${p.hue}cc 60%, transparent 70%)`,
                    animationDuration: `${p.dur}s`,
                    animationDelay: `${p.delay}s`,
                    opacity: 0.5,
                  }}
                />
              ))}
            </div>
          )}

          {/* ── Stage: unity rings + gem ──────────────────────────── */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.55, ease: EASE }}
            className="relative mb-8"
            style={{ width: 168, height: 96 }}
          >
            <svg viewBox="0 0 168 96" width="168" height="96" className="overflow-visible">
              <defs>
                <linearGradient id="m4mPlGold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%"  stopColor="#F2D89E" />
                  <stop offset="50%" stopColor="#C9954A" />
                  <stop offset="100%" stopColor="#9A6B00" />
                </linearGradient>
                <linearGradient id="m4mPlRose" x1="1" y1="0" x2="0" y2="1">
                  <stop offset="0%"  stopColor="#FFB5C5" />
                  <stop offset="50%" stopColor="#dc1e3c" />
                  <stop offset="100%" stopColor="#7d0a35" />
                </linearGradient>
                <radialGradient id="m4mPlGemFill" cx="50%" cy="40%" r="60%">
                  <stop offset="0%"  stopColor="#FFFAF1" />
                  <stop offset="55%" stopColor="#F8C8B8" />
                  <stop offset="100%" stopColor="#dc1e3c" />
                </radialGradient>
              </defs>

              {/* Counter-rotating subtle dotted rings */}
              {!reduced && (
                <>
                  <motion.circle
                    cx="60" cy="48" r="38"
                    fill="none" stroke="rgba(201,149,74,0.20)"
                    strokeWidth="0.6" strokeDasharray="2 4"
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 28, ease: "linear" }}
                    style={{ transformOrigin: "60px 48px" }}
                  />
                  <motion.circle
                    cx="108" cy="48" r="38"
                    fill="none" stroke="rgba(220,30,60,0.20)"
                    strokeWidth="0.6" strokeDasharray="2 4"
                    animate={{ rotate: -360 }}
                    transition={{ repeat: Infinity, duration: 32, ease: "linear" }}
                    style={{ transformOrigin: "108px 48px" }}
                  />
                </>
              )}

              {/* Unity rings (drawn-in) */}
              <motion.circle
                cx="60" cy="48" r="34"
                fill="none" stroke="url(#m4mPlGold)" strokeWidth="2.4" strokeLinecap="round"
                variants={ring}
                initial="hidden" animate="show"
                style={{ transformOrigin: "60px 48px" }}
              />
              <motion.circle
                cx="108" cy="48" r="34"
                fill="none" stroke="url(#m4mPlRose)" strokeWidth="2.4" strokeLinecap="round"
                variants={ring}
                initial="hidden" animate="show"
                transition={{ pathLength: { duration: 1.0, ease: EASE, delay: 0.15 }, opacity: { duration: 0.3, delay: 0.15 } }}
                style={{ transformOrigin: "108px 48px" }}
              />

              {/* Sparkle burst behind the gem */}
              <motion.g variants={sparkle} initial="hidden" animate="show" style={{ transformOrigin: "84px 48px" }}>
                {[0, 45, 90, 135].map((a) => (
                  <line
                    key={a}
                    x1={84 - 10 * Math.cos(a * Math.PI / 180)}
                    y1={48 - 10 * Math.sin(a * Math.PI / 180)}
                    x2={84 + 10 * Math.cos(a * Math.PI / 180)}
                    y2={48 + 10 * Math.sin(a * Math.PI / 180)}
                    stroke="rgba(201,149,74,0.85)"
                    strokeWidth="0.8"
                    strokeLinecap="round"
                  />
                ))}
              </motion.g>

              {/* Gem at intersection */}
              <motion.g variants={gem} initial="hidden" animate="show" style={{ transformOrigin: "84px 48px" }}>
                <path
                  d="M84 36 L92 46 L84 60 L76 46 Z"
                  fill="url(#m4mPlGemFill)"
                  stroke="#fff" strokeWidth="0.6"
                />
                {/* Highlight facet */}
                <path
                  d="M84 36 L88 46 L84 50 L80 46 Z"
                  fill="rgba(255,255,255,0.55)"
                />
              </motion.g>
            </svg>
          </motion.div>

          {/* ── Wordmark ─────────────────────────────────────────── */}
          <motion.h1
            variants={wordWrap}
            initial="hidden"
            animate="show"
            className="font-display select-none"
            style={{
              fontSize: "clamp(28px, 4.2vw, 40px)",
              fontWeight: 600,
              color: "#1a0a14",
              letterSpacing: "-0.012em",
              lineHeight: 1,
              display: "flex",
              alignItems: "baseline",
              gap: 1,
            }}
          >
            {wordmark.before.split("").map((c, i) => (
              <motion.span key={`b-${i}`} variants={letter} style={{ display: "inline-block" }}>
                {c}
              </motion.span>
            ))}
            <motion.span
              variants={four}
              style={{
                display: "inline-block",
                color: "#dc1e3c",
                fontStyle: "italic",
                margin: "0 4px",
                textShadow: "0 6px 20px rgba(220,30,60,0.25)",
              }}
            >
              {wordmark.middle}
            </motion.span>
            {wordmark.after.split("").map((c, i) => (
              <motion.span key={`a-${i}`} variants={letter} style={{ display: "inline-block" }}>
                {c}
              </motion.span>
            ))}
          </motion.h1>

          {/* ── Underline sweep ──────────────────────────────────── */}
          <motion.div
            variants={underline}
            initial="hidden"
            animate="show"
            className="mt-3"
            style={{
              width: 156,
              height: 2,
              background: "linear-gradient(90deg, transparent 0%, #dc1e3c 25%, #C9954A 75%, transparent 100%)",
              borderRadius: 9999,
              transformOrigin: "center",
            }}
          />

          {/* ── Tagline ──────────────────────────────────────────── */}
          <motion.p
            variants={tag}
            initial="hidden"
            animate="show"
            className="mt-4 select-none"
            style={{
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              fontSize: 11,
              fontWeight: 600,
              color: "#a78a8f",
              letterSpacing: "0.28em",
              display: "flex",
              gap: 0.5,
            }}
          >
            {TAGLINE.split("").map((c, i) => (
              <motion.span key={i} variants={tagChar} style={{ display: "inline-block", whiteSpace: "pre" }}>
                {c}
              </motion.span>
            ))}
          </motion.p>

          {/* ── Slim progress bar (bottom edge) ──────────────────── */}
          {!reduced && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 2.5, ease: [0.4, 0, 0.2, 1] }}
              className="absolute bottom-0 left-0 right-0"
              style={{
                height: 2,
                background: "linear-gradient(90deg, #dc1e3c 0%, #C9954A 100%)",
                transformOrigin: "left",
                boxShadow: "0 -2px 14px rgba(220,30,60,0.20)",
              }}
            />
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
