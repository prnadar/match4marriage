"use client";

import { useMemo } from "react";
import { TrendingUp, BarChart3, Users, DollarSign } from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import { mockAnalytics, mockReligionDistribution } from "@/lib/admin-mock-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

const COLORS = {
  rose: "#E8426A",
  gold: "#C9954A",
  sage: "#7A9E7E",
  blue: "#3B82F6",
  blush: "#FF8FA3",
  amber: "#FFD166",
  plum: "#8A7080",
  pink: "#FFBDCA",
};

// ── Registration Trends (Line Chart) ─────────────────────────────────────────

function RegistrationTrendsChart() {
  const data = useMemo(() => mockAnalytics.registrationTrend.slice(-30), []);
  const maxVal = Math.max(...data.map((d) => d.count));
  const minVal = Math.min(...data.map((d) => d.count));
  const range = maxVal - minVal || 1;
  const w = 700;
  const h = 260;
  const padL = 45;
  const padR = 15;
  const padT = 20;
  const padB = 50;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const points = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - ((d.count - minVal) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

  // Y-axis ticks (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minVal + (range / 4) * i;
    const y = padT + chartH - (i / 4) * chartH;
    return { val: Math.round(val), y };
  });

  // X-axis labels (every 5th)
  const xLabels = points.filter((_, i) => i % 5 === 0);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yTicks.map((t) => (
        <line key={t.val} x1={padL} y1={t.y} x2={w - padR} y2={t.y} stroke="rgba(201,149,74,0.1)" strokeDasharray="4 4" />
      ))}
      {/* Y labels */}
      {yTicks.map((t) => (
        <text key={`yl-${t.val}`} x={padL - 8} y={t.y + 4} textAnchor="end" className="fill-current text-[10px]" style={{ fill: "#8A7080" }}>
          {t.val}
        </text>
      ))}
      {/* X labels */}
      {xLabels.map((p) => (
        <text key={p.date} x={p.x} y={h - 15} textAnchor="middle" className="fill-current text-[9px]" style={{ fill: "#8A7080" }}>
          {p.date.slice(5)}
        </text>
      ))}
      {/* Area */}
      <path d={areaPath} fill="url(#regGrad)" opacity={0.3} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={COLORS.rose} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.filter((_, i) => i % 3 === 0).map((p) => (
        <circle key={p.date} cx={p.x} cy={p.y} r={3} fill="white" stroke={COLORS.rose} strokeWidth={2} />
      ))}
      <defs>
        <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.rose} stopOpacity={0.4} />
          <stop offset="100%" stopColor={COLORS.rose} stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Match Success Rate (Bar Chart) ───────────────────────────────────────────

