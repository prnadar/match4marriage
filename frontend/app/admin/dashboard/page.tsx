"use client";

import { useMemo } from "react";
import {
  Users,
  UserCheck,
  UserPlus,
  Clock,
  Heart,
  MessageSquare,
  CreditCard,
  IndianRupee,
  CheckCircle,
  DollarSign,
  Flag,
  Download,
  Megaphone,
  CheckCheck,
} from "lucide-react";
import TopBar from "@/components/admin/TopBar";
import StatsCard from "@/components/admin/StatsCard";
import {
  mockDashboardStats,
  mockRegistrationChart,
  mockMatchesChart,
  mockReligionDistribution,
  mockRecentActivity,
} from "@/lib/admin-mock-data";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString("en-IN");
}

function fmtCurrency(n: number): string {
  return `\u20B9${n.toLocaleString("en-IN")}`;
}

// ── Activity icon map ────────────────────────────────────────────────────────

const activityIconMap = {
  signup: UserPlus,
  approval: CheckCircle,
  match: Heart,
  payment: DollarSign,
  report: Flag,
} as const;

const activityColorMap = {
  signup: "bg-rose-50 text-rose",
  approval: "bg-emerald-50 text-sage",
  match: "bg-rose-100 text-rose-600",
  payment: "bg-gold-50 text-gold",
  report: "bg-red-50 text-red-500",
} as const;

// ── Inline Charts ────────────────────────────────────────────────────────────

