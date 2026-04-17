"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, ChevronLeft, ChevronRight, AlertTriangle, Users as UsersIcon,
  Download, UserX, UserCheck,
} from "lucide-react";
import { PageShell, GlassCard, Button, fadeUp } from "@/components/admin/PageShell";
import { useToast } from "@/components/admin/Toast";
import { adminApi, ApiError, downloadCsv } from "@/lib/api";

interface AdminUserRow {
  id: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  deleted_at: string | null;
  trust_score: number;
  completeness_score: number;
  verification_status: string;
  subscription_tier: string;
  first_name: string;
  last_name: string;
  city: string | null;
  country: string | null;
  religion: string | null;
  occupation: string | null;
  primary_photo_url: string | null;
  created_at: string | null;
  last_active_at: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
}

type Filter = "all" | "active" | "suspended" | "deleted" | "verified" | "pending";

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all",       label: "All" },
  { key: "active",    label: "Active" },
  { key: "pending",   label: "Pending" },
  { key: "verified",  label: "Verified" },
  { key: "suspended", label: "Suspended" },
  { key: "deleted",   label: "Deleted" },
];

export default function AdminUsersPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 250);
    return () => clearTimeout(t);
  }, [qLive]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listUsers({
        q: q || undefined,
        status_filter: filter === "all" ? undefined : filter,
        page,
        limit,
      });
      const payload = res.data as any;
      setItems(Array.isArray(payload?.items) ? payload.items : []);
      setTotal(typeof payload?.total === "number" ? payload.total : 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q, filter, page, limit]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [filter, q]);
  useEffect(() => { setSelected(new Set()); }, [filter, q, page]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  const allOnPageSelected = items.length > 0 && items.every((u) => selected.has(u.id));
  const someOnPageSelected = !allOnPageSelected && items.some((u) => selected.has(u.id));

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) {
      items.forEach((u) => next.delete(u.id));
    } else {
      items.forEach((u) => next.add(u.id));
    }
    setSelected(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const runBulk = async (action: "suspend" | "activate") => {
    if (busy || selected.size === 0) return;
    if (!confirm(`${action === "suspend" ? "Suspend" : "Activate"} ${selected.size} user${selected.size === 1 ? "" : "s"}?`)) return;
    setBusy(true);
    try {
      const res = await adminApi.bulkUserAction(action, Array.from(selected));
      const data = (res.data as any)?.data;
      toast("success", `${action === "suspend" ? "Suspended" : "Activated"} ${data?.affected ?? 0} user${data?.affected === 1 ? "" : "s"}`);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      toast("error", e?.message || "Bulk action failed");
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    const url = adminApi.exportUsersCsvUrl({
      q: q || undefined,
      status_filter: filter === "all" ? undefined : filter,
    });
    downloadCsv(url, "users.csv").catch((e: any) => toast("error", e?.message || "Export failed"));
  };

  return (
    <PageShell
      title="Users"
      subtitle={`${total.toLocaleString()} user${total === 1 ? "" : "s"} · tenant scoped`}
      actions={
        <Button variant="secondary" onClick={exportCsv}>
          <Download style={{ width: 13, height: 13 }} /> Export CSV
        </Button>
      }
    >
      {/* Search + filters */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={searchBoxStyle}>
          <Search style={{ width: 15, height: 15, color: "#aaa" }} />
          <input
            type="text"
            placeholder="Search name, email, phone…"
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
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{ position: "relative", padding: "7px 14px", borderRadius: 8, border: "none", background: "transparent", fontSize: 12, fontWeight: active ? 600 : 500, color: active ? "#fff" : "#666", cursor: "pointer", zIndex: 1 }}
              >
                {active && (
                  <motion.span
                    layoutId="user-filter-pill"
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
            <div style={{ display: "grid", placeItems: "center" }}>
              <input
                type="checkbox"
                checked={allOnPageSelected}
                ref={(el) => { if (el) el.indeterminate = someOnPageSelected; }}
                onChange={togglePage}
                aria-label="Select all on page"
                style={{ accentColor: "#dc1e3c", cursor: "pointer" }}
              />
            </div>
            <div>User</div>
            <div>Contact</div>
            <div>Location</div>
            <div>Status</div>
            <div>Trust</div>
            <div>Joined</div>
          </div>

          {loading ? (
            <div style={{ padding: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="m4m-shimmer" style={{ height: 58, margin: "6px 8px", borderRadius: 10 }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: "#a0153c", fontSize: 13 }}>
              <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {error}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#999" }}>
              <UsersIcon style={{ width: 36, height: 36, color: "#e5e5e5", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 13, margin: 0 }}>{q ? `No users matching "${q}"` : "No users in this category."}</p>
            </div>
          ) : (
            items.map((u, i) => (
              <UserRow
                key={u.id}
                user={u}
                index={i}
                checked={selected.has(u.id)}
                onToggle={() => toggleOne(u.id)}
              />
            ))
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

      {/* Sticky bulk-action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            style={{
              position: "fixed",
              bottom: 24, left: "50%", transform: "translateX(-50%)",
              zIndex: 900,
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "10px 16px",
              background: "rgba(26,10,20,0.96)",
              borderRadius: 999,
              boxShadow: "0 14px 38px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.06) inset",
              backdropFilter: "blur(10px)",
              fontFamily: "var(--font-poppins, sans-serif)",
            }}
          >
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
              {selected.size} selected
            </span>
            <span style={{ width: 1, height: 18, background: "rgba(255,255,255,0.14)" }} />
            <button
              onClick={() => runBulk("activate")}
              disabled={busy}
              style={bulkBtn("good")}
            >
              <UserCheck style={{ width: 13, height: 13 }} /> Activate
            </button>
            <button
              onClick={() => runBulk("suspend")}
              disabled={busy}
              style={bulkBtn("bad")}
            >
              <UserX style={{ width: 13, height: 13 }} /> Suspend
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={busy}
              aria-label="Clear selection"
              style={{
                background: "transparent", border: "none", padding: 6, marginLeft: 2,
                color: "rgba(255,255,255,0.6)", cursor: "pointer", display: "grid", placeItems: "center",
              }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

function bulkBtn(tone: "good" | "bad"): React.CSSProperties {
  const palette = tone === "good"
    ? { bg: "rgba(92,122,82,0.22)", fg: "#a8d090", border: "rgba(92,122,82,0.4)" }
    : { bg: "rgba(220,30,60,0.22)", fg: "#ff98ae", border: "rgba(220,30,60,0.4)" };
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "7px 13px", borderRadius: 999,
    background: palette.bg, border: `1px solid ${palette.border}`,
    color: palette.fg,
    fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

function UserRow({
  user, index, checked, onToggle,
}: {
  user: AdminUserRow; index: number; checked: boolean; onToggle: () => void;
}) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "(unnamed)";
  const location = [user.city, user.country].filter(Boolean).join(", ") || "—";
  const joined = user.created_at ? formatShort(user.created_at) : "—";
  const ring = user.verification_status === "approved"
    ? "linear-gradient(135deg, #8DB870, #5C7A52)"
    : user.verification_status === "submitted"
    ? "linear-gradient(135deg, #E8C04B, #C89020)"
    : "linear-gradient(135deg, #dc1e3c, #a0153c)";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(0.6, index * 0.02), duration: 0.28 }}
    >
      <Link
        href={`/admin/users/${user.id}`}
        style={{
          ...tableRowStyle,
          background: checked ? "rgba(220,30,60,0.04)" : "transparent",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          if (!checked) el.style.background = "rgba(220,30,60,0.03)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget as HTMLAnchorElement;
          el.style.background = checked ? "rgba(220,30,60,0.04)" : "transparent";
        }}
      >
        {/* Selection checkbox — stops propagation so it doesn't navigate. */}
        <div
          style={{ display: "grid", placeItems: "center" }}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
        >
          <input
            type="checkbox"
            checked={checked}
            onChange={() => onToggle()}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Select ${name}`}
            style={{ accentColor: "#dc1e3c", cursor: "pointer" }}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{ width: 40, height: 40, padding: 2, borderRadius: "50%", background: ring, flexShrink: 0 }}>
            <div style={{
              width: "100%", height: "100%", borderRadius: "50%",
              background: user.primary_photo_url
                ? `center / cover no-repeat url(${user.primary_photo_url})`
                : "linear-gradient(135deg,#dc1e3c,#a0153c)",
              color: "#fff", fontSize: 13, fontWeight: 700,
              display: "grid", placeItems: "center",
              border: "2px solid #fff",
            }}>
              {!user.primary_photo_url && (name[0]?.toUpperCase() || "?")}
            </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a0a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
            <div style={{ fontSize: 11, color: "#888", textTransform: "capitalize" }}>
              {user.religion || "—"}{user.occupation ? ` · ${user.occupation}` : ""}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 12, color: "#555", overflow: "hidden" }}>
          {user.email ? (
            <div title={user.email} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
              {user.is_email_verified && <span title="Email verified" style={{ color: "#5C7A52", marginLeft: 4 }}>✓</span>}
            </div>
          ) : null}
          {user.phone ? (
            <div style={{ color: "#888" }}>
              {user.phone}
              {user.is_phone_verified && <span title="Phone verified" style={{ color: "#5C7A52", marginLeft: 4 }}>✓</span>}
            </div>
          ) : null}
          {!user.email && !user.phone && <span>—</span>}
        </div>

        <div style={{ fontSize: 12, color: "#666" }}>{location}</div>

        <div><StatusChip user={user} /></div>

        <div><TrustBar value={user.trust_score} /></div>

        <div style={{ fontSize: 12, color: "#888" }}>{joined}</div>
      </Link>
    </motion.div>
  );
}

function StatusChip({ user }: { user: AdminUserRow }) {
  let label = "Active", color = "#3F5937", bg = "rgba(92,122,82,0.12)";
  if (user.deleted_at) { label = "Deleted"; color = "#666"; bg = "rgba(0,0,0,0.06)"; }
  else if (!user.is_active) { label = "Suspended"; color = "#a0153c"; bg = "rgba(220,30,60,0.08)"; }
  else if (user.verification_status === "approved") { label = "Verified"; color = "#2544a8"; bg = "rgba(90,120,230,0.08)"; }
  else if (user.verification_status === "submitted") { label = "Pending"; color = "#8A5F00"; bg = "rgba(200,144,32,0.14)"; }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
      padding: "4px 9px", borderRadius: 999, background: bg, color,
    }}>{label}</span>
  );
}

function TrustBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 60 ? "#5C7A52" : pct >= 40 ? "#C89020" : "#dc1e3c";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ height: "100%", background: color }}
        />
      </div>
      <span style={{ fontSize: 11, color: "#666", fontWeight: 600, minWidth: 24, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function formatShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "today";
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
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
  gridTemplateColumns: "32px minmax(220px, 2fr) minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(120px, 0.8fr) minmax(110px, 0.8fr) minmax(100px, 0.7fr)",
  background: "rgba(26,10,20,0.03)",
  borderBottom: "1px solid rgba(0,0,0,0.05)",
  padding: "10px 18px",
  fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.08em",
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "32px minmax(220px, 2fr) minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(120px, 0.8fr) minmax(110px, 0.8fr) minmax(100px, 0.7fr)",
  padding: "12px 18px",
  borderBottom: "1px solid rgba(0,0,0,0.04)",
  alignItems: "center",
  textDecoration: "none", color: "inherit",
  transition: "background 0.12s",
};

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 14px", borderRadius: 10,
    background: "rgba(255,255,255,0.85)", border: "1px solid rgba(220,30,60,0.15)",
    color: disabled ? "#ccc" : "#1a0a14",
    fontSize: 13, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 4,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
    backdropFilter: "blur(6px)",
    fontFamily: "inherit",
  };
}
