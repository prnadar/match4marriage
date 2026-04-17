"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Search, X, ChevronLeft, ChevronRight, AlertTriangle, Wallet,
  ArrowDownRight, ArrowUpRight,
} from "lucide-react";
import { Download } from "lucide-react";
import { PageShell, GlassCard, StatCard, Button, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError, downloadCsv } from "@/lib/api";

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

type DirFilter = "all" | "credit" | "debit";
type GwFilter  = "all" | "razorpay" | "stripe" | "upi";

const DIR_FILTERS: Array<{ key: DirFilter; label: string }> = [
  { key: "all",    label: "All" },
  { key: "credit", label: "Credits" },
  { key: "debit",  label: "Debits" },
];

const GW_FILTERS: Array<{ key: GwFilter; label: string }> = [
  { key: "all",      label: "All gateways" },
  { key: "razorpay", label: "Razorpay" },
  { key: "stripe",   label: "Stripe" },
  { key: "upi",      label: "UPI" },
];

function formatRupees(paise: number): string {
  if (!Number.isFinite(paise) || paise === 0) return "₹0";
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}k`;
  return `₹${rupees.toFixed(0)}`;
}

function formatShort(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) {
    const hrs = Math.floor(diff / 3600000);
    if (hrs < 1) return "just now";
    return `${hrs}h ago`;
  }
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function AdminPaymentsPage() {
  const [items, setItems] = useState<PaymentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [dir, setDir] = useState<DirFilter>("all");
  const [gw, setGw] = useState<GwFilter>("all");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PaymentsSummary | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listPayments({
        q: q || undefined,
        gateway: gw === "all" ? undefined : gw,
        direction: dir === "all" ? undefined : dir,
        page,
        limit,
      });
      const payload = res.data as any;
      setItems(Array.isArray(payload?.data) ? payload.data : []);
      setTotal(typeof payload?.total === "number" ? payload.total : 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q, gw, dir, page, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [dir, gw, q]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <PageShell
      title="Payments"
      subtitle={`${total.toLocaleString()} transaction${total === 1 ? "" : "s"}`}
      actions={
        <Button
          variant="secondary"
          onClick={() => {
            const url = adminApi.exportPaymentsCsvUrl({
              q: q || undefined,
              gateway: gw === "all" ? undefined : gw,
              direction: dir === "all" ? undefined : dir,
            });
            downloadCsv(url, "payments.csv").catch(() => {});
          }}
        >
          <Download style={{ width: 13, height: 13 }} /> Export CSV
        </Button>
      }
    >
      {/* Totals strip */}
      <motion.div
        variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 20 }}
      >
        <StatCard label="Today" value={summary ? formatRupees(summary.today_paise) : "—"} tone="info" />
        <StatCard label="This month" value={summary ? formatRupees(summary.this_month_paise) : "—"} tone="good" />
        <StatCard label="Lifetime" value={summary ? formatRupees(summary.lifetime_paise) : "—"} hint="All non-cancelled subscriptions" />
      </motion.div>

      {/* Search + filters */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={searchBoxStyle}>
          <Search style={{ width: 15, height: 15, color: "#aaa" }} />
          <input
            type="text"
            placeholder="Search by user name or email…"
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            style={searchInputStyle}
          />
          {qLive && (
            <button onClick={() => setQLive("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#aaa", display: "flex" }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        <FilterPills<DirFilter>
          layoutId="payments-dir-pill"
          options={DIR_FILTERS}
          value={dir}
          onChange={setDir}
        />
        <FilterPills<GwFilter>
          layoutId="payments-gw-pill"
          options={GW_FILTERS}
          value={gw}
          onChange={setGw}
        />
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp}>
        <GlassCard padding={0}>
          <div style={tableHeadStyle}>
            <div>User</div>
            <div>Description</div>
            <div>Gateway</div>
            <div style={{ textAlign: "right" }}>Amount</div>
            <div style={{ textAlign: "right" }}>Balance</div>
            <div style={{ textAlign: "right" }}>When</div>
          </div>

          {loading ? (
            <div style={{ padding: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="m4m-shimmer" style={{ height: 52, margin: "6px 8px", borderRadius: 10 }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: "#a0153c", fontSize: 13 }}>
              <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {error}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#999" }}>
              <Wallet style={{ width: 36, height: 36, color: "#e5e5e5", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 13, margin: 0 }}>{q ? `No transactions matching "${q}"` : "No transactions yet."}</p>
            </div>
          ) : (
            items.map((tx, i) => <TxRow key={tx.id} tx={tx} index={i} />)
          )}
        </GlassCard>
      </motion.div>

      {pageCount > 1 && (
        <motion.div variants={fadeUp} style={{ marginTop: 16, display: "flex", justifyContent: "center", alignItems: "center", gap: 10 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={paginationBtn(page <= 1)}>
            <ChevronLeft style={{ width: 14, height: 14 }} /> Prev
          </button>
          <span style={{ fontSize: 13, color: "#666" }}>
            Page <strong style={{ color: "#1a0a14" }}>{page}</strong> of {pageCount}
          </span>
          <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} style={paginationBtn(page >= pageCount)}>
            Next <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </motion.div>
      )}
    </PageShell>
  );
}

function TxRow({ tx, index }: { tx: PaymentRow; index: number }) {
  const isCredit = tx.amount >= 0;
  const amountStr = `${isCredit ? "+" : "−"}${formatRupees(Math.abs(tx.amount))}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.6, index * 0.02), duration: 0.28 }}
      style={tableRowStyle}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 10,
          background: isCredit ? "rgba(92,122,82,0.12)" : "rgba(220,30,60,0.08)",
          display: "grid", placeItems: "center", flexShrink: 0,
        }}>
          {isCredit
            ? <ArrowDownRight style={{ width: 14, height: 14, color: "#5C7A52" }} />
            : <ArrowUpRight   style={{ width: 14, height: 14, color: "#dc1e3c" }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#1a0a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.user_name}</div>
          <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.user_email || "—"}</div>
        </div>
      </div>

      <div style={{ fontSize: 12, color: "#555", minWidth: 0 }}>
        <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.description}</div>
        {tx.reference_id && <div style={{ fontSize: 10, color: "#aaa", fontFamily: "monospace" }}>{tx.reference_id}</div>}
      </div>

      <div>
        {tx.gateway ? (
          <span style={gatewayChip(tx.gateway)}>{tx.gateway}</span>
        ) : <span style={{ color: "#bbb", fontSize: 11 }}>—</span>}
      </div>

      <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: isCredit ? "#3F5937" : "#a0153c" }}>
        {amountStr}
      </div>

      <div style={{ textAlign: "right", fontSize: 12, color: "#666" }}>
        {tx.balance_after}
      </div>

      <div style={{ textAlign: "right", fontSize: 12, color: "#888" }}>
        {formatShort(tx.created_at)}
      </div>
    </motion.div>
  );
}

