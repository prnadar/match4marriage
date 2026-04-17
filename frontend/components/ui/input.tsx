import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      ref={ref}
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm text-foreground shadow-sm",
        "placeholder:text-muted2-foreground/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:border-primary",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-[border-color,box-shadow]",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export { Input };
