// Shared framer-motion presets so animation timing stays consistent everywhere.
// Console motion is deliberately quiet: short, ease-out, small offsets — it
// conveys "this just arrived", never choreography. Users are mid-task.

import type { Variants, Transition } from "framer-motion";

export const SPRING_SOFT: Transition = { type: "spring", stiffness: 320, damping: 30 };
export const SPRING_SNAP: Transition = { type: "spring", stiffness: 480, damping: 34 };
export const EASE_OUT: Transition = { duration: 0.22, ease: [0.22, 1, 0.36, 1] };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 6 },
  show:   { opacity: 1, y: 0, transition: EASE_OUT },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.2 } },
};

export const stagger = (delayChildren = 0, stagger = 0.03): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren: Math.min(stagger, 0.04) } },
});

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.985 },
  show:   { opacity: 1, scale: 1, transition: EASE_OUT },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 16 },
  show:   { opacity: 1, x: 0, transition: SPRING_SOFT },
  exit:   { opacity: 0, x: 16, transition: { duration: 0.15 } },
};