function RegistrationLineChart() {
  const data = mockRegistrationChart;
  const maxVal = Math.max(...data.map((d) => d.count));
  const minVal = Math.min(...data.map((d) => d.count));
  const range = maxVal - minVal || 1;
  const w = 600;
  const h = 200;
  const padX = 40;
  const padY = 20;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;

  const points = data
    .map((d, i) => {
      const x = padX + (i / (data.length - 1)) * chartW;
      const y = padY + chartH - ((d.count - minVal) / range) * chartH;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${padX},${padY + chartH} ${points} ${padX + chartW},${padY + chartH}`;

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((pct) => {
    const y = padY + chartH - pct * chartH;
    const label = Math.round(minVal + pct * range);
    return { y, label };
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {gridLines.map((g) => (
        <g key={g.label}>
          <line
            x1={padX}
            y1={g.y}
            x2={padX + chartW}
            y2={g.y}
            stroke="rgba(138,112,128,0.15)"
            strokeDasharray="4,4"
          />
          <text
            x={padX - 6}
            y={g.y + 4}
            textAnchor="end"
            className="fill-muted"
            fontSize="10"
            fontFamily="DM Sans, sans-serif"
          >
            {g.label}
          </text>
        </g>
      ))}
      <polygon fill="url(#regGrad)" points={areaPoints} opacity="0.3" />
      <polyline
        fill="none"
        stroke="#E8426A"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
      {data.map((d, i) => {
        const x = padX + (i / (data.length - 1)) * chartW;
        const y = padY + chartH - ((d.count - minVal) / range) * chartH;
        return i % 5 === 0 ? (
          <circle key={d.date} cx={x} cy={y} r="3" fill="#E8426A" />
        ) : null;
      })}
      <defs>
        <linearGradient id="regGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8426A" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#E8426A" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MatchesBarChart() {
  const data = mockMatchesChart;
  const maxVal = Math.max(...data.map((d) => d.count));
  const w = 500;
  const h = 200;
  const padX = 40;
  const padY = 20;
  const chartW = w - padX * 2;
  const chartH = h - padY * 2;
  const barW = chartW / data.length - 6;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => {
        const y = padY + chartH - pct * chartH;
        const label = Math.round(pct * maxVal);
        return (
          <g key={pct}>
            <line
              x1={padX}
              y1={y}
              x2={padX + chartW}
              y2={y}
              stroke="rgba(138,112,128,0.15)"
              strokeDasharray="4,4"
            />
            <text
              x={padX - 6}
              y={y + 4}
              textAnchor="end"
              className="fill-muted"
              fontSize="10"
              fontFamily="DM Sans, sans-serif"
            >
              {label}
            </text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const barH = (d.count / maxVal) * chartH;
        const x = padX + (i / data.length) * chartW + 3;
        const y = padY + chartH - barH;
        return (
          <g key={d.week}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="4"
              fill="url(#barGrad)"
            />
            <text
              x={x + barW / 2}
              y={padY + chartH + 14}
              textAnchor="middle"
              className="fill-muted"
              fontSize="9"
              fontFamily="DM Sans, sans-serif"
            >
              {d.week}
            </text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C9954A" />
          <stop offset="100%" stopColor="#B07D35" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ReligionPieChart() {
  const data = mockReligionDistribution;
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = 100;
  const cy = 100;
  const r = 80;
  const innerR = 50;

  const slices = useMemo(() => {
    let cumulative = 0;
    return data.map((d) => {
      const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
      cumulative += d.value;
      const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const ix1 = cx + innerR * Math.cos(startAngle);
      const iy1 = cy + innerR * Math.sin(startAngle);
      const ix2 = cx + innerR * Math.cos(endAngle);
      const iy2 = cy + innerR * Math.sin(endAngle);

      const path = [
        `M ${x1} ${y1}`,
        `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
        "Z",
      ].join(" ");

      return { ...d, path };
    });
  }, [data, total]);

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 200 200" className="w-44 h-44 flex-shrink-0">
        {slices.map((s) => (
          <path key={s.name} d={s.path} fill={s.color} stroke="white" strokeWidth="1.5" />
        ))}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-deep"
          fontSize="18"
          fontWeight="bold"
          fontFamily="Playfair Display, serif"
        >
          {fmt(total)}%
        </text>
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          className="fill-muted"
          fontSize="9"
          fontFamily="DM Sans, sans-serif"
        >
          Distribution
        </text>
      </svg>
      <div className="flex flex-col gap-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 font-body text-sm">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-deep">{d.name}</span>
            <span className="text-muted ml-auto">{d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const stats = mockDashboardStats;

  return (
    <div className="min-h-screen bg-blush">
      <TopBar title="Dashboard" subtitle="Overview & quick actions" />

      <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
        {/* ── Stats Row 1 ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Users"
            value={fmt(stats.totalUsers)}
            icon={Users}
            trend={12.5}
            color="rose"
          />
          <StatsCard
            title="Active Users (30d)"
            value={fmt(stats.activeUsers30d)}
            icon={UserCheck}
            trend={8.2}
            color="gold"
          />
          <StatsCard
            title="New Today"
            value={fmt(stats.newToday)}
            icon={UserPlus}
            trend={-3.1}
            color="sage"
          />
          <StatsCard
            title="Pending Approval"
            value={fmt(stats.pendingApproval)}
            icon={Clock}
            color="blue"
          />
        </div>

        {/* ── Stats Row 2 ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Total Matches"
            value={fmt(stats.totalMatches)}
            icon={Heart}
            trend={15.3}
            color="rose"
          />
          <StatsCard
            title="Messages Sent"
            value={fmt(stats.messagesSent)}
            icon={MessageSquare}
            trend={22.1}
            color="gold"
          />
          <StatsCard
            title="Active Subscriptions"
            value={fmt(stats.activeSubscriptions)}
            icon={CreditCard}
            trend={6.8}
            color="sage"
          />
          <StatsCard
            title="Revenue MTD"
            value={fmtCurrency(stats.revenueMTD)}
            icon={IndianRupee}
            trend={18.4}
            color="blue"
          />
        </div>

        {/* ── Charts Section ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line chart: Daily Registrations */}
          <div className="glass-card p-6">
            <h2 className="font-display text-lg font-bold text-deep mb-4">
              Daily Registrations
            </h2>
            <p className="font-body text-xs text-muted mb-3">Last 30 days</p>
            <RegistrationLineChart />
          </div>

          {/* Bar chart: Matches per Week */}
          <div className="glass-card p-6">
            <h2 className="font-display text-lg font-bold text-deep mb-4">
              Matches Made Per Week
            </h2>
            <p className="font-body text-xs text-muted mb-3">Last 12 weeks</p>
            <MatchesBarChart />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pie chart: Religion Distribution */}
          <div className="glass-card p-6">
            <h2 className="font-display text-lg font-bold text-deep mb-4">
              Religion Distribution
            </h2>
            <ReligionPieChart />
          </div>

          {/* ── Recent Activity Feed ─────────────────────────────── */}
          <div className="glass-card p-6 lg:col-span-2">
            <h2 className="font-display text-lg font-bold text-deep mb-4">
              Recent Activity
            </h2>
            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-2">
              {mockRecentActivity.slice(0, 10).map((item) => {
                const IconComp =
                  activityIconMap[item.type as keyof typeof activityIconMap] ||
                  UserPlus;
                const colorCls =
                  activityColorMap[item.type as keyof typeof activityColorMap] ||
                  "bg-rose-50 text-rose";

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-white/40 hover:bg-white/60 transition-colors"
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorCls}`}
                    >
                      <IconComp className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-body text-sm font-medium text-deep truncate">
                        {item.user}
                      </p>
                      <p className="font-body text-xs text-muted truncate">
                        {item.detail}
                      </p>
                    </div>
                    <span className="font-body text-xs text-muted whitespace-nowrap">
                      {item.time}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Quick Actions ────────────────────────────────────────── */}
        <div className="glass-card p-6">
          <h2 className="font-display text-lg font-bold text-deep mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button className="btn-primary">
              <CheckCheck className="w-4 h-4" />
              Approve All Pending
            </button>
            <button className="btn-gold">
              <Megaphone className="w-4 h-4" />
              Send Broadcast
            </button>
            <button className="inline-flex items-center justify-center gap-2 cursor-pointer font-body font-semibold text-sm tracking-wide px-6 py-3 rounded-2xl border border-rose/30 text-deep hover:bg-rose-50 transition-colors">
              <Download className="w-4 h-4" />
              Download Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
