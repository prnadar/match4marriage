import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cx, type Ground } from "./cx";

/**
 * Surface: the hairline card. A 4% white wash and a 1px edge on the aubergine
 * ground; paper and a 1px ink edge on ivory. No shadow, no blur, no gradient.
 *
 *   card   default container for a module
 *   quiet  a module inside a rail or beside louder content
 *   gold   membership content only: the plan, the tier, a benefit
 *   sheet  opaque; for content that floats over the page (add `shadow-m4m-float`
 *          or `shadow-m4m-sheet` at the call site, since only floating things
 *          cast a shadow)
 *
 * Never nest a Surface inside a Surface: separate inner groups with a Hairline.
 * If the content reads fine without a container, do not add one.
 */
export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  tone?: "card" | "quiet" | "gold" | "sheet";
  /** none · sm 14px · md 20px · lg 24px */
  padding?: "none" | "sm" | "md" | "lg";
  ground?: Ground;
  children?: ReactNode;
}

const PADDING = { none: "", sm: "p-3.5", md: "p-5", lg: "p-6" } as const;

const DARK = {
  card: "border-m4m-hairline bg-m4m-surface-card",
  quiet: "border-m4m-hairline bg-m4m-surface-quiet",
  gold: "border-m4m-hairline-gold bg-m4m-surface-quiet",
  sheet: "border-m4m-hairline-strong bg-m4m-surface-sheet",
} as const;

const LIGHT = {
  card: "border-m4m-hairline-light bg-m4m-paper",
  quiet: "border-m4m-hairline-light bg-transparent",
  gold: "border-m4m-hairline-gold bg-m4m-paper",
  sheet: "border-m4m-hairline-light bg-m4m-paper",
} as const;

export function Surface({
  as: Tag = "div",
  tone = "card",
  padding = "md",
  ground = "dark",
  className,
  children,
  ...rest
}: SurfaceProps) {
  return (
    <Tag
      className={cx(
        "rounded-m4m-md border",
        ground === "dark" ? DARK[tone] : LIGHT[tone],
        ground === "dark" ? "text-m4m-fg-body" : "text-m4m-ink-text",
        PADDING[padding],
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Surface;
