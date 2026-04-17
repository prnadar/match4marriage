"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Search, X, Loader2, ChevronLeft, ChevronRight, AlertTriangle, Users as UsersIcon } from "lucide-react";
import { PageShell } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";

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
  { key: "pending",   label: "Pending verification" },
  { key: "verified",  label: "Verified" },
  { key: "suspended", label: "Suspended" },
  { key: "deleted",   label: "Deleted" },
];

export default function AdminUsersPage() {
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 300);
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

  // Reset to page 1 when filter or query changes
  useEffect(() => { setPage(1); }, [filter, q]);

  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <PageShell
      title="Users"
      subtitle={`${total.toLocaleString()} user${total === 1 ? "" : "s"}`}
    >
      {/* Search + filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "#fff", border: "1px solid rgba(220,30,60,0.15)",
          borderRadius: 10, padding: "8px 12px", width: 360, maxWidth: "100%",
        }}>
          <Search style={{ width: 16, height: 16, color: "#aaa" }} />
          <input
            type="text"
            placeholder="Search name, email, phone…"
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, color: "#1a0a14", background: "transparent" }}
          />
          {qLive && (
            <button onClick={() => setQLive("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#aaa" }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {FILTERS.map(({ key, label }) => {
            const active = filter === key;
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{
                  padding: "7px 12px", borderRadius: 8, border: "none",
                  background: active ? "rgba(220,30,60,0.08)" : "transparent",
                  color: active ? "#dc1e3c" : "#666",
                  fontWeight: active ? 600 : 500,
                  fontSize: 13, cursor: "pointer",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{
        background: "#fff", border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: 12, overflow: "hidden",
      }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "minmax(220px, 2fr) minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(120px, 0.8fr) minmax(110px, 0.8fr) minmax(100px, 0.7fr)",
          background: "#fafafa",
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          padding: "10px 16px",
          fontSize: 11, fontWeight: 700, color: "#888", textTransform: "uppercase", letterSpacing: "0.06em",
        }}>
          <div>User</div>
          <div>Contact</div>
          <div>Location</div>
          <div>Status</div>
          <div>Trust</div>
          <div>Joined</div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
            <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite", margin: "0 auto 10px", display: "block" }} />
            Loading…
          </div>
        ) : error ? (
          <div style={{ padding: 20, background: "#ffe9ec", color: "#7B2D3A", fontSize: 13 }}>
            <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
            {error}
          </div>
        ) : items.length === 0 ? (
          <div style={{ padding: "50px 20px", textAlign: "center", color: "#999" }}>
            <UsersIcon style={{ width: 32, height: 32, color: "#ddd", margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 13, margin: 0 }}>{q ? `No users matching "${q}"` : "No users in this category."}</p>
          </div>
        ) : (
          items.map((u) => <UserRow key={u.id} user={u} />)
        )}
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div style={{ marginTop: 16, display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            style={paginationBtn(page <= 1)}
          >
            <ChevronLeft style={{ width: 14, height: 14 }} /> Prev
          </button>
          <span style={{ fontSize: 13, color: "#666" }}>
            Page {page} of {pageCount}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            disabled={page >= pageCount}
            style={paginationBtn(page >= pageCount)}
          >
            Next <ChevronRight style={{ width: 14, height: 14 }} />
          </button>
        </div>
      )}

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PageShell>
  );
}

function UserRow({ user }: { user: AdminUserRow }) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "(unnamed)";
  const location = [user.city, user.country].filter(Boolean).join(", ") || "—";
  const joined = user.created_at ? formatShort(user.created_at) : "—";

  return (
    <Link
      href={`/admin/users/${user.id}`}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 2fr) minmax(180px, 1.5fr) minmax(130px, 1fr) minmax(120px, 0.8fr) minmax(110px, 0.8fr) minmax(100px, 0.7fr)",
        padding: "12px 16px",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        alignItems: "center",
        textDecoration: "none", color: "inherit",
        transition: "background 0.12s",
      }}
      onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.background = "rgba(220,30,60,0.025)"}
      onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.background = "transparent"}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: user.primary_photo_url
            ? `center / cover no-repeat url(${user.primary_photo_url})`
            : "linear-gradient(135deg,#dc1e3c,#a0153c)",
          color: "#fff", fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {!user.primary_photo_url && (name[0]?.toUpperCase() || "?")}
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

      <div>
        <StatusChip user={user} />
      </div>

      <div>
        <TrustBar value={user.trust_score} />
      </div>

      <div style={{ fontSize: 12, color: "#888" }}>{joined}</div>
    </Link>
  );
}

function StatusChip({ user }: { user: AdminUserRow }) {
  let label = "Active";
  let color = "#5C7A52"; let bg = "rgba(92,122,82,0.12)";
  if (user.deleted_at) { label = "Deleted"; color = "#666"; bg = "rgba(0,0,0,0.06)"; }
  else if (!user.is_active) { label = "Suspended"; color = "#a0153c"; bg = "rgba(220,30,60,0.08)"; }
  else if (user.verification_status === "approved") { label = "Verified"; color = "#1e4bc8"; bg = "rgba(30,75,200,0.06)"; }
  else if (user.verification_status === "submitted") { label = "Pending"; color = "#9A6B00"; bg = "rgba(200,144,32,0.12)"; }
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      padding: "3px 8px", borderRadius: 999, background: bg, color,
    }}>{label}</span>
  );
}

function TrustBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, background: "rgba(0,0,0,0.06)", borderRadius: 3, overflow: "hidden", minWidth: 40 }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: pct >= 60 ? "#5C7A52" : pct >= 40 ? "#C89020" : "#dc1e3c",
        }} />
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

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "7px 12px", borderRadius: 8,
    background: "#fff", border: "1px solid rgba(220,30,60,0.15)",
    color: disabled ? "#ccc" : "#1a0a14",
    fontSize: 13, fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 4,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.5 : 1,
  };
}
