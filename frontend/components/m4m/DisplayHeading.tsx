import type { HTMLAttributes, ReactNode } from "react";
import { cx, type Ground } from "./cx";

/**
 * DisplayHeading: Playfair Display, semibold, mixed case, balanced.
 *
 *   hero     32 → 42 → 58px   one statement per page (the gate's welcome)
 *   page     32 → 42px        the title of a member page
 *   section  20 → 24px        a section inside a page
 *   title    18px             a card, row or dialog title
 *
 * `as` sets the semantic level and is independent of `size`: pick the level
 * from the document outline, the size from the hierarchy on screen.
 * No gradient text, no all-caps, no weight above 600.
 */
type HeadingTag = "h1" | "h2" | "h3" | "h4" | "p";

export interface DisplayHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingTag;
  size?: "hero" | "page" | "section" | "title";
  ground?: Ground;
  children: ReactNode;
}

const SIZE: Record<NonNullable<DisplayHeadingProps["size"]>, string> = {
  hero: "text-m4m-page sm:text-m4m-page-lg lg:text-m4m-hero",
  page: "text-m4m-page lg:text-m4m-page-lg",
  section: "text-m4m-section lg:text-m4m-section-lg",
  title: "text-m4m-title",
};

export function DisplayHeading({
  as: Tag = "h2",
  size = "section",
  ground = "dark",
  className,
  children,
  ...rest
}: DisplayHeadingProps) {
  return (
    <Tag
      className={cx(
        "m-0 font-display font-semibold [overflow-wrap:anywhere] [text-wrap:balance]",
        SIZE[size],
        ground === "dark" ? "text-m4m-fg" : "text-m4m-ink-text",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

export default DisplayHeading;
