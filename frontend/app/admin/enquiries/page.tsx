"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, AlertTriangle, Inbox, Mail, Phone, ChevronLeft, ChevronRight,
  CheckCircle2, MessageSquareReply, Trash2, UserCheck, Download,
} from "lucide-react";
import { PageShell, GlassCard, Button, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError, downloadCsv } from "@/lib/api";

type Status = "new" | "in_review" | "responded" | "closed";
type Source = "contact_form" | "landing" | "profile_interest" | "other";

interface Enquiry {
  id: string;
  source: Source;
  status: Status;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  assigned_admin_id: string | null;
  admin_notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
}

interface Counts {
  new: number; in_review: number; responded: number; closed: number; total: number;
}

const STATUS_FILTERS: Array<{ key: "all" | Status; label: string }> = [
  { key: "all",       label: "All" },
  { key: "new",       label: "New" },
  { key: "in_review", label: "In review" },
  { key: "responded", label: "Responded" },
  { key: "closed",    label: "Closed" },
];

const STATUS_META: Record<Status, { label: string; color: string; bg: string }> = {
  new:       { label: "New",       color: "#a0153c", bg: "rgba(220,30,60,0.1)" },
  in_review: { label: "In review", color: "#8A5F00", bg: "rgba(200,144,32,0.16)" },
  responded: { label: "Responded", color: "#3F5937", bg: "rgba(92,122,82,0.14)" },
  closed:    { label: "Closed",    color: "#666",    bg: "rgba(0,0,0,0.06)" },
};

const SOURCE_LABEL: Record<Source, string> = {
  contact_form:     "Contact form",
  landing:          "Landing page",
  profile_interest: "Profile interest",
  other:            "Other",
};

