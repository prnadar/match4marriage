import type { ElementType, HTMLAttributes, ReactNode } from "react";
import { cx, type Ground } from "./cx";

/**
 * Kicker: the gold small-caps label. It names a page or a group ("Membership
 * verification", "Your plan"); it is never a sentence and never interactive.
 *
 * Use one per page header and one per labelled group. A kicker above every
 * section stops meaning anything.
 */
export interface KickerProps extends HTMLAttributes<HTMLElement> {
  /** Rendered element. Default `p`; use `span` inline, `h2`/`h3` when it is the group's heading. */
  as?: ElementType;
  /** `sm` = 10px (shell, cards, dense UI). `md` = 11.5px (page header). */
  size?: "sm" | "md";
  ground?: Ground;
  children: ReactNode;
}

export function Kicker({ as: Tag = "p", size = "md", ground = "dark", className, children, ...rest }: KickerProps) {
  return (
    <Tag
      className={cx(
        "m-0 font-nav uppercase",
        size === "sm" ? "text-m4m-kicker-sm" : "text-m4m-kicker",
        ground === "dark" ? "text-m4m-gold-label" : "text-m4m-gold-deep",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default Kicker;
