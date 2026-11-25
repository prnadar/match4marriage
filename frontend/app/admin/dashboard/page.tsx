"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, CreditCard, Flag,
  HeartHandshake, Inbox, RefreshCw, ScrollText, ShieldCheck, TrendingUp, UserPlus, Users, Wallet, XCircle,
} from "lucide-react";
import { adminApi, ApiError } from "@/lib/api";
import { formatGBP, planLabel } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { Button } from "@/components/admin/PageShell";
import {
  Delta, EmptyState, Panel, Pill, Segmented, Skeleton, hoursSince, pctChange, relTime, waitingLabel,
} from "@/components/admin/primitives";
import { describeAction } from "@/components/admin/audit-labels";
import {
  BarList, ColumnChart, Funnel, RUBY_RAMP, SERIES, SegmentBar, denseDaily, denseMonths, weekly,
} from "@/components/admin/charts";

// ─── Types (all extended fields optional: older backends degrade cleanly) ────

interface Stats {
  users: { total: number; active: number; suspended: number; new_today: number; new_7d: number; new_30d: number };
  profiles: { pending: number; approved: number; rejected: number };
  reports: { open: number };
  earnings?: { total_paise: number; this_month_paise: number; monthly_series: Array<{ month: string; paise: number }> };
  plan_distribution?: Array<{ plan: string; count: number }>;
  renewals_due?: Array<{ user_id: string; name: string; plan: string; amount_paise: number; current_period_end: string | null }>;
  registration_trend: Array<{ date: string; count: number }>;
  registration_trend_90d?: Array<{ date: string; count: number }>;
  religion_distribution: Array<{ religion: string; count: number }>;
  recent_activity: Array<{ user_id: string; name: string; status: string; submitted_at: string | null; reviewed_at: string | null }>;
  deltas?: { new_prev_7d: number; new_prev_30d: number; revenue_prev_month_paise: number; interests_prev_30d: number; messages_prev_30d: number };
  funnel?: { profile_complete: number; submitted: number; paid: number };
  engagement?: { interests_30d: number; mutual_matches_total: number; mutual_matches_30d: number; messages_30d: number };
  active_subscriptions_by_plan?: Array<{ plan: string; count: number; amount_paise: number }>;
  gender_distribution?: Array<{ gender: string; count: number }>;
  country_distribution?: Array<{ country: string; count: number }>;
  verification_sla?: {
    avg_review_hours_30d: number | null;
    oldest_pending: Array<{ user_id: string; name: string; submitted_at: string | null; waiting_hours: number | null; completeness_score: number }>;
  };
  enquiries?: { new: number };
  recent_admin_actions?: Array<{ created_at: string | null; actor_email: string | null; action: string; target_type: string | null; target_id: string | null; target_label: string | null; summary: string | null }>;
}

const SLA_HOURS = 48;

function greetingFor(now = new Date()): string {
  const h = now.getHours();
  if (h < 5) return "Working late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<"30" | "90">("30");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await adminApi.getStats();
      setStats((res.data as any)?.data);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  const refresh = () => { setRefreshing(true); load(); };
  const greeting = useMemo(() => greetingFor(), []);
  const today = useMemo(() => new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }), []);

  const header = (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-[24px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-[28px]">{greeting}</h1>
        <p className="mt-1 text-[13px] text-muted2-foreground">
          {today}{updatedAt && <> · updated {relTime(updatedAt.toISOString())}</>}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={refresh} disabled={refreshing} ariaLabel="Refresh dashboard">
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} aria-hidden /> Refresh
        </Button>
        <Link href="/admin/verifications" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 text-[12.5px] font-medium text-primary-foreground shadow-[0_1px_2px_rgba(160,21,60,0.25)] transition-colors hover:bg-[#C21933] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-1">
          Review queue <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </header>
  );

  if (loading) return <div className="mx-auto max-w-[1400px]">{header}<DashboardSkeleton /></div>;

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-[1400px]">
        {header}
        <Panel>
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load the dashboard"
            description={error || "The stats endpoint returned no data."}
            action={<Button size="sm" onClick={refresh}>Try again</Button>}
          />
        </Panel>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      {header}
      <DashboardBody stats={stats} range={range} setRange={setRange} />
    </div>
  );
}

