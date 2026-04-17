"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Search, X, ChevronLeft, ChevronRight, AlertTriangle,
  CreditCard, Crown,
} from "lucide-react";
import { PageShell, GlassCard, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";

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

type StatusFilter = "all" | "active" | "expiring" | "paused" | "past_due" | "cancelled" | "expired";

const STATUS_FILTERS: Array<{ key: StatusFilter; label: string }> = [
  { key: "all",       label: "All" },
  { key: "active",    label: "Active" },
  { key: "expiring",  label: "Expiring" },
  { key: "past_due",  label: "Past due" },
  { key: "paused",    label: "Paused" },
  { key: "cancelled", label: "Cancelled" },
  { key: "expired",   label: "Expired" },
];

const PLAN_META: Record<string, { color: string; gradient: string }> = {
  silver:   { color: "#7d8a93", gradient: "linear-gradient(90deg, #b8c2c8, #7d8a93)" },
  gold:     { color: "#c9954a", gradient: "linear-gradient(90deg, #f0c987, #c9954a)" },
  platinum: { color: "#5d4b8a", gradient: "linear-gradient(90deg, #9c87d3, #5d4b8a)" },
};

function formatRupees(paise: number): string {
  if (!Number.isFinite(paise) || paise === 0) return "₹0";
  const rupees = paise / 100;
  if (rupees >= 1_00_00_000) return `₹${(rupees / 1_00_00_000).toFixed(2)} Cr`;
  if (rupees >= 1_00_000) return `₹${(rupees / 1_00_000).toFixed(2)} L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}k`;
  return `₹${rupees.toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function daysUntil(iso: string | null): { label: string; tone: "ok" | "warn" | "bad" | "neutral" } {
  if (!iso) return { label: "—", tone: "neutral" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { label: "—", tone: "neutral" };
  const days = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (days < 0)  return { label: `${-days}d ago`, tone: "bad" };
  if (days === 0) return { label: "today", tone: "warn" };
  if (days <= 7)  return { label: `in ${days}d`, tone: "warn" };
  if (days <= 30) return { label: `in ${days}d`, tone: "ok" };
  return { label: `in ${days}d`, tone: "neutral" };
}

export default function AdminSubscriptionsPage() {
  const [items, setItems] = useState<SubscriptionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [status, setStatus] = useState<StatusFilter>("all");
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
              currency: "INR",
              current_period_start: null,
              current_period_end: r.current_period_end,
              cancelled_at: null,
              created_at: null,
            }))
          : [];
        // Apply client-side search to the small expiring list.
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

  return (
    <PageShell
      title="Subscriptions"
      subtitle={`${total.toLocaleString()} subscription${total === 1 ? "" : "s"}`}
    >
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

        <div style={{ display: "flex", gap: 2, flexWrap: "wrap", background: "rgba(255,255,255,0.6)", padding: 3, borderRadius: 10, border: "1px solid rgba(220,30,60,0.08)", backdropFilter: "blur(6px)" }}>
          {STATUS_FILTERS.map(({ key, label }) => {
            const active = status === key;
            return (
              <button
                key={key}
                onClick={() => setStatus(key)}
                style={{ position: "relative", padding: "7px 14px", borderRadius: 8, border: "none", background: "transparent", fontSize: 12, fontWeight: active ? 600 : 500, color: active ? "#fff" : "#666", cursor: "pointer", zIndex: 1 }}
              >
                {active && (
                  <motion.span
                    layoutId="subs-status-pill"
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
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp}>
        <GlassCard padding={0}>
          <div style={tableHeadStyle}>
            <div>User</div>
            <div>Plan</div>
            <div>Status</div>
            <div style={{ textAlign: "right" }}>Amount</div>
            <div>Period</div>
            <div style={{ textAlign: "right" }}>Renews</div>
          </div>

          {loading ? (
            <div style={{ padding: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="m4m-shimmer" style={{ height: 56, margin: "6px 8px", borderRadius: 10 }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: "#a0153c", fontSize: 13 }}>
              <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {error}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#999" }}>
              <CreditCard style={{ width: 36, height: 36, color: "#e5e5e5", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 13, margin: 0 }}>{q ? `No subscriptions matching "${q}"` : "No subscriptions in this category."}</p>
            </div>
          ) : (
            items.map((s, i) => <SubRow key={s.id} sub={s} index={i} />)
          )}
        </GlassCard>
      </motion.div>

      {pageCount > 1 && status !== "expiring" && (
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

function SubRow({ sub, index }: { sub: SubscriptionRow; index: number }) {
  const meta = PLAN_META[sub.plan] || { color: "#888", gradient: "" };
  const renews = daysUntil(sub.current_period_end);
  const renewColor = renews.tone === "bad"  ? "#a0153c"
                   : renews.tone === "warn" ? "#9A6B00"
                   : renews.tone === "ok"   ? "#3F5937"
                   : "#888";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.6, index * 0.02), duration: 0.28 }}
    >
      <Link
        href={`/admin/users/${sub.user_id}`}
        style={tableRowStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "rgba(220,30,60,0.03)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 10,
            background: `${meta.color}1a`,
            display: "grid", placeItems: "center", flexShrink: 0,
          }}>
            <Crown style={{ width: 14, height: 14, color: meta.color }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a0a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.user_name}</div>
            <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub.user_email || "—"}</div>
          </div>
        </div>

        <div>
          <span style={{
            fontSize: 11, fontWeight: 700, textTransform: "capitalize", letterSpacing: "0.04em",
            padding: "4px 10px", borderRadius: 999,
            background: `${meta.color}1f`, color: meta.color,
          }}>{sub.plan}</span>
          {sub.gateway && (
            <span style={{ marginLeft: 6, fontSize: 10, color: "#aaa", textTransform: "uppercase" }}>· {sub.gateway}</span>
          )}
        </div>

        <div><StatusChip status={sub.status} /></div>

        <div style={{ textAlign: "right", fontSize: 13, fontWeight: 700, color: "#1a0a14" }}>
          {formatRupees(sub.amount_paise)}
        </div>

        <div style={{ fontSize: 11, color: "#888" }}>
          {sub.current_period_start ? formatDate(sub.current_period_start) : "—"}
          <br />
          <span style={{ color: "#bbb" }}>→ {formatDate(sub.current_period_end)}</span>
        </div>

        <div style={{ textAlign: "right", fontSize: 12, fontWeight: 600, color: renewColor }}>
          {renews.label}
        </div>
      </Link>
    </motion.div>
  );
}

function StatusChip({ status }: { status: string }) {
  const palette: Record<string, { bg: string; fg: string; label: string }> = {
    active:    { bg: "rgba(92,122,82,0.12)",  fg: "#3F5937", label: "Active" },
    paused:    { bg: "rgba(140,140,140,0.12)", fg: "#666",   label: "Paused" },
    cancelled: { bg: "rgba(0,0,0,0.06)",       fg: "#666",   label: "Cancelled" },
    expired:   { bg: "rgba(220,30,60,0.06)",   fg: "#a0153c", label: "Expired" },
    past_due:  { bg: "rgba(200,144,32,0.14)",  fg: "#8A5F00", label: "Past due" },
  };
  const p = palette[status] || { bg: "rgba(0,0,0,0.05)", fg: "#666", label: status };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "4px 9px", borderRadius: 999, background: p.bg, color: p.fg,
    }}>{p.label}</span>
  );
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
  gridTemplateColumns: "minmax(180px, 1.4fr) 130px 110px 100px minmax(140px, 1fr) 90px",
  gap: 14, padding: "14px 18px",
  borderBottom: "1px solid rgba(220,30,60,0.08)",
  fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
  color: "#888",
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(180px, 1.4fr) 130px 110px 100px minmax(140px, 1fr) 90px",
  gap: 14, padding: "12px 18px",
  borderBottom: "1px solid rgba(220,30,60,0.04)",
  alignItems: "center",
  textDecoration: "none", color: "inherit",
  transition: "background 0.15s",
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
