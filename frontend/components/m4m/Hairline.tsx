import type { HTMLAttributes } from "react";
import { cx, type Ground } from "./cx";

/**
 * Hairline: a 1px rule. The system separates with lines and space, not with
 * shadows, tinted panels or glow.
 *
 *   default  structural divider
 *   strong   an edge that must read at a glance (rails, input groups)
 *   gold     an editorial / membership rule: above a list of benefits, a tier
 *
 * Decorative by default (hidden from assistive tech). Pass `decorative={false}`
 * when it separates two groups a screen-reader user should hear as separate.
 */
export interface HairlineProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical";
  tone?: "default" | "strong" | "gold";
  ground?: Ground;
  decorative?: boolean;
}

export function Hairline({
  orientation = "horizontal",
  tone = "default",
  ground = "dark",
  decorative = true,
  className,
  ...rest
}: HairlineProps) {
  const colour =
    tone === "gold"
      ? "bg-m4m-hairline-gold"
      : ground === "light"
      ? "bg-m4m-hairline-light"
      : tone === "strong"
      ? "bg-m4m-hairline-strong"
      : "bg-m4m-hairline";
  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "separator", "aria-orientation": orientation } as const);
  return (
    <div
      {...a11y}
      className={cx(
        "flex-shrink-0",
        orientation === "horizontal" ? "h-px w-full" : "w-px self-stretch",
        colour,
        className,
      )}
      {...rest}
    />
  );
}

export default Hairline;