function DashboardBody({ stats, range, setRange }: { stats: Stats; range: "30" | "90"; setRange: (r: "30" | "90") => void }) {
  const d = stats.deltas;
  const eng = stats.engagement;
  const earnings = stats.earnings;
  const funnel = stats.funnel;
  const sla = stats.verification_sla;
  const activeByPlan = stats.active_subscriptions_by_plan || [];
  const paidMembers = funnel?.paid ?? activeByPlan.reduce((s, p) => s + p.count, 0);

  const daily = useMemo(
    () => denseDaily(stats.registration_trend_90d || stats.registration_trend, range === "30" ? 30 : 91),
    [stats.registration_trend_90d, stats.registration_trend, range],
  );
  const signupSeries = range === "30" ? daily : weekly(daily);
  const signupTotal = daily.reduce((s, x) => s + x.value, 0);
  const months = useMemo(() => denseMonths(earnings?.monthly_series || []), [earnings?.monthly_series]);
  const revenue12m = months.reduce((s, m) => s + m.value, 0);

  const oldestWaitH = sla?.oldest_pending?.[0]?.waiting_hours ?? hoursSince(sla?.oldest_pending?.[0]?.submitted_at);
  const overdue = (sla?.oldest_pending || []).filter((p) => (p.waiting_hours ?? 0) >= SLA_HOURS).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-4">
      {/* ── KPI strip ─────────────────────────────────────────────────────── */}
      <section aria-label="Key metrics" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/70 bg-border/60 shadow-[0_1px_2px_rgba(26,10,20,0.04)] md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Members" value={stats.users.total.toLocaleString("en-GB")} href="/admin/users"
          foot={<Delta value={d ? pctChange(stats.users.new_30d, d.new_prev_30d) : undefined} suffix={`${stats.users.new_30d} new in 30d`} />}
        />
        <Kpi
          label="New sign-ups · 7d" value={stats.users.new_7d.toLocaleString("en-GB")}
          foot={<Delta value={d ? pctChange(stats.users.new_7d, d.new_prev_7d) : undefined} suffix="vs prior 7d" />}
        />
        <Kpi
          label="Approved profiles" value={stats.profiles.approved.toLocaleString("en-GB")} href="/admin/verifications"
          foot={<span>{stats.users.total ? Math.round((stats.profiles.approved / stats.users.total) * 100) : 0}% of members · {stats.profiles.pending} pending</span>}
        />
        <Kpi
          label="Paid members" value={paidMembers.toLocaleString("en-GB")} href="/admin/subscriptions"
          foot={<span>{activeByPlan.filter((p) => p.count > 0).map((p) => `${p.count} ${planLabel(p.plan)}`).join(" · ") || "No active plans"}</span>}
        />
        <Kpi
          label="Revenue · this month" value={formatGBP(earnings?.this_month_paise || 0)} href="/admin/payments"
          foot={<span>Last month {formatGBP(d?.revenue_prev_month_paise || 0)}</span>}
        />
        <Kpi
          label="Mutual matches · 30d" value={(eng?.mutual_matches_30d ?? 0).toLocaleString("en-GB")}
          foot={<span>{(eng?.mutual_matches_total ?? 0).toLocaleString("en-GB")} all-time</span>}
        />
      </section>

      {/* ── Sign-ups + needs attention ───────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="New sign-ups"
          description={`${signupTotal.toLocaleString("en-GB")} in the last ${range} days${range === "90" ? " · weekly" : " · daily"}`}
          actions={
            <Segmented<"30" | "90">
              size="sm" layoutId="dash-range" ariaLabel="Date range"
              value={range} onChange={setRange}
              options={[{ value: "30", label: "30d" }, { value: "90", label: "90d" }]}
            />
          }
        >
          {signupTotal === 0
            ? <EmptyState compact icon={UserPlus} title="No sign-ups in this window" description="New registrations will chart here day by day." />
            : <ColumnChart data={signupSeries} ariaLabel={`New sign-ups, last ${range} days`} valueLabel="Sign-ups" formatValue={(v) => `${v} sign-up${v === 1 ? "" : "s"}`} highlightLast={range === "90"} />}
        </Panel>

        <Panel
          title="Needs attention"
          description="Work waiting on the team"
          bodyClassName="px-2 pb-2"
        >
          <ul className="divide-y divide-border/50">
            <AttentionRow
              href="/admin/verifications" icon={ShieldCheck}
              label="Profiles awaiting review" count={stats.profiles.pending}
              detail={stats.profiles.pending > 0
                ? `Oldest waiting ${waitingLabel(oldestWaitH ?? null)}${overdue ? ` · ${overdue} over ${SLA_HOURS}h` : ""}`
                : "Queue is clear"}
              tone={overdue > 0 ? "bad" : stats.profiles.pending > 0 ? "warn" : "good"}
            />
            <AttentionRow
              href="/admin/reports" icon={Flag}
              label="Open reports" count={stats.reports.open}
              detail={stats.reports.open > 0 ? "Members flagged content or behaviour" : "Nothing flagged"}
              tone={stats.reports.open > 0 ? "bad" : "good"}
            />
            <AttentionRow
              href="/admin/enquiries" icon={Inbox}
              label="New enquiries" count={stats.enquiries?.new ?? 0}
              detail={(stats.enquiries?.new ?? 0) > 0 ? "Unanswered contact-form messages" : "Inbox zero"}
              tone={(stats.enquiries?.new ?? 0) > 0 ? "warn" : "good"}
            />
            <AttentionRow
              href="/admin/subscriptions" icon={CalendarClock}
              label="Renewals in 14 days" count={(stats.renewals_due || []).length}
              detail={(stats.renewals_due || []).length > 0 ? "Follow up to reduce churn" : "None coming up"}
              tone={(stats.renewals_due || []).length > 0 ? "info" : "good"}
            />
          </ul>
          {sla?.avg_review_hours_30d != null && (
            <p className="mt-2 px-3 text-[12px] text-muted2-foreground">
              Average review time (30d): <span className="font-medium text-foreground">{waitingLabel(sla.avg_review_hours_30d)}</span>
              {" "}· target {SLA_HOURS}h
            </p>
          )}
        </Panel>
      </div>

      {/* ── Revenue + plans ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Revenue"
          description={`${formatGBP(revenue12m)} billed over the last 12 months · ${formatGBP(earnings?.total_paise || 0)} lifetime`}
          actions={<Link href="/admin/payments" className="text-[12px] font-medium text-primary hover:underline">Payments</Link>}
        >
          {revenue12m === 0
            ? <EmptyState compact icon={Wallet} title="No paid subscriptions yet" description="Monthly billings will appear here once members upgrade." />
            : <ColumnChart
                data={months} color={SERIES.blue} ariaLabel="Revenue by month, last 12 months" valueLabel="Revenue"
                formatValue={(v) => formatGBP(v)} formatTick={(v) => formatGBP(v)} highlightLast tickEvery={1}
              />}
        </Panel>

        <Panel title="Active subscriptions" description="By plan, currently in period">
          {paidMembers === 0 ? (
            <EmptyState compact icon={CreditCard} title="No active subscriptions" description="Basic, Premium and Elite members will be counted here." />
          ) : (
            <SegmentBar
              ariaLabel="Active subscriptions by plan"
              segments={["silver", "gold", "platinum"].map((p, i) => {
                const row = activeByPlan.find((x) => x.plan === p);
                return { key: p, label: planLabel(p), value: row?.count || 0, color: RUBY_RAMP[i], hint: row?.amount_paise ? formatGBP(row.amount_paise) : undefined };
              })}
            />
          )}
          <div className="mt-4 border-t border-border/60 pt-3">
            <div className="mb-2 text-[12px] font-medium text-muted2-foreground">All members by tier</div>
            <SegmentBar
              ariaLabel="Members by tier"
              segments={(stats.plan_distribution || []).map((p) => ({
                key: p.plan, label: planLabel(p.plan), value: p.count,
                color: p.plan === "free" ? SERIES.neutral : RUBY_RAMP[Math.max(0, ["silver", "gold", "platinum"].indexOf(p.plan))],
              }))}
            />
          </div>
        </Panel>
      </div>

      {/* ── Funnel + engagement ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Member journey" description="From sign-up to paying member (all-time)">
          <Funnel
            stages={[
              { key: "reg", label: "Registered", value: stats.users.total },
              { key: "complete", label: "Completed profile", value: funnel?.profile_complete ?? 0 },
              { key: "submitted", label: "Submitted for verification", value: funnel?.submitted ?? (stats.profiles.pending + stats.profiles.approved + stats.profiles.rejected) },
              { key: "approved", label: "Approved", value: stats.profiles.approved },
              { key: "paid", label: "Paid plan", value: paidMembers },
            ]}
          />
        </Panel>

        <Panel title="Engagement" description="Last 30 days vs the 30 before">
          <dl className="divide-y divide-border/50">
            <EngRow icon={HeartHandshake} label="Interests sent" value={eng?.interests_30d ?? 0} delta={d && eng ? pctChange(eng.interests_30d, d.interests_prev_30d) : undefined} />
            <EngRow icon={CheckCircle2} label="Mutual matches" value={eng?.mutual_matches_30d ?? 0} />
            <EngRow icon={TrendingUp} label="Messages sent" value={eng?.messages_30d ?? 0} delta={d && eng ? pctChange(eng.messages_30d, d.messages_prev_30d) : undefined} />
            <EngRow icon={Users} label="Suspended members" value={stats.users.suspended} goodWhen="down" />
          </dl>
          <Link href="/admin/matchmaking" className="mt-3 inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
            Suggest a match <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </Panel>
      </div>

      {/* ── Audience ────────────────────────────────────────────────────── */}
      <Panel title="Audience" description="Who's on the platform (active profiles)">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-[12px] font-medium text-muted2-foreground">Gender</h3>
            {(stats.gender_distribution || []).length === 0
              ? <p className="text-[12.5px] text-muted2-foreground">No data yet</p>
              : <SegmentBar
                  ariaLabel="Profiles by gender"
                  segments={(stats.gender_distribution || []).map((g) => ({
                    key: g.gender,
                    label: g.gender === "male" ? "Men" : g.gender === "female" ? "Women" : g.gender === "other" ? "Other" : "Not set",
                    value: g.count,
                    color: g.gender === "male" ? SERIES.blue : g.gender === "female" ? SERIES.ruby : g.gender === "other" ? SERIES.gold : SERIES.neutral,
                  }))}
                />}
          </div>
          <div>
            <h3 className="mb-3 text-[12px] font-medium text-muted2-foreground">Top countries</h3>
            {(stats.country_distribution || []).length === 0
              ? <p className="text-[12.5px] text-muted2-foreground">No data yet</p>
              : <BarList ariaLabel="Profiles by country" items={(stats.country_distribution || []).map((c) => ({ key: c.country, label: c.country, value: c.count }))} max={6} />}
          </div>
          <div>
            <h3 className="mb-3 text-[12px] font-medium text-muted2-foreground">Religion</h3>
            {stats.religion_distribution.length === 0
              ? <p className="text-[12.5px] text-muted2-foreground">No data yet</p>
              : <BarList ariaLabel="Profiles by religion" items={stats.religion_distribution.map((r) => ({ key: r.religion, label: r.religion.toLowerCase(), value: r.count }))} max={6} />}
          </div>
        </div>
      </Panel>

      {/* ── Queue + activity ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Longest waiting"
          description={`Oldest profiles in the verification queue · SLA ${SLA_HOURS}h`}
          actions={<Link href="/admin/verifications" className="text-[12px] font-medium text-primary hover:underline">Open queue</Link>}
          bodyClassName="px-2 pb-2"
        >
          {(sla?.oldest_pending || []).length === 0 ? (
            <EmptyState compact icon={ShieldCheck} title="Queue is clear" description="Every submitted profile has been reviewed." />
          ) : (
            <ul>
              {(sla?.oldest_pending || []).map((p) => {
                const h = p.waiting_hours ?? hoursSince(p.submitted_at);
                const over = (h ?? 0) >= SLA_HOURS;
                return (
                  <li key={p.user_id}>
                    <Link href={`/admin/verifications?open=${p.user_id}`} className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-secondary/60">
                      <Clock className={cn("h-4 w-4 shrink-0", over ? "text-[#B42343]" : "text-muted2-foreground")} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{p.name}</span>
                      <span className="text-[12px] tabular-nums text-muted2-foreground">{p.completeness_score}% complete</span>
                      <Pill tone={over ? "bad" : "warn"}>{waitingLabel(h ?? null)}</Pill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel
          title="Team activity"
          description="Latest admin actions"
          actions={<Link href="/admin/audit-log" className="text-[12px] font-medium text-primary hover:underline">Audit log</Link>}
          bodyClassName="px-2 pb-2"
        >
          {(stats.recent_admin_actions || []).length > 0 ? (
            <ul>
              {(stats.recent_admin_actions || []).slice(0, 7).map((a, i) => (
                <li key={`${a.created_at}-${i}`} className="flex items-start gap-3 rounded-lg px-3 py-2">
                  <ActionIcon action={a.action} />
                  <div className="min-w-0 flex-1 text-[13px] leading-snug">
                    <span className="font-medium text-foreground">{(a.actor_email || "An admin").split("@")[0]}</span>
                    <span className="text-muted2-foreground"> {describeAction(a.action)} </span>
                    {a.target_label && (
                      a.target_type === "user" && a.target_id
                        ? <Link href={`/admin/users/${a.target_id}`} className="font-medium text-foreground hover:underline">{a.target_label}</Link>
                        : <span className="font-medium text-foreground">{a.target_label}</span>
                    )}
                  </div>
                  <span className="shrink-0 text-[12px] text-muted2-foreground">{relTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          ) : stats.recent_activity.length > 0 ? (
            <ul>
              {stats.recent_activity.slice(0, 7).map((a) => (
                <li key={a.user_id + (a.reviewed_at || a.submitted_at || "")} className="flex items-center gap-3 rounded-lg px-3 py-2">
                  <ActionIcon action={`verification.${a.status === "approved" ? "approve" : a.status === "rejected" ? "reject" : "submit"}`} />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{a.name} <span className="text-muted2-foreground">· {a.status.replace(/_/g, " ")}</span></span>
                  <span className="shrink-0 text-[12px] text-muted2-foreground">{relTime(a.reviewed_at || a.submitted_at)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={ScrollText} title="No activity yet" description="Approvals, suspensions and pricing changes will show here." />
          )}
        </Panel>
      </div>
    </motion.div>
  );
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Kpi({ label, value, foot, href }: { label: string; value: string; foot?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="text-[12px] font-medium text-muted2-foreground">{label}</div>
      <div className="mt-1.5 text-[24px] font-semibold leading-none tracking-[-0.02em] text-foreground">{value}</div>
      {foot && <div className="mt-2 truncate text-[11.5px] text-muted2-foreground">{foot}</div>}
    </>
  );
  const cls = "block min-w-0 bg-card p-4";
  return href
    ? <Link href={href} className={cn(cls, "transition-colors hover:bg-[#FCF8F6] focus-visible:outline-none focus-visible:bg-[#FCF8F6]")}>{body}</Link>
    : <div className={cls}>{body}</div>;
}

function AttentionRow({ href, icon: Icon, label, count, detail, tone }: {
  href: string; icon: any; label: string; count: number; detail: string; tone: "good" | "warn" | "bad" | "info";
}) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:bg-secondary/60">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border/70 bg-secondary/50 text-muted2-foreground">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-foreground">{label}</div>
          <div className="truncate text-[12px] text-muted2-foreground">{detail}</div>
        </div>
        <Pill tone={count === 0 ? "good" : tone}>{count === 0 ? "Clear" : count.toLocaleString("en-GB")}</Pill>
        <ArrowRight className="h-3.5 w-3.5 text-muted2-foreground/50 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

function EngRow({ icon: Icon, label, value, delta, goodWhen = "up" }: { icon: any; label: string; value: number; delta?: number | null; goodWhen?: "up" | "down" }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted2-foreground" aria-hidden />
      <dt className="flex-1 text-[13px] text-foreground">{label}</dt>
      {delta !== undefined && <Delta value={delta} goodWhen={goodWhen} />}
      <dd className="w-16 text-right text-[15px] font-semibold tabular-nums text-foreground">{value.toLocaleString("en-GB")}</dd>
    </div>
  );
}

function ActionIcon({ action }: { action: string }) {
  const map: Array<[string, any, string]> = [
    ["verification.approve", CheckCircle2, "text-[#2F6B3F] bg-[#EAF2EB]"],
    ["verification.reject", XCircle, "text-[#B42343] bg-[#FDECEF]"],
    ["verification.", ShieldCheck, "text-[#7A5200] bg-[#FBF0DA]"],
    ["user.", Users, "text-muted2-foreground bg-secondary"],
    ["match.", HeartHandshake, "text-primary bg-primary/10"],
    ["pricing.", Wallet, "text-[#26437F] bg-[#EBF0FB]"],
    ["report.", Flag, "text-[#B42343] bg-[#FDECEF]"],
  ];
  const hit = map.find(([k]) => action === k || (k.endsWith(".") && action.startsWith(k)));
  const Icon = hit?.[1] || ScrollText;
  return (
    <span className={cn("mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md", hit?.[2] || "text-muted2-foreground bg-secondary")}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-[98px] rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[290px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[290px] rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[280px] rounded-xl lg:col-span-2" />
        <Skeleton className="h-[280px] rounded-xl" />
      </div>
    </div>
  );
}
