import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // Base — luxe defaults: tighter type scale, hairline ring on focus.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-[background,color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary — rose gradient, the brand action.
        default: "bg-gradient-to-br from-rose to-rose-700 text-white shadow-[0_4px_14px_rgba(220,30,60,0.25)] hover:shadow-[0_6px_20px_rgba(220,30,60,0.35)] hover:brightness-105 active:scale-[0.98]",
        // Secondary — quiet on cream, used for "Cancel", "Filter", etc.
        secondary: "bg-white text-foreground border border-border shadow-sm hover:bg-secondary hover:border-border/80 active:scale-[0.99]",
        // Outline — even quieter, near-ghost with a hairline.
        outline: "border border-border bg-transparent text-foreground hover:bg-secondary",
        // Ghost — no chrome at rest, hover only.
        ghost: "text-foreground hover:bg-secondary",
        // Destructive — for delete / suspend.
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:brightness-110 active:scale-[0.99]",
        // Accent — gold, reserved for celebratory or premium moments.
        accent: "bg-gradient-to-br from-gold-300 to-gold text-white shadow-[0_4px_14px_rgba(201,149,74,0.30)] hover:brightness-105 active:scale-[0.98]",
        // Link — inline text action.
        link: "text-primary underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        xs:        "h-7 px-2.5 text-xs rounded [&_svg]:size-3.5",
        sm:        "h-8 px-3 text-xs rounded-md [&_svg]:size-3.5",
        default:   "h-9 px-4 [&_svg]:size-4",
        lg:        "h-10 px-6 [&_svg]:size-4",
        icon:      "h-9 w-9 [&_svg]:size-4",
        "icon-sm": "h-8 w-8 [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
