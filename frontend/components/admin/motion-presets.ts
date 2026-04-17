// Shared framer-motion presets so animation timing stays consistent everywhere.

import type { Variants, Transition } from "framer-motion";

export const SPRING_SOFT: Transition = { type: "spring", stiffness: 260, damping: 24 };
export const SPRING_SNAP: Transition = { type: "spring", stiffness: 420, damping: 28 };
export const EASE_OUT: Transition = { duration: 0.35, ease: [0.22, 1, 0.36, 1] };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 14 },
  show:   { opacity: 1, y: 0, transition: EASE_OUT },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show:   { opacity: 1, transition: { duration: 0.3 } },
};

export const stagger = (delayChildren = 0, stagger = 0.06): Variants => ({
  hidden: {},
  show: { transition: { delayChildren, staggerChildren: stagger } },
});

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show:   { opacity: 1, scale: 1, transition: SPRING_SOFT },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 40 },
  show:   { opacity: 1, x: 0, transition: SPRING_SOFT },
  exit:   { opacity: 0, x: 40, transition: { duration: 0.18 } },
};
