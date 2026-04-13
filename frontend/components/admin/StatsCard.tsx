"use client";

import type { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  sparkline?: number[];
  color?: "rose" | "gold" | "sage" | "blue";
}

const colorMap = {
  rose: { bg: "bg-rose-50", icon: "text-rose", spark: "#E8426A" },
  gold: { bg: "bg-gold-50", icon: "text-gold", spark: "#C9954A" },
  sage: { bg: "bg-emerald-50", icon: "text-sage", spark: "#7A9E7E" },
  blue: { bg: "bg-blue-50", icon: "text-blue-500", spark: "#3B82F6" },
};

export default function StatsCard({ title, value, icon: Icon, trend, sparkline, color = "rose" }: StatsCardProps) {
  const c = colorMap[color];
  const sparkData = sparkline || [4, 7, 5, 9, 6, 8, 10, 7, 12, 9, 11, 14];

  // Build SVG sparkline
  const max = Math.max(...sparkData);
  const min = Math.min(...sparkData);
  const range = max - min || 1;
  const w = 80;
  const h = 28;
  const points = sparkData
    .map((v, i) => {
      const x = (i / (sparkData.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="glass-card p-5 hover:shadow-card-hover transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="font-body text-xs font-medium text-muted uppercase tracking-wider">{title}</p>
          <p className="font-display text-2xl font-bold text-deep mt-1">{value}</p>
          {trend !== undefined && (
            <p className={`font-body text-xs mt-1 ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs last month
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
            <Icon className={`w-5 h-5 ${c.icon}`} />
          </div>
          <svg width={w} height={h} className="opacity-60">
            <polyline
              fill="none"
              stroke={c.spark}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
