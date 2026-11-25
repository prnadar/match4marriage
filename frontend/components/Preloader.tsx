"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/**
 * Match4Marriage — loading screen.
 *
 * Concept: "Two paths, one promise".
 *   1. Two figures are drawn in a single fine line each — one in gold, one in
 *      rose — standing apart.
 *   2. They step towards each other until their shoulders interlock, the way
 *      two wedding rings do.
 *   3. A small heart is drawn in one stroke where they meet, and a single
 *      thread runs out beneath them both.
 *   4. The name rises underneath.
 *
 * Quiet by design: line work, hairlines and the brand's own aubergine, gold
 * and rose. No glow, particles or lens flares.
 *
 * Timing: the full sequence plays once per browser session (~3.4s). On later
 * full page loads in the same session only the finished mark shows briefly
 * (~0.9s), so members are never kept waiting by the animation. With
 * prefers-reduced-motion the finished mark shows with no movement.
 */

const EASE = [0.22, 1, 0.36, 1] as const;
const GOLD = "#c9954a";
const GOLD_LIGHT = "#f3c9a8";
const ROSE = "#dc1e3c";
const ROSE_LIGHT = "#ff8aa3";
const SEEN_KEY = "m4m_intro_seen";

const TAGLINE = "Elite Indian Matrimony · United Kingdom";

