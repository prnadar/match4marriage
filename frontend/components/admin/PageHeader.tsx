import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The page-level header used on every admin page. Tight type scale, optional
 * single-line description, optional action cluster on the right. Sticky-able
 * if needed (just wrap the surrounding container with sticky positioning).
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6", className)}>
      <div className="min-w-0">
        <h1 className="font-display text-[26px] sm:text-[28px] leading-tight tracking-tight font-semibold text-foreground">
          {title}
        </h1>
        {description && (
          <p className="mt-1 text-[13px] text-muted2-foreground max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