function formatRel(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatFull(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminEnquiriesPage() {
  const [items, setItems] = useState<Enquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filter, setFilter] = useState<"all" | Status>("all");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({ new: 0, in_review: 0, responded: 0, closed: 0, total: 0 });

  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 250);
    return () => clearTimeout(t);
  }, [qLive]);

  const loadCounts = useCallback(async () => {
    try {
      const res = await adminApi.enquiryCounts();
      const c = (res.data as any)?.data;
      if (c) setCounts(c);
    } catch { /* non-fatal */ }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listEnquiries({
        q: q || undefined,
        status_filter: filter === "all" ? undefined : filter,
        page,
        limit,
      });
      const payload = res.data as any;
      const list: Enquiry[] = Array.isArray(payload?.data) ? payload.data : [];
      setItems(list);
      setTotal(typeof payload?.total === "number" ? payload.total : 0);
      // Auto-select the first one when nothing's selected (or when current selection is no longer in the list).
      if (list.length > 0) {
        if (!selectedId || !list.some((e) => e.id === selectedId)) {
          setSelectedId(list[0].id);
        }
      } else {
        setSelectedId(null);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    // selectedId intentionally not in deps — we update it inside, don't react to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter, page, limit]);

  useEffect(() => { load(); loadCounts(); }, [load, loadCounts]);
  useEffect(() => { setPage(1); }, [filter, q]);

  const selected = useMemo(() => items.find((e) => e.id === selectedId) || null, [items, selectedId]);
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const onUpdated = (updated: Enquiry) => {
    setItems((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    loadCounts();
  };
  const onDeleted = (id: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id));
    setSelectedId(null);
    loadCounts();
  };

  return (
    <PageShell
      title="Enquiries"
      subtitle={`${counts.total.toLocaleString()} lead${counts.total === 1 ? "" : "s"} · ${counts.new} new`}
      actions={
        <Button
          variant="secondary"
          onClick={() => {
            const url = adminApi.exportEnquiriesCsvUrl({
              q: q || undefined,
              status_filter: filter === "all" ? undefined : filter,
            });
            downloadCsv(url, "enquiries.csv").catch(() => {});
          }}
        >
          <Download style={{ width: 13, height: 13 }} /> Export CSV
        </Button>
      }
    >
      {/* Search + status filter pills with counts */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <div style={searchBoxStyle}>
          <Search style={{ width: 15, height: 15, color: "#aaa" }} />
          <input
            type="text"
            placeholder="Search name, email, subject…"
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
            const active = filter === key;
            const count = key === "all" ? counts.total : (counts[key as Status] ?? 0);
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                style={{ position: "relative", padding: "7px 14px", borderRadius: 8, border: "none", background: "transparent", fontSize: 12, fontWeight: active ? 600 : 500, color: active ? "#fff" : "#666", cursor: "pointer", zIndex: 1, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                {active && (
                  <motion.span
                    layoutId="enq-status-pill"
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
                {count > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    padding: "1px 6px", borderRadius: 999,
                    background: active ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.06)",
                    color: active ? "#fff" : "#888",
                  }}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Dual-pane layout */}
      <motion.div
        variants={fadeUp}
        style={{ display: "grid", gridTemplateColumns: "minmax(280px, 360px) minmax(0, 1fr)", gap: 14, alignItems: "start" }}
        className="enq-grid"
      >
        {/* Left: list */}
        <GlassCard padding={0}>
          {loading ? (
            <div style={{ padding: 10 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="m4m-shimmer" style={{ height: 70, margin: "6px 8px", borderRadius: 10 }} />
              ))}
            </div>
          ) : error ? (
            <div style={{ padding: 20, color: "#a0153c", fontSize: 13 }}>
              <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
              {error}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#999" }}>
              <Inbox style={{ width: 36, height: 36, color: "#e5e5e5", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 13, margin: 0 }}>{q ? `No enquiries matching "${q}"` : "No enquiries in this view."}</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", padding: 6 }}>
              {items.map((e, i) => (
                <ListRow
                  key={e.id}
                  e={e}
                  selected={e.id === selectedId}
                  index={i}
                  onClick={() => setSelectedId(e.id)}
                />
              ))}
            </div>
          )}

          {pageCount > 1 && (
            <div style={{ padding: "10px 12px", display: "flex", justifyContent: "center", alignItems: "center", gap: 8, borderTop: "1px solid rgba(220,30,60,0.06)" }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={paginationBtn(page <= 1)}>
                <ChevronLeft style={{ width: 13, height: 13 }} />
              </button>
              <span style={{ fontSize: 12, color: "#666" }}>
                {page} / {pageCount}
              </span>
              <button onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount} style={paginationBtn(page >= pageCount)}>
                <ChevronRight style={{ width: 13, height: 13 }} />
              </button>
            </div>
          )}
        </GlassCard>

        {/* Right: detail panel */}
        <GlassCard padding={0}>
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
              >
                <DetailPane enquiry={selected} onUpdated={onUpdated} onDeleted={onDeleted} />
              </motion.div>
            ) : (
              <motion.div
                key="empty-detail"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                style={{ padding: "80px 24px", textAlign: "center", color: "#aaa" }}
              >
                <Inbox style={{ width: 36, height: 36, color: "#e5e5e5", margin: "0 auto 12px", display: "block" }} />
                <p style={{ fontSize: 13, margin: 0 }}>Select an enquiry to view details.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      </motion.div>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.enq-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </PageShell>
  );
}

// ─── List row ────────────────────────────────────────────────────────────────

function ListRow({ e, selected, index, onClick }: { e: Enquiry; selected: boolean; index: number; onClick: () => void }) {
  const meta = STATUS_META[e.status];
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(0.4, index * 0.02), duration: 0.25 }}
      onClick={onClick}
      style={{
        position: "relative",
        display: "block", textAlign: "left", width: "100%",
        background: selected ? "rgba(220,30,60,0.06)" : "transparent",
        border: "none",
        borderRadius: 10,
        padding: "10px 12px",
        cursor: "pointer",
        transition: "background 0.15s",
        fontFamily: "inherit",
      }}
      onMouseEnter={(ev) => { if (!selected) (ev.currentTarget as HTMLButtonElement).style.background = "rgba(220,30,60,0.03)"; }}
      onMouseLeave={(ev) => { if (!selected) (ev.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
    >
      {selected && (
        <motion.span
          layoutId="enq-row-marker"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
          style={{
            position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
            background: "linear-gradient(180deg, #dc1e3c, #a0153c)",
            borderRadius: 2,
          }}
        />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 4 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: "#1a0a14",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{e.name}</div>
          <div style={{ fontSize: 11, color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {e.subject || e.email || e.phone || "—"}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: "#aaa" }}>{formatRel(e.created_at)}</span>
          <span style={{
            fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "2px 7px", borderRadius: 999,
            background: meta.bg, color: meta.color,
          }}>{meta.label}</span>
        </div>
      </div>
      <div style={{
        fontSize: 12, color: "#666",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
      }}>{e.message}</div>
    </motion.button>
  );
}

// ─── Detail pane ─────────────────────────────────────────────────────────────

function DetailPane({
  enquiry, onUpdated, onDeleted,
}: {
  enquiry: Enquiry;
  onUpdated: (e: Enquiry) => void;
  onDeleted: (id: string) => void;
}) {
  const [notes, setNotes] = useState(enquiry.admin_notes || "");
  const [saving, setSaving] = useState<null | "status" | "notes" | "delete" | "assign">(null);
  const [err, setErr] = useState<string | null>(null);

  // Reset notes draft when the selected enquiry changes
  useEffect(() => { setNotes(enquiry.admin_notes || ""); setErr(null); }, [enquiry.id]);

  const meta = STATUS_META[enquiry.status];

  const updateStatus = async (status: Status) => {
    if (saving) return;
    setSaving("status");
    setErr(null);
    try {
      const res = await adminApi.updateEnquiry(enquiry.id, { status });
      onUpdated((res.data as any)?.data);
    } catch (e: any) {
      setErr(e?.message || "Could not update status");
    } finally {
      setSaving(null);
    }
  };

  const assignToMe = async () => {
    if (saving) return;
    setSaving("assign");
    try {
      const res = await adminApi.updateEnquiry(enquiry.id, { assign_to_me: true });
      onUpdated((res.data as any)?.data);
    } catch (e: any) {
      setErr(e?.message || "Could not assign");
    } finally {
      setSaving(null);
    }
  };

  const saveNotes = async () => {
    if (saving) return;
    setSaving("notes");
    setErr(null);
    try {
      const res = await adminApi.updateEnquiry(enquiry.id, { admin_notes: notes || null });
      onUpdated((res.data as any)?.data);
    } catch (e: any) {
      setErr(e?.message || "Could not save notes");
    } finally {
      setSaving(null);
    }
  };

  const remove = async () => {
    if (saving) return;
    if (!confirm("Soft-delete this enquiry? It will stop appearing in the inbox.")) return;
    setSaving("delete");
    try {
      await adminApi.deleteEnquiry(enquiry.id);
      onDeleted(enquiry.id);
    } catch (e: any) {
      setErr(e?.message || "Could not delete");
      setSaving(null);
    }
  };

  return (
    <div style={{ padding: 22 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
        <div style={{ minWidth: 0 }}>
          <h2 style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 20, fontWeight: 700, color: "#1a0a14",
            margin: "0 0 4px", letterSpacing: "-0.01em",
          }}>{enquiry.name}</h2>
          <div style={{ fontSize: 11, color: "#888", display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span>{formatFull(enquiry.created_at)}</span>
            <span style={{ color: "#bbb" }}>·</span>
            <span>{SOURCE_LABEL[enquiry.source]}</span>
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
          padding: "4px 9px", borderRadius: 999,
          background: meta.bg, color: meta.color,
          flexShrink: 0,
        }}>{meta.label}</span>
      </div>

      {/* Contact info */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 14, marginBottom: 18 }}>
        {enquiry.email && (
          <a href={`mailto:${enquiry.email}`} style={contactPill}>
            <Mail style={{ width: 12, height: 12 }} />
            {enquiry.email}
          </a>
        )}
        {enquiry.phone && (
          <a href={`tel:${enquiry.phone}`} style={contactPill}>
            <Phone style={{ width: 12, height: 12 }} />
            {enquiry.phone}
          </a>
        )}
      </div>

      {/* Subject + message */}
      {enquiry.subject && (
        <div style={{
          fontSize: 13, fontWeight: 700, color: "#1a0a14",
          marginBottom: 6,
        }}>{enquiry.subject}</div>
      )}
      <div style={{
        padding: "14px 16px",
        background: "#fdfbf9",
        border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: 12,
        fontSize: 13.5, color: "#444", lineHeight: 1.6,
        whiteSpace: "pre-wrap",
        marginBottom: 20,
      }}>
        {enquiry.message}
      </div>

      {err && (
        <div style={{
          padding: "8px 12px", marginBottom: 14,
          background: "#ffe9ec", border: "1px solid rgba(220,30,60,0.18)",
          borderRadius: 8, fontSize: 12, color: "#a0153c",
        }}>{err}</div>
      )}

      {/* Quick actions */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
        {enquiry.status !== "in_review" && (
          <button onClick={() => updateStatus("in_review")} disabled={!!saving} style={actionBtn("warn")}>
            <UserCheck style={{ width: 13, height: 13 }} /> Mark in review
          </button>
        )}
        {enquiry.status !== "responded" && (
          <button onClick={() => updateStatus("responded")} disabled={!!saving} style={actionBtn("good")}>
            <MessageSquareReply style={{ width: 13, height: 13 }} /> Mark responded
          </button>
        )}
        {enquiry.status !== "closed" && (
          <button onClick={() => updateStatus("closed")} disabled={!!saving} style={actionBtn("muted")}>
            <CheckCircle2 style={{ width: 13, height: 13 }} /> Close
          </button>
        )}
        {enquiry.status === "closed" && (
          <button onClick={() => updateStatus("new")} disabled={!!saving} style={actionBtn("muted")}>
            Reopen
          </button>
        )}
        {!enquiry.assigned_admin_id && (
          <button onClick={assignToMe} disabled={!!saving} style={actionBtn("default")}>
            Assign to me
          </button>
        )}
        <button onClick={remove} disabled={!!saving} style={actionBtn("bad")}>
          <Trash2 style={{ width: 13, height: 13 }} /> Delete
        </button>
      </div>

      {/* Admin notes */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 600, color: "#555",
          textTransform: "uppercase", letterSpacing: "0.08em",
          marginBottom: 6,
        }}>Internal notes</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for the team — never shown to the user."
          rows={4}
          style={{
            width: "100%", boxSizing: "border-box",
            border: "1px solid rgba(220,30,60,0.15)", borderRadius: 10,
            padding: "10px 14px", fontSize: 13, lineHeight: 1.5, color: "#1a0a14",
            background: "#fff", outline: "none", fontFamily: "inherit", resize: "vertical",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
          <Button onClick={saveNotes} disabled={!!saving || (notes === (enquiry.admin_notes || ""))}>
            {saving === "notes" ? "Saving…" : "Save notes"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const searchBoxStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  background: "rgba(255,255,255,0.85)",
  border: "1px solid rgba(220,30,60,0.12)",
  borderRadius: 12, padding: "9px 14px", width: 300, maxWidth: "100%",
  backdropFilter: "blur(8px)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
};

const searchInputStyle: React.CSSProperties = {
  flex: 1, border: "none", outline: "none",
  fontSize: 13.5, color: "#1a0a14", background: "transparent",
  fontFamily: "inherit",
};

const contactPill: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6,
  padding: "6px 12px", borderRadius: 999,
  background: "rgba(220,30,60,0.06)", border: "1px solid rgba(220,30,60,0.12)",
  fontSize: 12, fontWeight: 500, color: "#a0153c",
  textDecoration: "none",
};

function actionBtn(tone: "default" | "good" | "warn" | "bad" | "muted"): React.CSSProperties {
  const palettes: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    default: { bg: "#fff",                   fg: "#1a0a14", border: "rgba(0,0,0,0.08)" },
    good:    { bg: "rgba(92,122,82,0.10)",   fg: "#3F5937", border: "rgba(92,122,82,0.25)" },
    warn:    { bg: "rgba(200,144,32,0.12)",  fg: "#8A5F00", border: "rgba(200,144,32,0.32)" },
    bad:     { bg: "rgba(220,30,60,0.06)",   fg: "#a0153c", border: "rgba(220,30,60,0.20)" },
    muted:   { bg: "rgba(0,0,0,0.04)",       fg: "#666",    border: "rgba(0,0,0,0.06)" },
  };
  const p = palettes[tone];
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "7px 12px", borderRadius: 8,
    background: p.bg, border: `1px solid ${p.border}`,
    fontSize: 12, fontWeight: 600, color: p.fg,
    cursor: "pointer", fontFamily: "inherit",
  };
}

function paginationBtn(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center",
    padding: 6, borderRadius: 8,
    background: disabled ? "rgba(0,0,0,0.03)" : "rgba(255,255,255,0.85)",
    border: `1px solid ${disabled ? "rgba(0,0,0,0.05)" : "rgba(220,30,60,0.12)"}`,
    color: disabled ? "#bbb" : "#1a0a14",
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
