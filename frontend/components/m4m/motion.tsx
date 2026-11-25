"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion, type HTMLMotionProps, type Transition, type Variants } from "framer-motion";

/**
 * Shared motion for member and public pages. Mirrors the --m4m-ease-out /
 * --m4m-dur-* tokens in globals.css (Framer Motion needs numbers, not CSS vars).
 *
 * Rules these presets encode:
 *   - one curve, ease-out, no bounce or overshoot
 *   - transform and opacity only
 *   - an entrance plays once, when the page arrives; content is never hidden
 *     waiting for a scroll trigger
 *   - with prefers-reduced-motion everything is simply present
 */
export const M4M_EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

/** Seconds. Same steps as --m4m-dur-*. */
export const M4M_DURATION = {
  press: 0.12,
  fast: 0.18,
  base: 0.2,
  slow: 0.32,
  entrance: 0.5,
} as const;

/** Seconds between entrance items (--m4m-stagger). */
export const M4M_STAGGER = 0.08;

/** A tween on the system curve. `m4mTween("slow")` or `m4mTween(0.28, 0.1)`. */
export function m4mTween(duration: keyof typeof M4M_DURATION | number = "base", delay = 0): Transition {
  return {
    type: "tween",
    duration: typeof duration === "number" ? duration : M4M_DURATION[duration],
    delay,
    ease: M4M_EASE_OUT,
  };
}

/** Parent of a staggered entrance. */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: M4M_STAGGER, delayChildren: 0.04 } },
};

/** Tighter stagger for dense lists and navigation groups (the sidebar). */
export const staggerContainerTight: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.05 } },
};

/** Page content arriving: 12px rise + fade. */
export const riseItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: m4mTween("entrance") },
};

/** Fade only: for text that must not shift, and for anything inside a list row. */
export const fadeItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: m4mTween("base") },
};

/** Rail / drawer content arriving from the leading edge. */
export const slideItem: Variants = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: m4mTween("slow") },
};

/**
 * Motion props for hand-built components, already resolved against the
 * member's reduced-motion preference.
 *
 *   const m = useM4MMotion();
 *   <motion.ul {...m.container}> <motion.li variants={m.item} /> </motion.ul>
 *   <motion.span whileTap={m.press} transition={m.tween("press")} />
 */
export function useM4MMotion() {
  const reduce = !!useReducedMotion();
  return {
    reduce,
    /** Spread on the staggering parent. */
    container: {
      variants: staggerContainer,
      initial: reduce ? (false as const) : "hidden",
      animate: "show",
    },
    item: riseItem,
    fade: fadeItem,
    slide: slideItem,
    /** `whileTap` value for rows and buttons: a 2% press, or nothing. */
    press: reduce ? undefined : { scale: 0.98 },
    /** Tween on the system curve; instant when motion is reduced. */
    tween: (duration: keyof typeof M4M_DURATION | number = "base", delay = 0): Transition =>
      reduce ? { duration: 0 } : m4mTween(duration, delay),
  };
}

/**
 * Entrance: wraps a page (or one region of it) whose direct `EntranceItem`
 * children arrive in a short stagger, once. Use one per page.
 */
export function Entrance({
  children,
  tight = false,
  ...rest
}: Omit<HTMLMotionProps<"div">, "variants" | "initial" | "animate"> & { children: ReactNode; tight?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      variants={tight ? staggerContainerTight : staggerContainer}
      initial={reduce ? false : "hidden"}
      animate="show"
      {...rest}
    >
      {children}
    </motion.div>
  );
}

/** One item of an `Entrance`. `effect="fade"` for content that must not move. */
export function EntranceItem({
  children,
  effect = "rise",
  ...rest
}: Omit<HTMLMotionProps<"div">, "variants"> & { children: ReactNode; effect?: "rise" | "fade" | "slide" }) {
  return (
    <motion.div variants={effect === "fade" ? fadeItem : effect === "slide" ? slideItem : riseItem} {...rest}>
      {children}
    </motion.div>
  );
}
