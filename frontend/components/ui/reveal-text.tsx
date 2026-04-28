"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Editorial scroll-reveal text. Splits the children into characters or words
 * and reveals them with a subtle blur-to-sharp + lift-up stagger when the
 * element enters the viewport.
 *
 * Use sparingly — section headings, hero headlines, key callouts. Don't put
 * an entire paragraph through this; the staggered animation gets tedious.
 *
 * Respects prefers-reduced-motion (renders the static end state).
 */

const EASE = [0.22, 1, 0.36, 1] as const;

export function RevealText({
  children,
  as = "h2",
  split = "word",
  delay = 0,
  stagger,
  className,
  once = true,
  amount = 0.4,
}: {
  children: string;
  /** Element tag (h1 / h2 / span / etc.) */
  as?: keyof JSX.IntrinsicElements;
  /** Split unit. "word" feels editorial; "char" feels precious. */
  split?: "word" | "char" | "line";
  /** Delay (s) before the stagger starts. */
  delay?: number;
  /** Per-token stagger override. Sensible defaults applied if omitted. */
  stagger?: number;
  className?: string;
  once?: boolean;
  /** % of element in view to trigger (0–1). */
  amount?: number;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref, { once, amount });
  const reduced = useReducedMotion();

  const tokens =
    split === "char" ? children.split("")
    : split === "line" ? children.split("\n")
    : children.split(/(\s+)/);

  const defaultStagger = split === "char" ? 0.014 : split === "word" ? 0.05 : 0.12;
  const wrap: Variants = {
    hidden: {},
    show:   { transition: { delayChildren: delay, staggerChildren: stagger ?? defaultStagger } },
  };

  const tokenV: Variants = {
    hidden: { y: split === "line" ? 24 : 14, opacity: 0, filter: "blur(6px)" },
    show:   { y: 0,                              opacity: 1, filter: "blur(0px)",
              transition: { duration: split === "line" ? 0.7 : 0.55, ease: EASE } },
  };

  if (reduced) {
    const Tag = as as any;
    return <Tag ref={ref as any} className={className}>{children}</Tag>;
  }

  const Tag = motion[as as keyof typeof motion] as any;

  return (
    <Tag
      ref={ref}
      className={cn(className)}
      variants={wrap}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
      style={{ display: "inline-block" }}
    >
      {tokens.map((tok, i) => {
        if (tok === "" || /^\s+$/.test(tok)) {
          // Preserve whitespace tokens — don't animate them, but render so spacing stays right.
          return <span key={i} style={{ whiteSpace: "pre" }}>{tok}</span>;
        }
        return (
          <motion.span
            key={i}
            variants={tokenV}
            style={{ display: "inline-block", whiteSpace: split === "line" ? "normal" : "pre" }}
          >
            {tok}
          </motion.span>
        );
      })}
    </Tag>
  );
}

export default RevealText;