function seenThisSession(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

export default function Preloader() {
  const reduced = useReducedMotion();
  const pathname = usePathname();
  // Decided once on mount (this component is client-only, ssr: false).
  const [brief] = useState<boolean>(() => seenThisSession());
  const [show, setShow] = useState(true);

  const still = !!reduced || brief; // render the finished mark, no sequence
  const total = reduced ? 500 : brief ? 900 : 3400;

  useEffect(() => {
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch { /* private mode */ }
    const t = setTimeout(() => setShow(false), total);
    return () => clearTimeout(t);
  }, [total]);

  // Never gate the admin console.
  if (pathname?.startsWith("/admin")) return null;

  // Helpers: in "still" mode everything starts at its final value.
  const draw = (delay: number, duration = 0.8) =>
    still
      ? { initial: { pathLength: 1, opacity: 1 }, animate: { pathLength: 1, opacity: 1 } }
      : {
          initial: { pathLength: 0, opacity: 0 },
          animate: { pathLength: 1, opacity: 1 },
          transition: {
            pathLength: { delay, duration, ease: EASE },
            opacity: { delay, duration: 0.2 },
          },
        };

  const step = (from: number) =>
    still
      ? { initial: { x: 0 }, animate: { x: 0 } }
      : {
          initial: { x: from },
          animate: { x: 0 },
          transition: { delay: 0.85, duration: 0.8, ease: EASE },
        };

  const rise = (delay: number) =>
    still
      ? { initial: { opacity: 1, y: 0 }, animate: { opacity: 1, y: 0 } }
      : {
          initial: { opacity: 0, y: 10 },
          animate: { opacity: 1, y: 0 },
          transition: { delay, duration: 0.6, ease: EASE },
        };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="m4m-preloader"
          role="status"
          aria-live="polite"
          aria-label="Loading Match4Marriage"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduced ? 0.15 : 0.5, ease: EASE } }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center px-6"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 35%, #2a0e1a 0%, #15070e 45%, #08030a 100%)",
          }}
        >
          {/* ── The mark: two people, one promise ── */}
          <svg
            viewBox="40 0 160 124"
            aria-hidden
            className="h-auto w-[min(300px,70vw)]"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <defs>
              <linearGradient id="m4m-pre-gold" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={GOLD_LIGHT} />
                <stop offset="1" stopColor={GOLD} />
              </linearGradient>
              <linearGradient id="m4m-pre-rose" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor={ROSE_LIGHT} />
                <stop offset="1" stopColor={ROSE} />
              </linearGradient>
              <linearGradient id="m4m-pre-union" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor={GOLD} />
                <stop offset="1" stopColor={ROSE_LIGHT} />
              </linearGradient>
              {/* userSpaceOnUse: a horizontal line has a zero-height bounding box,
                  so the default objectBoundingBox gradient would not paint. */}
              <linearGradient id="m4m-pre-thread" gradientUnits="userSpaceOnUse" x1="44" y1="118" x2="196" y2="118">
                <stop offset="0" stopColor={GOLD} stopOpacity="0" />
                <stop offset="0.5" stopColor={GOLD_LIGHT} stopOpacity="0.9" />
                <stop offset="1" stopColor={ROSE_LIGHT} stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Left figure — gold */}
            <motion.g {...step(-22)} stroke="url(#m4m-pre-gold)" strokeWidth={1.6}>
              <motion.circle cx={101} cy={44} r={13} {...draw(0.1, 0.6)} />
              <motion.path
                d="M75 108 C75 82 88 68 101 68 C114 68 127 82 127 108"
                {...draw(0.25, 0.7)}
              />
            </motion.g>

            {/* Right figure — rose */}
            <motion.g {...step(22)} stroke="url(#m4m-pre-rose)" strokeWidth={1.6}>
              <motion.circle cx={139} cy={44} r={13} {...draw(0.2, 0.6)} />
              <motion.path
                d="M113 108 C113 82 126 68 139 68 C152 68 165 82 165 108"
                {...draw(0.35, 0.7)}
              />
            </motion.g>

            {/* The promise — a heart drawn in one stroke where they meet */}
            <motion.g
              style={{ transformOrigin: "120px 15px", transformBox: "view-box" as const }}
              animate={still ? undefined : { scale: [1, 1.1, 1] }}
              transition={still ? undefined : { delay: 2.5, duration: 2.2, ease: "easeInOut", repeat: Infinity }}
            >
              <motion.path
                d="M120 23 C113 18 109.5 13.5 112.5 9.5 C115 6.5 119 7.5 120 11 C121 7.5 125 6.5 127.5 9.5 C130.500 13.500 127 18 120 23 Z"
                stroke="url(#m4m-pre-union)"
                strokeWidth={1.4}
                {...draw(1.45, 0.6)}
              />
            </motion.g>

            {/* One thread beneath them both */}
            <motion.path
              d="M44 118 H196"
              stroke="url(#m4m-pre-thread)"
              strokeWidth={1}
              style={{ transformOrigin: "120px 118px", transformBox: "view-box" as const }}
              initial={still ? { scaleX: 1, opacity: 1 } : { scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={still ? undefined : { delay: 1.35, duration: 0.8, ease: EASE }}
            />
          </svg>

          {/* ── Wordmark ── */}
          <motion.div {...rise(1.3)} className="mt-7 text-center">
            <p
              className="font-display m-0 text-[clamp(30px,6vw,46px)] font-semibold leading-none tracking-[-0.01em] text-white"
              style={{ fontFamily: "var(--font-playfair, serif)" }}
            >
              Match
              <span className="mx-[0.12em] italic" style={{ color: GOLD }}>
                4
              </span>
              Marriage
            </p>
          </motion.div>

          <motion.p
            {...rise(1.5)}
            className="mb-0 mt-4 text-center text-[11px] font-medium uppercase tracking-[0.28em]"
            style={{ color: GOLD_LIGHT, opacity: 0.85 }}
          >
            {TAGLINE}
          </motion.p>

          {/* ── Progress: a single hairline that fills for as long as we show ── */}
          {!reduced && (
            <div
              aria-hidden
              className="absolute bottom-0 left-0 h-px w-full"
              style={{ background: "rgba(255,255,255,0.06)" }}
            >
              <motion.div
                className="h-full w-full origin-left"
                style={{ background: `linear-gradient(90deg, ${GOLD}, ${ROSE_LIGHT})` }}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: total / 1000, ease: "linear" }}
              />
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