function MatchSuccessChart() {
  const data = mockAnalytics.matchSuccessRate;
  const maxVal = Math.max(...data.map((d) => d.rate));
  const w = 700;
  const h = 260;
  const padL = 45;
  const padR = 15;
  const padT = 20;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const barW = chartW / data.length * 0.6;
  const gap = chartW / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barH = (d.rate / (maxVal * 1.2)) * chartH;
        const x = padL + i * gap + (gap - barW) / 2;
        const y = padT + chartH - barH;
        return (
          <g key={d.month}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill={COLORS.gold} opacity={0.85} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" style={{ fill: "#C9954A", fontSize: "10px", fontWeight: 600 }}>
              {d.rate}%
            </text>
            <text x={x + barW / 2} y={h - 15} textAnchor="middle" style={{ fill: "#8A7080", fontSize: "10px" }}>
              {d.month}
            </text>
          </g>
        );
      })}
      {/* Y-axis */}
      {[0, 10, 20, 30, 40].map((v) => {
        const y = padT + chartH - (v / (maxVal * 1.2)) * chartH;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(201,149,74,0.08)" />
            <text x={padL - 8} y={y + 4} textAnchor="end" style={{ fill: "#8A7080", fontSize: "10px" }}>{v}%</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Premium Conversion Funnel (Horizontal Bar) ──────────────────────────────

function ConversionFunnelChart() {
  const data = mockAnalytics.conversionFunnel;
  const maxVal = data[0].count;
  const w = 700;
  const h = 240;
  const padL = 120;
  const padR = 60;
  const padT = 10;
  const barH = 28;
  const gap = (h - padT) / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barW = ((w - padL - padR) * d.count) / maxVal;
        const y = padT + i * gap;
        const colorIdx = i % 6;
        const fills = [COLORS.rose, COLORS.gold, COLORS.sage, COLORS.blue, COLORS.blush, COLORS.amber];
        return (
          <g key={d.stage}>
            <text x={padL - 8} y={y + barH / 2 + 4} textAnchor="end" style={{ fill: "#3D1F2E", fontSize: "11px", fontWeight: 500 }}>
              {d.stage}
            </text>
            <rect x={padL} y={y} width={barW} height={barH} rx={6} fill={fills[colorIdx]} opacity={0.8} />
            <text x={padL + barW + 8} y={y + barH / 2 + 4} textAnchor="start" style={{ fill: "#8A7080", fontSize: "11px", fontWeight: 600 }}>
              {d.count.toLocaleString("en-IN")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Top Cities (Horizontal Bar) ──────────────────────────────────────────────

function TopCitiesChart() {
  const data = mockAnalytics.topCities;
  const maxVal = data[0].users;
  const w = 700;
  const h = 340;
  const padL = 100;
  const padR = 60;
  const padT = 10;
  const barH = 24;
  const gap = (h - padT) / data.length;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {data.map((d, i) => {
        const barW = ((w - padL - padR) * d.users) / maxVal;
        const y = padT + i * gap;
        return (
          <g key={d.city}>
            <text x={padL - 8} y={y + barH / 2 + 4} textAnchor="end" style={{ fill: "#3D1F2E", fontSize: "11px", fontWeight: 500 }}>
              {d.city}
            </text>
            <rect x={padL} y={y} width={barW} height={barH} rx={5} fill={COLORS.sage} opacity={0.75} />
            <text x={padL + barW + 8} y={y + barH / 2 + 4} textAnchor="start" style={{ fill: "#8A7080", fontSize: "11px", fontWeight: 600 }}>
              {d.users.toLocaleString("en-IN")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Religion Distribution (Donut Chart) ──────────────────────────────────────

function ReligionDonutChart() {
  const data = mockReligionDistribution;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = 150;
  const cy = 150;
  const r = 110;
  const strokeW = 35;
  const circumference = 2 * Math.PI * r;

  let accumulated = 0;
  const segments = data.map((d) => {
    const dashLen = (d.value / total) * circumference;
    const offset = circumference - (accumulated / total) * circumference;
    accumulated += d.value;
    return { ...d, dashLen, offset };
  });

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <svg viewBox="0 0 300 300" className="w-48 h-48 flex-shrink-0">
        {segments.map((s) => (
          <circle
            key={s.name}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={strokeW}
            strokeDasharray={`${s.dashLen} ${circumference - s.dashLen}`}
            strokeDashoffset={s.offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" style={{ fill: "#3D1F2E", fontSize: "24px", fontWeight: 700 }}>
          {total}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" style={{ fill: "#8A7080", fontSize: "11px" }}>
          Total
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
            <span className="font-body text-xs text-deep">{d.name}</span>
            <span className="font-body text-xs text-muted ml-auto">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Age Distribution (Vertical Bar) ──────────────────────────────────────────

function AgeDistributionChart() {
  const data = mockAnalytics.ageDistribution;
  const maxVal = Math.max(...data.map((d) => d.count));
  const w = 700;
  const h = 260;
  const padL = 50;
  const padR = 15;
  const padT = 20;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;
  const gap = chartW / data.length;
  const barW = gap * 0.6;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const y = padT + chartH * (1 - frac);
        const val = Math.round(maxVal * frac);
        return (
          <g key={frac}>
            <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="rgba(201,149,74,0.08)" />
            <text x={padL - 8} y={y + 4} textAnchor="end" style={{ fill: "#8A7080", fontSize: "10px" }}>{val}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barHeight = (d.count / maxVal) * chartH;
        const x = padL + i * gap + (gap - barW) / 2;
        const y = padT + chartH - barHeight;
        return (
          <g key={d.range}>
            <rect x={x} y={y} width={barW} height={barHeight} rx={4} fill={COLORS.blue} opacity={0.75} />
            <text x={x + barW / 2} y={y - 6} textAnchor="middle" style={{ fill: "#3B82F6", fontSize: "10px", fontWeight: 600 }}>
              {d.count.toLocaleString("en-IN")}
            </text>
            <text x={x + barW / 2} y={h - 15} textAnchor="middle" style={{ fill: "#8A7080", fontSize: "10px" }}>
              {d.range}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Revenue Over Time (Area Chart) ───────────────────────────────────────────

function RevenueAreaChart() {
  const data = mockAnalytics.revenueOverTime;
  const maxVal = Math.max(...data.map((d) => d.revenue));
  const minVal = Math.min(...data.map((d) => d.revenue));
  const range = maxVal - minVal || 1;
  const w = 700;
  const h = 260;
  const padL = 60;
  const padR = 15;
  const padT = 20;
  const padB = 40;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const points = data.map((d, i) => {
    const x = padL + (i / (data.length - 1)) * chartW;
    const y = padT + chartH - ((d.revenue - minVal) / range) * chartH;
    return { x, y, ...d };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padT + chartH} L${points[0].x},${padT + chartH} Z`;

  // Y ticks
  const yTicks = Array.from({ length: 5 }, (_, i) => {
    const val = minVal + (range / 4) * i;
    const y = padT + chartH - (i / 4) * chartH;
    return { val, y };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {yTicks.map((t) => (
        <g key={t.val}>
          <line x1={padL} y1={t.y} x2={w - padR} y2={t.y} stroke="rgba(201,149,74,0.08)" strokeDasharray="4 4" />
          <text x={padL - 8} y={t.y + 4} textAnchor="end" style={{ fill: "#8A7080", fontSize: "10px" }}>
            {fmtCurrency(t.val)}
          </text>
        </g>
      ))}
      {points.map((p) => (
        <text key={p.month} x={p.x} y={h - 15} textAnchor="middle" style={{ fill: "#8A7080", fontSize: "10px" }}>
          {p.month}
        </text>
      ))}
      <path d={areaPath} fill="url(#revGrad)" opacity={0.3} />
      <path d={linePath} fill="none" stroke={COLORS.gold} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p) => (
        <circle key={p.month} cx={p.x} cy={p.y} r={3} fill="white" stroke={COLORS.gold} strokeWidth={2} />
      ))}
      <defs>
        <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={COLORS.gold} stopOpacity={0.5} />
          <stop offset="100%" stopColor={COLORS.gold} stopOpacity={0} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Retention Cards ──────────────────────────────────────────────────────────

function RetentionCards() {
  const { d7, d30, d90 } = mockAnalytics.retention;
  const items = [
    { label: "Day 7 Retention", value: d7, color: COLORS.sage },
    { label: "Day 30 Retention", value: d30, color: COLORS.gold },
    { label: "Day 90 Retention", value: d90, color: COLORS.rose },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="glass-card p-5 flex flex-col items-center justify-center text-center"
        >
          <span
            className="font-display text-3xl font-bold"
            style={{ color: item.color }}
          >
            {item.value}%
          </span>
          <span className="font-body text-xs text-muted mt-1">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <TopBar
        title="Analytics"
        subtitle="Platform insights and trends"
        actions={
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-rose" />
          </div>
        }
      />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Registration Trends */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-rose" />
              Registration Trends (Last 30 Days)
            </h3>
            <RegistrationTrendsChart />
          </div>

          {/* Match Success Rate */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-gold" />
              Match Success Rate by Month
            </h3>
            <MatchSuccessChart />
          </div>

          {/* Premium Conversion Funnel */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-sage" />
              Premium Conversion Funnel
            </h3>
            <ConversionFunnelChart />
          </div>

          {/* Top Cities */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-blue" />
              Top Cities by Users
            </h3>
            <TopCitiesChart />
          </div>

          {/* Religion Distribution */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4">
              Religion Distribution
            </h3>
            <ReligionDonutChart />
          </div>

          {/* Age Distribution */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue" />
              Age Distribution
            </h3>
            <AgeDistributionChart />
          </div>

          {/* Retention Metrics */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4">
              Retention Metrics
            </h3>
            <RetentionCards />
          </div>

          {/* Revenue Over Time */}
          <div className="glass-card p-5">
            <h3 className="font-display text-sm font-semibold text-deep mb-4 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gold" />
              Revenue Over Time
            </h3>
            <RevenueAreaChart />
          </div>
        </div>
      </div>
    </div>
  );
}