function FilterPills<T extends string>({
  layoutId, options, value, onChange,
}: {
  layoutId: string;
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 2, flexWrap: "wrap", background: "rgba(255,255,255,0.6)", padding: 3, borderRadius: 10, border: "1px solid rgba(220,30,60,0.08)", backdropFilter: "blur(6px)" }}>
      {options.map(({ key, label }) => {
        const active = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{ position: "relative", padding: "7px 12px", borderRadius: 8, border: "none", background: "transparent", fontSize: 12, fontWeight: active ? 600 : 500, color: active ? "#fff" : "#666", cursor: "pointer", zIndex: 1 }}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: "spring", stiffness: 380, damping: 28 }}
                style={{
                  position: "absolute", inset: 0,
                  background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(220,30,60,0.3)",
                  zIndex: -1,
                }}
              />
            )}
            {label}
          </button>
        );
      })}
    </div>
  );
}

function gatewayChip(gateway: string): React.CSSProperties {
  const palette: Record<string, { bg: string; fg: string }> = {
    razorpay: { bg: "rgba(50,80,180,0.10)",  fg: "#2544a8" },
    stripe:   { bg: "rgba(120,60,200,0.10)", fg: "#5d3a98" },
    upi:      { bg: "rgba(60,140,90,0.10)",  fg: "#3f7a55" },
  };
  const p = palette[gateway] || { bg: "rgba(0,0,0,0.05)", fg: "#666" };
  return {
    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
    padding: "4px 8px", borderRadius: 999, background: p.bg, color: p.fg,
  };
}

const searchBoxStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  background: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(220,30,60,0.12)",
  borderRadius: 12, padding: "9px 14px", width: 340, maxWidth: "100%",
  backdropFilter: "blur(8px)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
};

const searchInputStyle: React.CSSProperties = {
  flex: 1, border: "none", outline: "none",
  fontSize: 13.5, color: "#1a0a14", background: "transparent",
  fontFamily: "inherit",
};

const tableHeadStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.4fr) minmax(180px, 1.6fr) 100px 100px 80px 100px",
  gap: 14, padding: "14px 18px",
  borderBottom: "1px solid rgba(220,30,60,0.08)",
  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
  color: "#888",
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.4fr) minmax(180px, 1.6fr) 100px 100px 80px 100px",
  gap: 14, padding: "12px 18px",
  borderBottom: "1px solid rgba(220,30,60,0.04)",
  alignItems: "center",
};

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "8px 14px", borderRadius: 10,
    background: disabled ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.85)",
    border: `1px solid ${disabled ? "rgba(0,0,0,0.05)" : "rgba(220,30,60,0.12)"}`,
    fontSize: 12, fontWeight: 600,
    color: disabled ? "#bbb" : "#1a0a14",
    cursor: disabled ? "not-allowed" : "pointer",
    backdropFilter: "blur(6px)",
  };
}
