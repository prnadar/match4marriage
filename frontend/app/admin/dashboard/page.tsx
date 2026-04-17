"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users, UserCheck, Clock, ShieldCheck, AlertTriangle,
  CheckCircle2, XCircle, RefreshCw, ChevronRight, ArrowUpRight, ArrowDownRight,
  Wallet, CreditCard, CalendarClock, Crown, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/admin/PageHeader";
import { adminApi, ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Stats {
  users: { total: number; active: number; suspended: number; new_today: number; new_7d: number; new_30d: number };
  profiles: { pending: number; approved: number; rejected: number };
  reports: { open: number };
  earnings?: { total_paise: number; this_month_paise: number; monthly_series: Array<{ month: string; paise: number }> };
  plan_distribution?: Array<{ plan: string; count: number }>;
  renewals_due?: Array<{ user_id: string; name: string; plan: string; amount_paise: number; current_period_end: string | null }>;
  registration_trend: Array<{ date: string; count: number }>;
  religion_distribution: Array<{ religion: string; count: number }>;
  recent_activity: Array<{ user_id: string; name: string; status: string; submitted_at: string | null; reviewed_at: string | null }>;
}

const PLAN_META: Record<string, { label: string; color: string; bg: string }> = {
  free:     { label: "Free",     color: "#7d8a93", bg: "bg-slate-100" },
  silver:   { label: "Silver",   color: "#7d8a93", bg: "bg-slate-200" },
  gold:     { label: "Gold",     color: "#c9954a", bg: "bg-gold-100" },
  platinum: { label: "Platinum", color: "#5d4b8a", bg: "bg-purple-100" },
};

function formatRupees(paise: number): string {
  if (!Number.isFinite(paise) || paise === 0) return "₹0";
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}k`;
  return `₹${rupees.toFixed(0)}`;
}

function shortMonth(yyyymm: string): string {
  const [, m] = yyyymm.split("-");
  const idx = Math.max(0, Math.min(11, parseInt(m || "1", 10) - 1));
  return ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][idx];
}

function daysUntil(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days}d`;
}

