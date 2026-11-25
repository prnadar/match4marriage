"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Delta } from "./primitives";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** % change; rendered with direction + sign, never colour alone. */
  trend?: number;
  /** Optional trend series. Nothing is drawn when omitted (no fake data). */
  sparkline?: number[];
  color?: "rose" | "gold" | "sage" | "blue";
  // ── Optional additions ──
  /** Label after the trend, e.g. "vs last month" (default). */
  trendLabel?: string;
  /** Whether a rising trend is good (default) or bad (e.g. churn). */
  goodWhen?: "up" | "down";
  hint?: React.ReactNode;
  href?: string;
}

const colorMap = {
  rose: { chip: "bg-primary/10 text-primary border-primary/15", spark: "#DC1E3C" },
  gold: { chip: "bg-[#FBF0DA] text-[#7A5200] border-[#EEDBB0]", spark: "#B07D35" },
  sage: { chip: "bg-[#EAF2EB] text-[#2F5A3A] border-[#CFE0D3]", spark: "#5C7A52" },
  blue: { chip: "bg-[#EBF0FB] text-[#26437F] border-[#D0DBF3]", spark: "#2A78D6" },
};

export default function StatsCard({
  title, value, icon: Icon, trend, sparkline, color = "rose",
  trendLabel = "vs last month", goodWhen = "up", hint, href,
}: StatsCardProps) {
  const c = colorMap[color];

  let spark: React.ReactNode = null;
  if (sparkline && sparkline.length > 1) {
    const max = Math.max(...sparkline);
    const min = Math.min(...sparkline);
    const range = max - min || 1;
    const w = 80;
    const h = 28;
    const points = sparkline
      .map((v, i) => `${(i / (sparkline.length - 1)) * w},${h - 2 - ((v - min) / range) * (h - 4)}`)
      .join(" ");
    spark = (
      <svg width={w} height={h} aria-hidden className="overflow-visible">
        <polyline fill="none" stroke={c.spark} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
      </svg>
    );
  }

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-medium text-muted2-foreground">{title}</p>
        <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground">
          {typeof value === "number" ? value.toLocaleString("en-GB") : value}
        </p>
        {(trend !== undefined || hint) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-muted2-foreground">
            {trend !== undefined && <Delta value={trend} goodWhen={goodWhen} suffix={trendLabel} />}
            {hint && <span>{hint}</span>}
          </div>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className={`grid h-8 w-8 place-items-center rounded-md border ${c.chip}`}>
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        {spark}
      </div>
    </div>
  );

  const cls = "block rounded-xl border border-border/70 bg-card p-4 shadow-[0_1px_2px_rgba(26,10,20,0.04)] transition-shadow duration-150";
  return href
    ? <Link href={href} className={`${cls} hover:shadow-[0_2px_10px_rgba(26,10,20,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40`}>{body}</Link>
    : <div className={cls}>{body}</div>;
}
