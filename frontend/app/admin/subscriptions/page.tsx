"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, AlertTriangle, CreditCard, Crown, ArrowRight, Download } from "lucide-react";
import { PageShell, Button, fadeUp } from "@/components/admin/PageShell";
import { Segmented, SearchField, EmptyState, SkeletonRows, Pill, type Tone } from "@/components/admin/primitives";
import { adminApi, ApiError } from "@/lib/api";
import { planLabel, formatGBP } from "@/lib/plans";
import { usePersistentState, oneOf, exportRowsToCsv } from "../_lib/view-state";

interface SubscriptionRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  plan: string;
  status: string;
  gateway: string | null;
  amount_paise: number;
  currency: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  created_at: string | null;
}

const STATUS_KEYS = ["all", "active", "expiring", "past_due", "paused", "cancelled", "expired"] as const;
type StatusFilter = (typeof STATUS_KEYS)[number];

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all",       label: "All" },
  { value: "active",    label: "Active" },
  { value: "expiring",  label: "Expiring · 14d" },
  { value: "past_due",  label: "Past due" },
  { value: "paused",    label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "expired",   label: "Expired" },
];

// Plan identity colour sits on the icon chip only; the label is always text.
const PLAN_DOT: Record<string, string> = {
  silver: "#7D8A93",
  gold: "#B07D35",
  platinum: "#5D4B8A",
};

const STATUS_PILL: Record<string, { tone: Tone; label: string }> = {
  active:    { tone: "good",    label: "Active" },
  paused:    { tone: "neutral", label: "Paused" },
  cancelled: { tone: "neutral", label: "Cancelled" },
  expired:   { tone: "bad",     label: "Expired" },
  past_due:  { tone: "warn",    label: "Past due" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null): { label: string; tone: Tone } {
  if (!iso) return { label: "—", tone: "neutral" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: "—", tone: "neutral" };
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0)  return { label: `${-days}d ago`, tone: "bad" };
  if (days === 0) return { label: "Today", tone: "warn" };
  if (days <= 7)  return { label: `In ${days}d`, tone: "warn" };
  if (days <= 30) return { label: `In ${days}d`, tone: "good" };
  return { label: `In ${days}d`, tone: "neutral" };
}

const GRID = "grid grid-cols-[minmax(200px,1.4fr)_140px_110px_100px_minmax(150px,1fr)_96px] gap-4 items-center";

