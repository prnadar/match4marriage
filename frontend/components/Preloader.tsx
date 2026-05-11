"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type Variants,
} from "framer-motion";

/**
 * Match4Marriage — cinematic dark-luxe preloader.
 *
 * Concept: "The Promise". The two unity rings are no longer abstract
 * decoration — they fly in from opposite sides of the frame, arc inward,
 * lock at center, and the diamond gem rises from below into the union.
 * A horizontal lens flare crosses the contact point and rose-gold petals
 * drift upward, giving the moment the cadence of a wedding ceremony.
 *
 * Visual layers, back to front:
 *   1. Deep wine→black radial gradient ground.
 *   2. Twinkling micro-starfield (canvas-free, all CSS).
 *   3. Drifting bokeh particles (rose + gold).
 *   4. Mouse-tracked aurora glow that parallaxes with the cursor.
 *   5. Counter-rotating dotted orbits with soft glow.
 *   6. Two unity rings (gold + rose) — fly in from sides, rotate, lock.
 *   7. Lens flare swipe across the contact point.
 *   8. Diamond gem rising from below + sparkle burst + halo.
 *   9. Drifting rose-and-gold petal confetti.
 *  10. Wordmark types in letter-by-letter, gold "4" springs in.
 *  11. Gradient hairline sweep underneath.
 *  12. Tagline reveal with character stagger.
 *  13. Bottom progress beam with shimmer.
 *
 * Respects prefers-reduced-motion (renders the static end state).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

const wordmark = {
  before: "Match",
  middle: "4",
  after:  "Marriage",
};

const TAGLINE = "Elite Indian Matrimony · United Kingdom";

export default function Preloader() {
  const reduced = useReducedMotion();
  const [show, setShow] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);

  // Mouse-tracked aurora — springs give it that smooth lag.
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const smx = useSpring(mx, { stiffness: 80, damping: 22, mass: 0.6 });
  const smy = useSpring(my, { stiffness: 80, damping: 22, mass: 0.6 });
  // Aurora and parallax derived translations
  const auroraX = useTransform(smx, (v) => `${(v - 0.5) * 60}px`);
  const auroraY = useTransform(smy, (v) => `${(v - 0.5) * 60}px`);
  const ringsTilt = useTransform(smx, (v) => `${(v - 0.5) * 6}deg`);
  const ringsLift = useTransform(smy, (v) => `${(v - 0.5) * 6}deg`);

  useEffect(() => {
    const t = setTimeout(() => setShow(false), reduced ? 600 : 3800);
    return () => clearTimeout(t);
  }, [reduced]);

  useEffect(() => {
    if (reduced) return;
    const el = stageRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      mx.set((e.clientX - r.left) / r.width);
      my.set((e.clientY - r.top) / r.height);
    };
    el.addEventListener("mousemove", onMove);
    return () => el.removeEventListener("mousemove", onMove);
  }, [mx, my, reduced]);

  /* ─── Variants ────────────────────────────────────────────── */
  const stage: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { duration: 0.4, ease: EASE, when: "beforeChildren" },
    },
    exit: {
      opacity: 0,
      filter: "blur(10px)",
      scale: 1.06,
      transition: { duration: 0.6, ease: EASE },
    },
  };

  // His ring — flies in from off-screen left, arcs inward, settles at the
  // left circle position. The rotation gives it forward momentum so it reads
  // as "approaching" rather than just appearing.
  const ringLeft: Variants = {
    hidden: { x: -260, rotate: -35, opacity: 0 },
    show: {
      x: 0, rotate: 0, opacity: 1,
      transition: { duration: 1.1, ease: EASE, delay: 0.15 },
    },
  };
  // Her ring — mirror entry from the right, slight delay creates the call-
  // and-response cadence of an exchange rather than a synchronised arrival.
  const ringRight: Variants = {
    hidden: { x: 260, rotate: 35, opacity: 0 },
    show: {
      x: 0, rotate: 0, opacity: 1,
      transition: { duration: 1.1, ease: EASE, delay: 0.32 },
    },
  };

  // Lens flare — a horizontal beam that streaks across the contact point at
  // the exact moment the two rings lock. Quick exposure-pop, then gone.
  const flare: Variants = {
    hidden: { scaleX: 0, opacity: 0 },
    show: {
      scaleX: [0, 1, 1, 0],
      opacity: [0, 0.95, 0.45, 0],
      transition: { delay: 1.05, duration: 0.85, times: [0, 0.4, 0.7, 1], ease: EASE },
    },
  };

  // Diamond rises from below into the intersection — like it's being placed
  // on the union, not just appearing. Slight overshoot via spring.
  const gem: Variants = {
    hidden: { y: 38, scale: 0.4, opacity: 0 },
    show: {
      y: 0, scale: 1, opacity: 1,
      transition: { delay: 1.1, type: "spring", stiffness: 240, damping: 18, mass: 0.7 },
    },
  };

  const sparkle: Variants = {
    hidden: { scale: 0, opacity: 0 },
    show: {
      scale: [0, 1.5, 1.8],
      opacity: [0, 1, 0],
      transition: { delay: 1.25, duration: 1.0, times: [0, 0.4, 1], ease: EASE },
    },
  };

  const wordWrap: Variants = {
    hidden: {},
    show: { transition: { delayChildren: 1.55, staggerChildren: 0.045 } },
  };
  const letter: Variants = {
    hidden: { y: 22, opacity: 0, filter: "blur(8px)" },
    show:   { y: 0, opacity: 1, filter: "blur(0px)", transition: { duration: 0.6, ease: EASE } },
  };

  const four: Variants = {
    hidden: { y: 18, opacity: 0, scale: 0.55, rotate: -6 },
    show: {
      y: 0, opacity: 1, scale: 1, rotate: 0,
      transition: { delay: 1.9, type: "spring", stiffness: 320, damping: 16 },
    },
  };

  const underline: Variants = {
    hidden: { scaleX: 0, opacity: 0 },
    show:   { scaleX: 1, opacity: 1, transition: { delay: 2.1, duration: 0.65, ease: EASE } },
  };

  const tag: Variants = {
    hidden: {},
    show:   { transition: { delayChildren: 2.25, staggerChildren: 0.014 } },
  };
  const tagChar: Variants = {
    hidden: { y: 8, opacity: 0 },
    show:   { y: 0, opacity: 1, transition: { duration: 0.34, ease: EASE } },
  };

  /* ─── Static decorative arrays ────────────────────────────── */
  const stars = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: Math.random() * 1.6 + 0.6,
    delay: Math.random() * 4,
    dur: 2 + Math.random() * 3,
    opacity: 0.25 + Math.random() * 0.55,
  }));

  const bokeh = [
    { left: "8%",  top: "18%", size: 110, delay: 0.0, dur: 16, hue: "rgba(220,30,60,0.16)" },
    { left: "22%", top: "78%", size: 140, delay: 1.4, dur: 18, hue: "rgba(255,181,140,0.10)" },
    { left: "62%", top: "22%", size: 120, delay: 2.2, dur: 17, hue: "rgba(255,200,120,0.10)" },
    { left: "78%", top: "70%", size: 160, delay: 0.8, dur: 19, hue: "rgba(220,30,60,0.14)" },
    { left: "44%", top: "8%",  size: 90,  delay: 3.0, dur: 15, hue: "rgba(255,170,200,0.12)" },
    { left: "92%", top: "42%", size: 100, delay: 2.0, dur: 16, hue: "rgba(255,210,140,0.10)" },
  ];

  // Rose-and-gold petals scattered around the ring composition. They drift
  // upward at slightly different speeds and rotations after the rings
  // lock — the wedding-ceremony moment of celebration. Deterministic
  // positions so SSR ↔ client hydration matches.
  const petals = [
    { left: 32, dx:  -30, color: "#FFE4A8", size: 14, delay: 1.10, dur: 2.6, rot:  18 },
    { left: 38, dx:    8, color: "#FFC2D2", size: 11, delay: 1.18, dur: 2.4, rot: -22 },
    { left: 45, dx:  -14, color: "#E0B056", size: 12, delay: 1.22, dur: 2.7, rot:  35 },
    { left: 52, dx:   24, color: "#FF6B8A", size: 10, delay: 1.20, dur: 2.5, rot: -10 },
    { left: 58, dx:  -22, color: "#FFB347", size: 13, delay: 1.30, dur: 2.6, rot:  28 },
    { left: 64, dx:   16, color: "#FFC2D2", size: 12, delay: 1.26, dur: 2.7, rot: -34 },
    { left: 71, dx:  -10, color: "#FFE4A8", size: 11, delay: 1.34, dur: 2.5, rot:  14 },
    { left: 28, dx:    4, color: "#FF6B8A", size:  9, delay: 1.40, dur: 2.4, rot: -42 },
    { left: 49, dx:  -36, color: "#E0B056", size:  8, delay: 1.45, dur: 2.8, rot:  52 },
    { left: 60, dx:   30, color: "#FFB347", size: 10, delay: 1.42, dur: 2.6, rot: -26 },
  ];

  /* ─────────────────────────────────────────────────────────── */
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={stageRef}
          key="m4m-preloader"
          variants={stage}
          initial="hidden"
          animate="show"
          exit="exit"
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center"
          style={{
            background:
              "radial-gradient(120% 100% at 50% 35%, #2a0e1a 0%, #15070e 45%, #08030a 100%)",
            overflow: "hidden",
            color: "#fff",
          }}
          aria-label="Loading Match4Marriage"
        >
          {/* ── 1. Vignette ───────────────────────────────────── */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.55) 100%)",
            }}
          />

          {/* ── 2. Starfield ──────────────────────────────────── */}
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {stars.map((s) => (
                <span
                  key={s.id}
                  className="m4m-pl-star"
                  style={{
                    left: `${s.left}%`,
                    top: `${s.top}%`,
                    width: s.size,
                    height: s.size,
                    opacity: s.opacity,
                    animationDelay: `${s.delay}s`,
                    animationDuration: `${s.dur}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* ── 3. Drifting bokeh blobs ───────────────────────── */}
          {!reduced && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {bokeh.map((b, i) => (
                <span
                  key={i}
                  className="m4m-pl-bokeh"
                  style={{
                    left: b.left,
                    top: b.top,
                    width: b.size,
                    height: b.size,
                    background: `radial-gradient(circle at 50% 50%, ${b.hue} 0%, transparent 70%)`,
                    animationDelay: `${b.delay}s`,
                    animationDuration: `${b.dur}s`,
                  }}
                />
              ))}
            </div>
          )}

          {/* ── 4. Mouse-tracked aurora glow ──────────────────── */}
          {!reduced && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                width: 900,
                height: 900,
                left: "50%",
                top: "50%",
                marginLeft: -450,
                marginTop: -450,
                x: auroraX,
                y: auroraY,
                background:
                  "radial-gradient(circle at 50% 50%, rgba(220,30,60,0.22) 0%, rgba(201,149,74,0.10) 35%, transparent 65%)",
                filter: "blur(40px)",
                mixBlendMode: "screen",
              }}
            />
          )}

          {/* ── 5+6+7. Rings + gem stage ──────────────────────── */}
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: EASE }}
            className="relative mb-9"
            style={{
              width: 200,
              height: 110,
              perspective: 800,
            }}
          >
            <motion.div
              style={{
                width: "100%",
                height: "100%",
                rotateY: ringsTilt,
                rotateX: ringsLift,
                transformStyle: "preserve-3d",
              }}
            >
              <svg viewBox="0 0 200 110" width="200" height="110" className="overflow-visible">
                <defs>
                  <linearGradient id="m4mPlGold" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor="#FFE4A8" />
                    <stop offset="50%"  stopColor="#E0B056" />
                    <stop offset="100%" stopColor="#8C5E14" />
                  </linearGradient>
                  <linearGradient id="m4mPlRose" x1="1" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor="#FFC2D2" />
                    <stop offset="50%"  stopColor="#FF3060" />
                    <stop offset="100%" stopColor="#7d0a35" />
                  </linearGradient>
                  <radialGradient id="m4mPlGemFill" cx="50%" cy="40%" r="60%">
                    <stop offset="0%"   stopColor="#FFFAF1" />
                    <stop offset="55%"  stopColor="#F8C8B8" />
                    <stop offset="100%" stopColor="#dc1e3c" />
                  </radialGradient>
                  <radialGradient id="m4mPlGemHalo" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stopColor="rgba(255,200,140,0.55)" />
                    <stop offset="50%"  stopColor="rgba(220,30,60,0.18)" />
                    <stop offset="100%" stopColor="rgba(220,30,60,0)" />
                  </radialGradient>
                  <linearGradient id="m4mPlFlare" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
                    <stop offset="35%"  stopColor="rgba(255,220,180,0.6)" />
                    <stop offset="50%"  stopColor="rgba(255,255,255,1)" />
                    <stop offset="65%"  stopColor="rgba(255,220,180,0.6)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>
                  <filter id="m4mPlGlow" x="-30%" y="-30%" width="160%" height="160%">
                    <feGaussianBlur stdDeviation="2.4" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                {/* Halo behind gem — swells just before the diamond rises
                    into the union, then settles. */}
                <motion.circle
                  cx="100" cy="55" r="44"
                  fill="url(#m4mPlGemHalo)"
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: [0, 0.9, 0.55], scale: [0.6, 1.15, 1] }}
                  transition={{ delay: 1.0, duration: 1.4, ease: EASE, times: [0, 0.5, 1] }}
                  style={{ transformOrigin: "100px 55px", mixBlendMode: "screen" }}
                />

                {/* Counter-rotating dotted orbits */}
                {!reduced && (
                  <>
                    <motion.circle
                      cx="76" cy="55" r="42"
                      fill="none" stroke="rgba(224,176,86,0.28)"
                      strokeWidth="0.6" strokeDasharray="2 4"
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 28, ease: "linear" }}
                      style={{ transformOrigin: "76px 55px" }}
                    />
                    <motion.circle
                      cx="124" cy="55" r="42"
                      fill="none" stroke="rgba(255,48,96,0.28)"
                      strokeWidth="0.6" strokeDasharray="2 4"
                      animate={{ rotate: -360 }}
                      transition={{ repeat: Infinity, duration: 32, ease: "linear" }}
                      style={{ transformOrigin: "124px 55px" }}
                    />
                  </>
                )}

                {/* Unity rings — fly in from opposite sides, lock at centre,
                    then breathe softly. Each ring rides its own translation
                    so the entry feels like an exchange, not a synchronised
                    fade. The breathing pulse on the wrapper carries through
                    once both rings have settled. */}
                <motion.g
                  animate={!reduced ? { scale: [1, 1.025, 1] } : undefined}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 1.4 }}
                  style={{ transformOrigin: "100px 55px" }}
                >
                  <motion.g
                    variants={ringLeft}
                    initial="hidden"
                    animate="show"
                    style={{ transformOrigin: "76px 55px" }}
                  >
                    <circle
                      cx="76" cy="55" r="38"
                      fill="none" stroke="url(#m4mPlGold)" strokeWidth="2.6" strokeLinecap="round"
                      filter="url(#m4mPlGlow)"
                    />
                  </motion.g>
                  <motion.g
                    variants={ringRight}
                    initial="hidden"
                    animate="show"
                    style={{ transformOrigin: "124px 55px" }}
                  >
                    <circle
                      cx="124" cy="55" r="38"
                      fill="none" stroke="url(#m4mPlRose)" strokeWidth="2.6" strokeLinecap="round"
                      filter="url(#m4mPlGlow)"
                    />
                  </motion.g>
                </motion.g>

                {/* Lens flare — thin horizontal beam swiping across the ring
                    contact point exactly when the rings lock. Adds the
                    "exposure pop" of a pro photograph at the moment of
                    union. */}
                <motion.g
                  variants={flare}
                  initial="hidden"
                  animate="show"
                  style={{ transformOrigin: "100px 55px", mixBlendMode: "screen" }}
                >
                  <rect
                    x="-40" y="53.4" width="280" height="3.2"
                    fill="url(#m4mPlFlare)"
                    rx="1.6"
                  />
                </motion.g>

                {/* Sparkle burst behind the gem */}
                <motion.g variants={sparkle} initial="hidden" animate="show" style={{ transformOrigin: "100px 55px" }}>
                  {[0, 30, 60, 90, 120, 150].map((a) => (
                    <line
                      key={a}
                      x1={100 - 13 * Math.cos((a * Math.PI) / 180)}
                      y1={55  - 13 * Math.sin((a * Math.PI) / 180)}
                      x2={100 + 13 * Math.cos((a * Math.PI) / 180)}
                      y2={55  + 13 * Math.sin((a * Math.PI) / 180)}
                      stroke="rgba(255,220,160,0.95)"
                      strokeWidth="0.9"
                      strokeLinecap="round"
                    />
                  ))}
                </motion.g>

                {/* Gem at intersection */}
                <motion.g variants={gem} initial="hidden" animate="show" style={{ transformOrigin: "100px 55px" }}>
                  <path
                    d="M100 41 L110 53 L100 71 L90 53 Z"
                    fill="url(#m4mPlGemFill)"
                    stroke="rgba(255,255,255,0.85)" strokeWidth="0.7"
                    filter="url(#m4mPlGlow)"
                  />
                  <path
                    d="M100 41 L105 53 L100 58 L95 53 Z"
                    fill="rgba(255,255,255,0.6)"
                  />
                </motion.g>
              </svg>
            </motion.div>
          </motion.div>

          {/* ── 7b. Petal confetti — rose & gold petals drifting upward
                  from the ring composition. Fires shortly after the rings
                  lock, settles before the wordmark types in. */}
          {!reduced && (
            <div
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                left: "50%",
                top: "50%",
                marginLeft: -260,
                marginTop: -120,
                width: 520,
                height: 220,
                overflow: "visible",
              }}
            >
              {petals.map((p, i) => (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 0, rotate: 0, scale: 0.6 }}
                  animate={{
                    x: [0, p.dx],
                    y: [0, -160],
                    opacity: [0, 0.9, 0.9, 0],
                    rotate: [0, p.rot, p.rot * 1.6],
                    scale: [0.6, 1, 1],
                  }}
                  transition={{
                    delay: p.delay,
                    duration: p.dur,
                    times: [0, 0.18, 0.6, 1],
                    ease: EASE,
                  }}
                  style={{
                    position: "absolute",
                    left: `${p.left}%`,
                    top: "60%",
                    width: p.size,
                    height: p.size * 1.55,
                    background: `radial-gradient(ellipse at 50% 35%, ${p.color} 0%, ${p.color}cc 55%, transparent 100%)`,
                    borderRadius: "60% 60% 30% 30% / 70% 70% 30% 30%",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))",
                    mixBlendMode: "screen",
                  }}
                />
              ))}
            </div>
          )}

          {/* ── 8. Wordmark ───────────────────────────────────── */}
          <motion.h1
            variants={wordWrap}
            initial="hidden"
            animate="show"
            className="font-display select-none"
            style={{
              fontSize: "clamp(30px, 4.4vw, 44px)",
              fontWeight: 600,
              color: "#fff",
              letterSpacing: "-0.012em",
              lineHeight: 1,
              display: "flex",
              alignItems: "baseline",
              gap: 1,
              textShadow: "0 6px 26px rgba(220,30,60,0.18)",
            }}
          >
            {wordmark.before.split("").map((c, i) => (
              <motion.span key={`b-${i}`} variants={letter} style={{ display: "inline-block" }}>
                {c}
              </motion.span>
            ))}
            <motion.span
              variants={four}
              className="m4m-pl-four"
              style={{
                display: "inline-block",
                fontStyle: "italic",
                margin: "0 6px",
                background: "linear-gradient(135deg, #FFE4A8 0%, #FFB347 50%, #dc1e3c 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 6px 18px rgba(255,180,90,0.4))",
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

          {/* ── 9. Underline sweep ────────────────────────────── */}
          <motion.div
            variants={underline}
            initial="hidden"
            animate="show"
            className="mt-3"
            style={{
              width: 180,
              height: 2,
              background:
                "linear-gradient(90deg, transparent 0%, #FFE4A8 25%, #dc1e3c 75%, transparent 100%)",
              borderRadius: 9999,
              transformOrigin: "center",
              boxShadow: "0 0 14px rgba(220,30,60,0.45)",
            }}
          />

          {/* ── 10. Tagline ───────────────────────────────────── */}
          <motion.p
            variants={tag}
            initial="hidden"
            animate="show"
            className="mt-4 select-none"
            style={{
              fontFamily: "var(--font-body, 'Inter', sans-serif)",
              fontSize: 12.5,
              fontWeight: 500,
              color: "rgba(255, 220, 180, 0.82)",
              letterSpacing: "0.14em",
              display: "flex",
              gap: 0.5,
            }}
          >
            {TAGLINE.split("").map((c, i) => (
              <motion.span
                key={i}
                variants={tagChar}
                style={{ display: "inline-block", whiteSpace: "pre" }}
              >
                {c}
              </motion.span>
            ))}
          </motion.p>

          {/* ── 11. Bottom progress beam with shimmer ─────────── */}
          {!reduced && (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 3.3, ease: [0.4, 0, 0.2, 1] }}
              className="absolute bottom-0 left-0 right-0 m4m-pl-progress"
              style={{
                height: 2,
                background:
                  "linear-gradient(90deg, #dc1e3c 0%, #FFB347 50%, #FFE4A8 100%)",
                transformOrigin: "left",
                boxShadow:
                  "0 -2px 22px rgba(220,30,60,0.45), 0 -8px 40px rgba(255,180,90,0.20)",
              }}
            />
          )}

          {/* Component-scoped CSS for stars / bokeh / shimmer */}
          <style>{`
            .m4m-pl-star {
              position: absolute;
              border-radius: 50%;
              background: radial-gradient(circle, #fff 0%, rgba(255,255,255,0) 70%);
              box-shadow: 0 0 4px rgba(255,255,255,0.45);
              animation: m4mPlStarTwinkle ease-in-out infinite;
            }
            @keyframes m4mPlStarTwinkle {
              0%, 100% { opacity: var(--o, 0.4); transform: scale(1); }
              50%      { opacity: 1; transform: scale(1.6); }
            }
            .m4m-pl-bokeh {
              position: absolute;
              border-radius: 50%;
              filter: blur(8px);
              animation: m4mPlBokehDrift ease-in-out infinite;
              will-change: transform, opacity;
            }
            @keyframes m4mPlBokehDrift {
              0%, 100% { transform: translate3d(0, 0, 0) scale(1);    opacity: 0.55; }
              50%      { transform: translate3d(20px, -28px, 0) scale(1.18); opacity: 0.85; }
            }
            .m4m-pl-progress::after {
              content: "";
              position: absolute;
              inset: 0;
              background: linear-gradient(
                90deg,
                transparent 0%,
                rgba(255,255,255,0.55) 50%,
                transparent 100%
              );
              transform: translateX(-100%);
              animation: m4mPlProgressShimmer 1.6s linear infinite;
            }
            @keyframes m4mPlProgressShimmer {
              from { transform: translateX(-100%); }
              to   { transform: translateX(100%); }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
