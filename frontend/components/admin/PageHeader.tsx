import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  /** Optional inline element beside the title (count pill, status). */
  meta?: React.ReactNode;
  /** Optional row below the header (tabs, filters). */
  toolbar?: React.ReactNode;
}

/**
 * The page-level header used on admin pages. Same typography as PageShell's
 * header so pages built either way look identical.
 */
export function PageHeader({ title, description, actions, className, meta, toolbar }: PageHeaderProps) {
  return (
    <div className={cn("mb-5", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[28px]">
              {title}
            </h1>
            {meta}
          </div>
          {description && (
            <p className="mt-1 max-w-2xl text-[13px] text-muted2-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {toolbar && <div className="mt-4">{toolbar}</div>}
    </div>
  );
}