export default function AdminSubscriptionsPage() {
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [status, setStatus] = usePersistentState<StatusFilter>("subscriptions.status", "all", oneOf(STATUS_KEYS));
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 250);
    return () => clearTimeout(t);
  }, [qLive]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // "expiring" is not a real subscription status; it routes to the
      // dedicated expiring endpoint and surfaces as a flat list.
      if (status === "expiring") {
        const res = await adminApi.listExpiringSubscriptions(14);
        const data = (res.data as any)?.data;
        const list: SubscriptionRow[] = Array.isArray(data)
          ? data.map((r: any) => ({
              id: r.id,
              user_id: r.user_id,
              user_name: r.user_name,
              user_email: r.user_email,
              plan: r.plan,
              status: "active",
              gateway: null,
              amount_paise: r.amount_paise,
              currency: "GBP",
              current_period_start: null,
              current_period_end: r.current_period_end,
              cancelled_at: null,
              created_at: null,
            }))
          : [];
        const ql = (q || "").toLowerCase();
        const filtered = ql
          ? list.filter((r) => r.user_name.toLowerCase().includes(ql) || (r.user_email || "").toLowerCase().includes(ql))
          : list;
        setItems(filtered);
        setTotal(filtered.length);
      } else {
        const res = await adminApi.listSubscriptions({
          q: q || undefined,
          status_filter: status === "all" ? undefined : status,
          page,
          limit,
        });
        const payload = res.data as any;
        setItems(Array.isArray(payload?.data) ? payload.data : []);
        setTotal(typeof payload?.total === "number" ? payload.total : 0);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q, status, page, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status, q]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  const exportCsv = () => exportRowsToCsv<SubscriptionRow>(
    `subscriptions-${status}.csv`,
    [
      { label: "Member", value: (r) => r.user_name },
      { label: "Email", value: (r) => r.user_email },
      { label: "Plan", value: (r) => planLabel(r.plan) },
      { label: "Status", value: (r) => r.status },
      { label: "Gateway", value: (r) => r.gateway },
      { label: "Amount (GBP)", value: (r) => (r.amount_paise / 100).toFixed(2) },
      { label: "Period start", value: (r) => r.current_period_start },
      { label: "Period end", value: (r) => r.current_period_end },
      { label: "Cancelled at", value: (r) => r.cancelled_at },
    ],
    items,
  );

  return (
    <PageShell
      title="Subscriptions"
      subtitle="Every paid plan, its billing period and when it renews."
      meta={!loading ? <Pill tone="neutral">{total.toLocaleString("en-GB")}</Pill> : undefined}
      actions={
        <Button size="sm" onClick={exportCsv} disabled={loading || items.length === 0} title="Exports the rows currently shown">
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <SearchField
            value={qLive}
            onChange={setQLive}
            placeholder="Search by member name or email…"
            className="w-full max-w-sm"
          />
          <div className="max-w-full overflow-x-auto">
            <Segmented<StatusFilter>
              ariaLabel="Filter by status"
              layoutId="subs-status-pill"
              options={STATUS_FILTERS}
              value={status}
              onChange={setStatus}
            />
          </div>
        </div>
      }
    >
      <motion.div variants={fadeUp} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(26,10,20,0.04)]">
        <div className="overflow-x-auto" data-admin-scroll>
          <div className="min-w-[780px]">
            <div className={`${GRID} border-b border-border/60 bg-secondary/40 px-4 py-2.5 text-[11.5px] font-medium text-muted2-foreground`}>
              <div>Member</div>
              <div>Plan</div>
              <div>Status</div>
              <div className="text-right">Amount</div>
              <div>Period</div>
              <div className="text-right">Renews</div>
            </div>

            {loading ? (
              <div className="p-3"><SkeletonRows rows={6} /></div>
            ) : error ? (
              <div role="alert" className="flex items-center gap-2 px-4 py-5 text-[13px] text-[#9F1239]">
                <AlertTriangle className="h-4 w-4" aria-hidden /> {error}
                <Button size="sm" variant="ghost" onClick={load}>Retry</Button>
              </div>
            ) : items.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title={q ? `No subscriptions matching “${q}”` : "No subscriptions in this view"}
                description={q ? "Try a different name or email." : status === "expiring" ? "Nothing renews in the next 14 days." : "Paid plans appear here once members subscribe."}
              />
            ) : (
              items.map((s) => <SubRow key={s.id} sub={s} />)
            )}
          </div>
        </div>
      </motion.div>

      {pageCount > 1 && status !== "expiring" && (
        <motion.nav variants={fadeUp} aria-label="Pagination" className="mt-4 flex items-center justify-center gap-3">
          <Button size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden /> Prev
          </Button>
          <span className="text-[12.5px] text-muted2-foreground tabular-nums">
            Page <strong className="text-foreground">{page}</strong> of {pageCount}
          </span>
          <Button size="sm" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}>
            Next <ChevronRight className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </motion.nav>
      )}
    </PageShell>
  );
}

function SubRow({ sub }: { sub: SubscriptionRow }) {
  const dot = PLAN_DOT[sub.plan] || "#8A7080";
  const renews = daysUntil(sub.current_period_end);
  const st = STATUS_PILL[sub.status] || { tone: "neutral" as Tone, label: sub.status };

  return (
    <Link
      href={`/admin/users/${sub.user_id}`}
      className={`${GRID} border-b border-border/40 px-4 py-3 text-foreground no-underline transition-colors last:border-0 hover:bg-secondary/40 focus-visible:bg-secondary/60 focus-visible:outline-none`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border/70 bg-secondary/60">
          <Crown className="h-3.5 w-3.5" style={{ color: dot }} aria-hidden />
        </span>
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium">{sub.user_name}</div>
          <div className="truncate text-[11.5px] text-muted2-foreground">{sub.user_email || "—"}</div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[12.5px]">
        <span className="font-medium">{planLabel(sub.plan)}</span>
        {sub.gateway && <span className="text-[11px] uppercase text-muted2-foreground">· {sub.gateway}</span>}
      </div>

      <div><Pill tone={st.tone}>{st.label}</Pill></div>

      <div className="text-right text-[13px] font-semibold tabular-nums">{formatGBP(sub.amount_paise)}</div>

      <div className="text-[11.5px] leading-5 text-muted2-foreground tabular-nums">
        {sub.current_period_start ? formatDate(sub.current_period_start) : "—"}
        <span className="flex items-center gap-1">
          <ArrowRight className="h-3 w-3" aria-hidden /> {formatDate(sub.current_period_end)}
        </span>
      </div>

      <div className="text-right"><Pill tone={renews.tone}>{renews.label}</Pill></div>
    </Link>
  );
}
