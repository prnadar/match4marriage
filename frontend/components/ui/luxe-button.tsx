"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Premium button with editorial details:
 *   - Gradient base with cinematic gold sheen sweep on hover
 *   - 3D press: subtle scale-down + inner shadow on active
 *   - Crisp focus ring tinted to brand
 *   - Optional loading state (auto-disables, swaps icon)
 *   - Variants: primary (rose), gold (premium accent), ghost, outline, dark
 *
 * Replaces the inline-styled `linear-gradient(135deg,#dc1e3c,#a0153c)` buttons
 * scattered across the app.
 *
 * Usage with Link (asChild):
 *   <LuxeButton asChild><Link href="...">Label</Link></LuxeButton>
 * The single-child constraint of Radix `Slot` means we don't inject the sheen
 * span when asChild is true — see code below.
 */

const luxeButton = cva(
  [
    "relative inline-flex items-center justify-center overflow-hidden",
    "whitespace-nowrap rounded-full font-semibold tracking-[0.01em]",
    "transition-[transform,box-shadow,background] duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
    "active:scale-[0.985]",
  ],
  {
    variants: {
      variant: {
        primary: [
          "text-white",
          "bg-gradient-to-br from-[#dc1e3c] to-[#7d0a35]",
          "shadow-[0_8px_22px_rgba(220,30,60,0.32),inset_0_1px_0_rgba(255,255,255,0.18)]",
          "hover:shadow-[0_14px_32px_rgba(220,30,60,0.42),inset_0_1px_0_rgba(255,255,255,0.22)]",
        ],
        gold: [
          "text-[#1a0a14]",
          "bg-gradient-to-br from-[#F2D89E] via-[#C9954A] to-[#9A6B00]",
          "shadow-[0_8px_22px_rgba(201,149,74,0.32),inset_0_1px_0_rgba(255,255,255,0.35)]",
          "hover:shadow-[0_14px_32px_rgba(201,149,74,0.42),inset_0_1px_0_rgba(255,255,255,0.45)]",
        ],
        outline: [
          "border border-rose-200/70 bg-white text-[#1a0a14]",
          "shadow-[0_2px_10px_rgba(220,30,60,0.06)]",
          "hover:border-rose-300/80 hover:bg-rose-50/40 hover:shadow-[0_6px_18px_rgba(220,30,60,0.10)]",
        ],
        ghost: [
          "bg-transparent text-rose-700",
          "hover:bg-rose-50/70",
        ],
        dark: [
          "text-white",
          "bg-gradient-to-br from-[#1a0a14] to-[#2d0f20]",
          "shadow-[0_8px_22px_rgba(26,10,20,0.28),inset_0_1px_0_rgba(255,255,255,0.10)]",
          "hover:shadow-[0_14px_32px_rgba(26,10,20,0.34),inset_0_1px_0_rgba(255,255,255,0.14)]",
        ],
      },
      size: {
        sm: "h-9  px-4 text-[12.5px] gap-1.5 [&_svg]:size-3.5",
        md: "h-11 px-5 text-[13.5px] gap-1.5 [&_svg]:size-4",
        lg: "h-12 px-6 text-[14.5px] gap-2   [&_svg]:size-4",
        xl: "h-14 px-8 text-[15.5px] gap-2   [&_svg]:size-[18px]",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface LuxeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof luxeButton> {
  asChild?: boolean;
  loading?: boolean;
}

export const LuxeButton = React.forwardRef<HTMLButtonElement, LuxeButtonProps>(
  ({ className, variant = "primary", size, asChild, loading, disabled, children, ...props }, ref) => {
    const finalDisabled = disabled || loading;
    const classes = cn(luxeButton({ variant, size }), className);

    // asChild path: Radix Slot only accepts a single child element. Pass through
    // unwrapped — Link/anchor still picks up all styles + the CSS sheen rule
    // (see globals.css `a:hover > .luxe-sheen`) won't fire because we don't
    // emit the .luxe-sheen sibling here. The Link still gets the gradient
    // shadow lift on hover, which is the dominant visual cue.
    if (asChild) {
      return (
        <Slot ref={ref as any} className={classes} {...(props as any)}>
          {children as React.ReactElement}
        </Slot>
      );
    }

    return (
      <button
        ref={ref}
        className={classes}
        disabled={finalDisabled}
        {...props}
      >
        {/* Cinematic sheen sweep — only on real <button> roots */}
        {(variant === "primary" || variant === "gold" || variant === "dark") && (
          <span
            aria-hidden
            className="luxe-sheen pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, transparent 28%, rgba(255,255,255,0.45) 50%, transparent 72%)",
              transform: "translateX(-120%)",
              transition: "transform 0.9s cubic-bezier(.2,.7,.2,1)",
              mixBlendMode: "overlay",
            }}
          />
        )}
        <span className="relative z-[1] inline-flex items-center gap-[inherit]">
          {loading ? <Loader2 className="animate-spin" /> : null}
          {children}
        </span>
      </button>
    );
  },
);
LuxeButton.displayName = "LuxeButton";

export default LuxeButton;
