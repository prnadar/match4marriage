"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft, ChevronRight, AlertTriangle, Wallet,
  ArrowDownRight, ArrowUpRight, Download, CalendarDays, Landmark,
} from "lucide-react";
import { PageShell, StatCard, Button, fadeUp } from "@/components/admin/PageShell";
import { Segmented, SearchField, EmptyState, SkeletonRows, Pill, relTime, formatDateTime } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import { adminApi, ApiError, downloadCsv } from "@/lib/api";
import { formatGBP } from "@/lib/plans";
import { usePersistentState, oneOf } from "../_lib/view-state";

interface PaymentRow {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string | null;
  amount: number;            // positive=credit, negative=debit
  balance_after: number;
  description: string;
  reference_id: string | null;
  gateway: string | null;
  created_at: string | null;
}

interface PaymentsSummary {
  today_paise: number;
  this_month_paise: number;
  lifetime_paise: number;
}

const DIR_KEYS = ["all", "credit", "debit"] as const;
type DirFilter = (typeof DIR_KEYS)[number];
const GW_KEYS = ["all", "paypal", "stripe", "razorpay", "upi"] as const;
type GwFilter = (typeof GW_KEYS)[number];
const RANGE_KEYS = ["all", "7", "30", "90"] as const;
type RangeFilter = (typeof RANGE_KEYS)[number];

const DIR_FILTERS: Array<{ value: DirFilter; label: string }> = [
  { value: "all",    label: "All" },
  { value: "credit", label: "Credits" },
  { value: "debit",  label: "Debits" },
];

const GW_FILTERS: Array<{ value: GwFilter; label: string }> = [
  { value: "all",      label: "All gateways" },
  { value: "paypal",   label: "PayPal" },
  { value: "stripe",   label: "Stripe" },
  { value: "razorpay", label: "Razorpay" },
  { value: "upi",      label: "UPI" },
];

const RANGE_FILTERS: Array<{ value: RangeFilter; label: string }> = [
  { value: "7",   label: "7d" },
  { value: "30",  label: "30d" },
  { value: "90",  label: "90d" },
  { value: "all", label: "All time" },
];

const GRID = "grid grid-cols-[minmax(190px,1.4fr)_minmax(190px,1.6fr)_100px_110px_80px_100px] gap-4 items-center";