function formatRel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const res = await adminApi.getStats();
      setStats((res.data as any)?.data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const refresh = () => { setRefreshing(true); load(); };

  if (loading) return <DashboardSkeleton />;

  if (error || !stats) {
    return (
      <>
        <PageHeader title="Dashboard" description="What's happening on your platform right now." />
        <Card>
          <CardContent className="flex items-start gap-3 text-destructive py-8">
            <AlertTriangle className="w-4 h-4 mt-0.5" />
            <span className="text-sm">{error || "No data"}</span>
          </CardContent>
        </Card>
      </>
    );
  }

  const earnings = stats.earnings;
  const planDist = stats.plan_distribution || [];
  const totalPlan = planDist.reduce((s, x) => s + x.count, 0);
  const renewals = stats.renewals_due || [];
  const earningsSeries = earnings?.monthly_series || [];
  const maxEarn = Math.max(1, ...earningsSeries.map((d) => d.paise));
  const maxDay = Math.max(1, ...stats.registration_trend.map((d) => d.count));
  const totalRelig = stats.religion_distribution.reduce((s, x) => s + x.count, 0);

  // Compute deltas for KPIs
  const todayVs7d = stats.users.new_7d > 0 ? (stats.users.new_today * 7 / stats.users.new_7d - 1) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="What's happening on your platform right now."
        actions={
          <Button variant="secondary" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* KPI grid — 4 across on desktop, 2 on tablet */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Total users"
          value={stats.users.total.toLocaleString()}
          hint={`${stats.users.active.toLocaleString()} active`}
          icon={Users}
        />
        <KpiCard
          label="New today"
          value={stats.users.new_today.toLocaleString()}
          hint={`${stats.users.new_7d} this week`}
          icon={TrendingUp}
          trend={todayVs7d}
        />
        <KpiCard
          label="Pending verifications"
          value={stats.profiles.pending.toLocaleString()}
          hint="Awaiting review"
          icon={ShieldCheck}
          tone={stats.profiles.pending > 0 ? "warn" : "neutral"}
          href="/admin/verifications"
        />
        <KpiCard
          label="Open reports"
          value={stats.reports.open.toLocaleString()}
          hint="Need attention"
          icon={AlertTriangle}
          tone={stats.reports.open > 0 ? "danger" : "neutral"}
          href="/admin/reports"
        />
      </div>

      {/* Revenue strip */}
      {earnings && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <KpiCard label="Lifetime earnings" value={formatRupees(earnings.total_paise)} hint="All paid plans" icon={Wallet} tone="good" />
          <KpiCard label="This month" value={formatRupees(earnings.this_month_paise)} hint={`${earningsSeries.length} months tracked`} icon={CalendarClock} />
          <KpiCard label="Renewals · 14d" value={renewals.length.toLocaleString()} hint={renewals.length > 0 ? "Send reminders" : "All clear"} icon={CreditCard} tone={renewals.length > 0 ? "warn" : "neutral"} />
        </div>
      )}

      {/* Two-column area: left = charts, right = side data */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Earnings chart */}
        {earnings && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Monthly earnings</CardTitle>
                  <CardDescription>Last 12 months</CardDescription>
                </div>
                <Badge variant="gold">{formatRupees(earnings.this_month_paise)} MTD</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {earningsSeries.length === 0 ? (
                <EmptyState icon={Wallet} text="No paid subscriptions yet" />
              ) : (
                <div className="flex items-end gap-1.5 h-44 pt-7">
                  {earningsSeries.map((d, i) => {
                    const pct = (d.paise / maxEarn) * 100;
                    return (
                      <div key={d.month} className="flex-1 flex flex-col items-center gap-1.5 min-w-0 group">
                        <div className="relative w-full flex-1 flex flex-col justify-end">
                          {d.paise > 0 && (
                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-foreground/70 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                              {formatRupees(d.paise)}
                            </span>
                          )}
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${Math.max(pct, 1.5)}%` }}
                            transition={{ delay: 0.15 + i * 0.04, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                            className="w-full rounded-t-sm bg-gradient-to-t from-gold to-gold-300 group-hover:from-gold-dark group-hover:to-gold transition-colors"
                          />
                        </div>
                        <span className="text-[10px] text-muted2-foreground tabular-nums">{shortMonth(d.month)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Plan distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Plan distribution</CardTitle>
            <CardDescription>Users by tier</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {planDist.length === 0 || totalPlan === 0 ? (
              <EmptyState icon={Crown} text="No users yet" />
            ) : (
              planDist.map((r, i) => {
                const meta = PLAN_META[r.plan] || { label: r.plan, color: "#999", bg: "bg-slate-100" };
                const pct = totalPlan > 0 ? (r.count / totalPlan) * 100 : 0;
                return (
                  <div key={r.plan}>
                    <div className="flex justify-between items-baseline mb-1.5">
                      <span className="text-[12.5px] font-medium text-foreground">{meta.label}</span>
                      <span className="text-[12px] text-muted2-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{r.count}</span>
                        <span className="ml-1.5">{pct.toFixed(0)}%</span>
                      </span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.2 + i * 0.06, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full"
                        style={{ background: meta.color }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Renewals + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Renewals due */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Renewals due</CardTitle>
                <CardDescription>Next 14 days</CardDescription>
              </div>
              {renewals.length > 0 && <Badge variant="warning">{renewals.length}</Badge>}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {renewals.length === 0 ? (
              <EmptyState icon={CalendarClock} text="No renewals coming up" />
            ) : (
              <ul className="-mx-2">
                {renewals.map((r, i) => {
                  const meta = PLAN_META[r.plan] || { label: r.plan, color: "#999", bg: "bg-slate-100" };
                  return (
                    <motion.li
                      key={r.user_id + (r.current_period_end || "")}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.03, duration: 0.25 }}
                    >
                      <Link
                        href={`/admin/users/${r.user_id}`}
                        className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-secondary group transition-colors"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={cn("w-8 h-8 rounded-md grid place-items-center shrink-0", meta.bg)}>
                            <CreditCard className="w-3.5 h-3.5" style={{ color: meta.color }} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-medium text-foreground truncate">{r.name}</div>
                            <div className="text-[11px] text-muted2-foreground">
                              {meta.label} · {formatRupees(r.amount_paise)}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Badge variant="warning">{daysUntil(r.current_period_end)}</Badge>
                          <ChevronRight className="w-3.5 h-3.5 text-muted2-foreground/40 group-hover:text-muted2-foreground transition-colors" />
                        </div>
                      </Link>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recent verification activity */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent verification activity</CardTitle>
                <CardDescription>Last 20 events</CardDescription>
              </div>
              <Link href="/admin/verifications" className="text-[11px] font-medium text-primary hover:underline">
                View queue →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {stats.recent_activity.length === 0 ? (
              <EmptyState icon={Clock} text="No activity yet" />
            ) : (
              <ul className="-mx-2 max-h-80 overflow-y-auto">
                {stats.recent_activity.slice(0, 8).map((a, i) => (
                  <motion.li
                    key={a.user_id + (a.reviewed_at || a.submitted_at || "")}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.03, duration: 0.25 }}
                  >
                    <Link
                      href="/admin/verifications"
                      className="flex items-center justify-between gap-3 px-2 py-2 rounded-md hover:bg-secondary group transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <ActivityIcon status={a.status} />
                        <div className="min-w-0">
                          <div className="text-[13px] font-medium text-foreground truncate">{a.name}</div>
                          <div className="text-[11px] text-muted2-foreground capitalize">
                            {a.status.replace(/_/g, " ")}
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted2-foreground/70 tabular-nums shrink-0">
                        {formatRel(a.reviewed_at || a.submitted_at)}
                      </span>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom row: registrations + religion */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Registrations</CardTitle>
            <CardDescription>Last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.registration_trend.length === 0 ? (
              <EmptyState icon={TrendingUp} text="No registrations in this window" />
            ) : (
              <div className="flex items-end gap-1 h-32 pt-5">
                {stats.registration_trend.map((d, i) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="relative w-full flex-1 flex flex-col justify-end">
                      {d.count > 0 && (
                        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9.5px] font-semibold text-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity">
                          {d.count}
                        </span>
                      )}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${(d.count / maxDay) * 100}%` }}
                        transition={{ delay: 0.15 + i * 0.025, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                        className="w-full rounded-t-sm bg-gradient-to-t from-primary to-rose-400 min-h-[2px]"
                      />
                    </div>
                    <span className="text-[9.5px] text-muted2-foreground/70 tabular-nums">
                      {new Date(d.date).getDate()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Religion distribution</CardTitle>
            <CardDescription>Top communities</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {stats.religion_distribution.length === 0 ? (
              <EmptyState icon={Users} text="No data yet" />
            ) : (
              stats.religion_distribution.map((r, i) => {
                const pct = totalRelig > 0 ? (r.count / totalRelig) * 100 : 0;
                return (
                  <div key={r.religion}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-[12px] capitalize text-foreground font-medium">{r.religion}</span>
                      <span className="text-[11px] text-muted2-foreground tabular-nums">
                        {r.count} · {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: 0.2 + i * 0.05, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-gradient-to-r from-primary to-rose-400"
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label, value, hint, icon: Icon, tone = "neutral", trend, href,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: any;
  tone?: "neutral" | "good" | "warn" | "danger";
  trend?: number;
  href?: string;
}) {
  const toneRing = {
    neutral: "ring-border/60",
    good:    "ring-emerald-200",
    warn:    "ring-amber-200",
    danger:  "ring-red-200",
  }[tone];
  const toneIcon = {
    neutral: "text-muted2-foreground bg-secondary",
    good:    "text-emerald-700 bg-emerald-50",
    warn:    "text-amber-700 bg-amber-50",
    danger:  "text-red-700 bg-red-50",
  }[tone];

  const inner = (
    <Card className={cn("ring-1 transition-all", toneRing, href && "hover:-translate-y-0.5 hover:shadow-md cursor-pointer")}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted2-foreground/80">
              {label}
            </div>
            <div className="font-display text-[26px] leading-none font-semibold text-foreground mt-2 tabular-nums">
              {value}
            </div>
            {hint && (
              <div className="text-[11.5px] text-muted2-foreground mt-1.5 flex items-center gap-1.5">
                {trend !== undefined && Math.abs(trend) > 0.5 && (
                  <span className={cn(
                    "inline-flex items-center gap-0.5 font-semibold",
                    trend > 0 ? "text-emerald-600" : "text-red-600",
                  )}>
                    {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(trend).toFixed(0)}%
                  </span>
                )}
                <span>{hint}</span>
              </div>
            )}
          </div>
          <div className={cn("w-9 h-9 rounded-md grid place-items-center shrink-0", toneIcon)}>
            <Icon className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ActivityIcon({ status }: { status: string }) {
  const map: Record<string, { icon: any; cls: string }> = {
    approved:  { icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50" },
    rejected:  { icon: XCircle,      cls: "text-red-700 bg-red-50" },
    submitted: { icon: Clock,        cls: "text-amber-700 bg-amber-50" },
  };
  const { icon: Icon, cls } = map[status] || { icon: UserCheck, cls: "text-muted2-foreground bg-secondary" };
  return (
    <div className={cn("w-8 h-8 rounded-md grid place-items-center shrink-0", cls)}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="py-6 text-center">
      <Icon className="w-7 h-7 text-muted2-foreground/30 mx-auto mb-2" />
      <p className="text-[12.5px] text-muted2-foreground">{text}</p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <PageHeader title="Dashboard" description="What's happening on your platform right now." />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[108px] rounded-lg" />)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[108px] rounded-lg" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Skeleton className="lg:col-span-2 h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </>
  );
}
