"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { ArrowRight } from "lucide-react";
import { cx, focusRing, type Ground } from "./cx";

/**
 * The two buttons of the system.
 *
 * PrimaryButton — the rose action. ONE per view: the thing the member came to
 * do (complete the profile, send the interest, confirm). If a second rose
 * button seems necessary, one of the two is a QuietButton.
 *
 * QuietButton — everything else: secondary actions, "not now", navigation.
 * A hairline outline that warms to gold on hover.
 *
 * Both are pills with a 44px minimum hit area, the system focus ring, and a
 * hover that changes colour only (no lift, no glow, no sheen), so it is safe
 * under prefers-reduced-motion without a special case.
 *
 * As a link:  <PrimaryButton asChild><Link href="/profile/me">Complete your profile<ButtonArrow /></Link></PrimaryButton>
 */
type Size = "sm" | "md" | "lg";

interface BaseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Render the single child element (e.g. a Next `Link`) with the button's styling. */
  asChild?: boolean;
  /** sm 13px (cards, sheets) · md 14px (default) · lg 16px (page-level action on desktop). */
  size?: Size;
  /** The ground the button sits on; selects the focus-ring colour. */
  ground?: Ground;
}

const BASE =
  "group inline-flex min-h-m4m-tap select-none items-center justify-center gap-2 whitespace-nowrap rounded-m4m-pill font-nav font-semibold leading-[1.4] no-underline disabled:cursor-not-allowed disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:opacity-45";

const SIZE: Record<Size, string> = {
  sm: "px-5 py-2.5 text-m4m-small",
  md: "px-7 py-3.5 text-m4m-ui",
  lg: "px-9 py-4 text-m4m-body",
};

function render(
  { asChild, className, type, ...rest }: Omit<BaseProps, "size" | "ground">,
  ref: React.ForwardedRef<HTMLButtonElement>,
  classes: string,
) {
  if (asChild) {
    return <Slot ref={ref as React.Ref<HTMLElement>} className={cx(classes, className)} {...rest} />;
  }
  return <button ref={ref} type={type ?? "button"} className={cx(classes, className)} {...rest} />;
}

export type PrimaryButtonProps = BaseProps;

export const PrimaryButton = React.forwardRef<HTMLButtonElement, PrimaryButtonProps>(
  ({ size = "md", ground = "dark", ...rest }, ref) =>
    render(
      rest,
      ref,
      cx(
        BASE,
        SIZE[size],
        "border-0 bg-m4m-rose bg-m4m-rose-fill text-white shadow-m4m-raised",
        "transition-[filter,opacity] duration-m4m-base hover:brightness-110 disabled:hover:brightness-100 aria-disabled:hover:brightness-100",
        focusRing[ground],
      ),
    ),
);
PrimaryButton.displayName = "PrimaryButton";

export type QuietButtonProps = BaseProps;

export const QuietButton = React.forwardRef<HTMLButtonElement, QuietButtonProps>(
  ({ size = "md", ground = "dark", ...rest }, ref) =>
    render(
      rest,
      ref,
      cx(
        BASE,
        SIZE[size],
        "border bg-transparent transition-colors duration-m4m-base",
        ground === "dark"
          ? "border-m4m-hairline-control text-m4m-fg-soft hover:border-m4m-hairline-gold-strong hover:text-m4m-fg"
          : "border-m4m-hairline-light text-m4m-ink-text hover:border-m4m-hairline-gold-strong",
        focusRing[ground],
      ),
    ),
);
QuietButton.displayName = "QuietButton";

/**
 * Trailing arrow for a button that navigates. Nudges 2px on hover of the
 * parent button; stays still under prefers-reduced-motion.
 */
export function ButtonArrow({ className }: { className?: string }) {
  return (
    <ArrowRight
      aria-hidden
      className={cx(
        "h-4 w-4 flex-shrink-0 transition-transform duration-m4m-base ease-m4m-out group-hover:translate-x-0.5 motion-reduce:transform-none motion-reduce:transition-none",
        className,
      )}
    />
  );
}
