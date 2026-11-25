"use client";

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/**
 * Sticky in-page section bar (e.g. above a long form). The console layout
 * already provides the global top bar with search, notifications and the
 * signed-in admin, so this carries only a title and the page's own actions.
 */
export default function TopBar({ title, subtitle, actions }: TopBarProps) {
  return (
    <div className="sticky top-14 z-20 -mx-4 mb-4 flex items-center justify-between gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:-mx-8 lg:px-8">
      <div className="min-w-0">
        <h2 className="truncate font-display text-[18px] font-semibold leading-tight text-foreground">{title}</h2>
        {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-muted2-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