export default function AdminPaymentsPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [dir, setDir] = usePersistentState<DirFilter>("payments.dir", "all", oneOf(DIR_KEYS));
  const [gw, setGw] = usePersistentState<GwFilter>("payments.gateway", "all", oneOf(GW_KEYS));
  const [range, setRange] = usePersistentState<RangeFilter>("payments.range", "all", oneOf(RANGE_KEYS));
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 250);
    return () => clearTimeout(t);
  }, [qLive]);

  // Summary loads once on mount; doesn't depend on filters.
  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getPaymentsSummary();
        setSummary((res.data as any)?.data ?? null);
      } catch { /* non-fatal */ }
    })();
  }, []);

  const filters = useCallback(() => ({
    q: q || undefined,
    gateway: gw === "all" ? undefined : gw,
    direction: dir === "all" ? undefined : dir,
    days: range === "all" ? undefined : Number(range),
  }), [q, gw, dir, range]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listPayments({ ...filters(), page, limit });
      const payload = res.data as any;
      setItems(Array.isArray(payload?.data) ? payload.data : []);
      setTotal(typeof payload?.total === "number" ? payload.total : 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dir, gw, q, range]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv(adminApi.exportPaymentsCsvUrl(filters()), "payments.csv");
    } catch (e) {
      toast("error", e instanceof Error ? `Export failed: ${e.message}` : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageShell
      title="Payments"
      subtitle="Every credit and debit on member accounts, newest first."
      meta={!loading ? <Pill tone="neutral">{total.toLocaleString("en-GB")}</Pill> : undefined}
      actions={
        <Button size="sm" onClick={exportCsv} loading={exporting} title="Exports every row matching the current filters">
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      }
    >
      {/* Totals strip */}
      <motion.div variants={fadeUp} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Today" value={summary ? formatGBP(summary.today_paise) : "—"} icon={CalendarDays} />
        <StatCard label="This month" value={summary ? formatGBP(summary.this_month_paise) : "—"} icon={Wallet} tone="good" />
        <StatCard label="Lifetime" value={summary ? formatGBP(summary.lifetime_paise) : "—"} icon={Landmark} hint="All non-cancelled subscriptions" />
      </motion.div>

      {/* Filters — one row */}
      <motion.div variants={fadeUp} className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField
          value={qLive}
          onChange={setQLive}
          placeholder="Search by member name or email…"
          className="w-full max-w-xs"
        />
        <Segmented<DirFilter> ariaLabel="Direction" layoutId="payments-dir-pill" size="sm" options={DIR_FILTERS} value={dir} onChange={setDir} />
        <Segmented<RangeFilter> ariaLabel="Date range" layoutId="payments-range-pill" size="sm" options={RANGE_FILTERS} value={range} onChange={setRange} />
        <label className="sr-only" htmlFor="payments-gateway">Gateway</label>
        <select
          id="payments-gateway"
          value={gw}
          onChange={(e) => setGw(e.target.value as GwFilter)}
          className="h-8 rounded-lg border border-border/80 bg-card px-2.5 text-[12.5px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          {GW_FILTERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </motion.div>

      <motion.div variants={fadeUp} className="overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(26,10,20,0.04)]">
        <div className="overflow-x-auto" data-admin-scroll>
          <div className="min-w-[760px]">
            <div className={`${GRID} border-b border-border/60 bg-secondary/40 px-4 py-2.5 text-[11.5px] font-medium text-muted2-foreground`}>
              <div>Member</div>
              <div>Description</div>
              <div>Gateway</div>
              <div className="text-right">Amount</div>
              <div className="text-right">Balance</div>
              <div className="text-right">When</div>
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
                icon={Wallet}
                title={q ? `No transactions matching “${q}”` : "No transactions in this view"}
                description={q || dir !== "all" || gw !== "all" || range !== "all"
                  ? "Widen the date range or clear the filters."
                  : "Payments appear here as members buy or renew plans."}
              />
            ) : (
              items.map((tx) => <TxRow key={tx.id} tx={tx} />)
            )}
          </div>
        </div>
      </motion.div>

      {pageCount > 1 && (
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

function TxRow({ tx }: { tx: PaymentRow }) {
  const isCredit = tx.amount >= 0;
  const amountStr = `${isCredit ? "+" : "−"}${formatGBP(Math.abs(tx.amount))}`;
  return (
    <div className={`${GRID} border-b border-border/40 px-4 py-3 last:border-0 hover:bg-secondary/30`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border ${isCredit ? "border-[#CFE0D3] bg-[#EAF2EB] text-[#2F5A3A]" : "border-[#F7CCD5] bg-[#FDECEF] text-[#9F1239]"}`}>
          {isCredit ? <ArrowDownRight className="h-3.5 w-3.5" aria-hidden /> : <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />}
          <span className="sr-only">{isCredit ? "Credit" : "Debit"}</span>
        </span>
        <div className="min-w-0">
          <Link
            href={`/admin/users/${tx.user_id}`}
            className="block truncate rounded text-[13px] font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            {tx.user_name}
          </Link>
          <div className="truncate text-[11.5px] text-muted2-foreground">{tx.user_email || "—"}</div>
        </div>
      </div>

      <div className="min-w-0 text-[12.5px] text-foreground/80">
        <div className="truncate">{tx.description}</div>
        {tx.reference_id && <div className="truncate font-mono text-[10.5px] text-muted2-foreground">{tx.reference_id}</div>}
      </div>

      <div>
        {tx.gateway ? <Pill tone="neutral">{tx.gateway.toUpperCase()}</Pill> : <span className="text-[11px] text-muted2-foreground">—</span>}
      </div>

      <div className={`text-right text-[13px] font-semibold tabular-nums ${isCredit ? "text-[#2F5A3A]" : "text-[#9F1239]"}`}>
        {amountStr}
      </div>

      <div className="text-right text-[12px] text-muted2-foreground tabular-nums">{tx.balance_after}</div>

      <div className="text-right text-[12px] text-muted2-foreground tabular-nums" title={formatDateTime(tx.created_at)}>
        {relTime(tx.created_at)}
      </div>
    </div>
  );
}
