"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Flag, Loader2, AlertTriangle, User, Calendar, Inbox, CheckCircle2, XCircle, X } from "lucide-react";
import { PageShell, Button } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";

type Filter = "all" | "open" | "under_review" | "resolved_action_taken" | "resolved_no_action" | "dismissed";

const TABS: Array<{ key: Filter; label: string }> = [
  { key: "all",                   label: "All" },
  { key: "open",                  label: "Open" },
  { key: "under_review",          label: "Under review" },
  { key: "resolved_action_taken", label: "Resolved (actioned)" },
  { key: "resolved_no_action",    label: "Resolved (no action)" },
  { key: "dismissed",             label: "Dismissed" },
];

interface ReportRow {
  id: string;
  category: string;
  status: string;
  description: string | null;
  evidence: string[];
  created_at: string | null;
  resolved_at: string | null;
  reporter_id: string;
  reporter_name: string;
  reported_user_id: string;
  reported_user_name: string;
  admin_id: string | null;
  admin_notes: string | null;
  action_taken: string | null;
}

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("open");
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listReports({
        status_filter: filter === "all" ? undefined : filter,
        limit: 200,
      });
      const payload = res.data as any;
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const resolve = async (status: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.resolveReport(selected.id, {
        status,
        admin_notes: notes.trim() || undefined,
        action_taken: action.trim() || undefined,
      });
      toast("success", "Report updated");
      setSelected(null);
      setNotes("");
      setAction("");
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Could not update");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PageShell title="Reports" subtitle="User reports that need admin review.">
      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
        {TABS.map(({ key, label }) => {
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

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 16, alignItems: "start" }}>

        {/* List */}
        <div style={{ background: "#fff", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 12, overflow: "hidden" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
              <Loader2 style={{ width: 20, height: 20, animation: "spin 1s linear infinite", margin: "0 auto 10px", display: "block" }} />
            </div>
          ) : error ? (
            <div style={{ padding: 20, background: "#ffe9ec", color: "#7B2D3A", fontSize: 13 }}>
              <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} /> {error}
            </div>
          ) : items.length === 0 ? (
            <div style={{ padding: "50px 20px", textAlign: "center", color: "#999" }}>
              <Inbox style={{ width: 32, height: 32, color: "#ddd", margin: "0 auto 12px", display: "block" }} />
              <p style={{ fontSize: 13, margin: 0 }}>No reports in this category.</p>
            </div>
          ) : items.map((r) => (
            <ReportRowEl key={r.id} report={r} active={selected?.id === r.id} onClick={() => { setSelected(r); setNotes(r.admin_notes || ""); setAction(r.action_taken || ""); }} />
          ))}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ background: "#fff", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 12, padding: 20, position: "sticky", top: 96 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1a0a14", margin: 0 }}>Investigate</h2>
              <button onClick={() => setSelected(null)} style={{ background: "rgba(0,0,0,0.04)", border: "none", borderRadius: 8, width: 28, height: 28, cursor: "pointer" }}>
                <X style={{ width: 14, height: 14, color: "#888" }} />
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <ReportField label="Category">{selected.category?.replace(/_/g, " ")}</ReportField>
              <ReportField label="Status">{selected.status?.replace(/_/g, " ")}</ReportField>
              <ReportField label="Reporter">
                <Link href={`/admin/users/${selected.reporter_id}`} style={linkStyle}>{selected.reporter_name}</Link>
              </ReportField>
              <ReportField label="Reported user">
                <Link href={`/admin/users/${selected.reported_user_id}`} style={linkStyle}>{selected.reported_user_name}</Link>
              </ReportField>
              <ReportField label="Filed">{selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}</ReportField>
              <ReportField label="Resolved">{selected.resolved_at ? new Date(selected.resolved_at).toLocaleString() : "—"}</ReportField>
            </div>

            {selected.description && (
              <>
                <div style={labelStyle}>Description</div>
                <p style={{ fontSize: 13, color: "#444", lineHeight: 1.5, marginTop: 4, marginBottom: 14, whiteSpace: "pre-wrap" }}>
                  {selected.description}
                </p>
              </>
            )}

            {selected.evidence && selected.evidence.length > 0 && (
              <>
                <div style={labelStyle}>Evidence</div>
                <ul style={{ fontSize: 12, color: "#666", marginTop: 4, marginBottom: 14, paddingLeft: 18 }}>
                  {selected.evidence.map((ev, i) => <li key={i}>{ev}</li>)}
                </ul>
              </>
            )}

            <div style={labelStyle}>Admin notes (internal)</div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What you found, decisions taken…"
              style={{ width: "100%", marginTop: 4, padding: 10, border: "1px solid rgba(220,30,60,0.15)", borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical" }}
            />

            <div style={{ ...labelStyle, marginTop: 10 }}>Action taken</div>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              style={{ width: "100%", marginTop: 4, padding: 10, border: "1px solid rgba(220,30,60,0.15)", borderRadius: 8, fontSize: 13, background: "#fff" }}
            >
              <option value="">—</option>
              <option value="warning">Warning issued</option>
              <option value="temp_suspension">Temporary suspension</option>
              <option value="permanent_ban">Permanent ban</option>
              <option value="content_removed">Content removed</option>
              <option value="no_action">No action</option>
            </select>

            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              <Button onClick={() => resolve("resolved_action_taken")} disabled={busy} variant="primary">
                <CheckCircle2 style={{ width: 13, height: 13 }} /> Resolve · action taken
              </Button>
              <Button onClick={() => resolve("resolved_no_action")} disabled={busy} variant="secondary">
                Resolve · no action
              </Button>
              <Button onClick={() => resolve("dismissed")} disabled={busy} variant="ghost">
                <XCircle style={{ width: 13, height: 13 }} /> Dismiss
              </Button>
              <Button onClick={() => resolve("under_review")} disabled={busy} variant="warn">
                Mark under review
              </Button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </PageShell>
  );
}

function ReportRowEl({ report, active, onClick }: { report: ReportRow; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        background: active ? "rgba(220,30,60,0.04)" : "transparent",
        border: "none",
        borderLeft: active ? "3px solid #dc1e3c" : "3px solid transparent",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
        padding: "14px 18px", cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <Flag style={{ width: 13, height: 13, color: "#dc1e3c" }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1a0a14", textTransform: "capitalize" }}>
          {report.category?.replace(/_/g, " ")}
        </span>
        <StatusBadge status={report.status} />
      </div>
      <div style={{ fontSize: 12, color: "#666" }}>
        <span style={{ color: "#1a0a14", fontWeight: 500 }}>{report.reporter_name}</span>
        <span style={{ margin: "0 6px", color: "#ccc" }}>→</span>
        <span style={{ color: "#1a0a14", fontWeight: 500 }}>{report.reported_user_name}</span>
      </div>
      {report.description && (
        <p style={{ fontSize: 12, color: "#888", margin: "6px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {report.description}
        </p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontSize: 11, color: "#aaa" }}>
        {report.created_at && (
          <span><Calendar style={{ width: 11, height: 11, display: "inline", verticalAlign: "text-bottom", marginRight: 3 }} />
            {new Date(report.created_at).toLocaleDateString()}
          </span>
        )}
      </div>
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    open:                  { bg: "rgba(220,30,60,0.10)", fg: "#a0153c", label: "Open" },
    under_review:          { bg: "rgba(200,144,32,0.12)", fg: "#9A6B00", label: "Under review" },
    resolved_action_taken: { bg: "rgba(92,122,82,0.14)",  fg: "#3F5937", label: "Actioned" },
    resolved_no_action:    { bg: "rgba(0,0,0,0.06)",      fg: "#666",    label: "No action" },
    dismissed:             { bg: "rgba(0,0,0,0.06)",      fg: "#666",    label: "Dismissed" },
  };
  const s = map[status] || { bg: "rgba(0,0,0,0.06)", fg: "#666", label: status };
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
      padding: "2px 7px", borderRadius: 999, background: s.bg, color: s.fg,
    }}>
      {s.label}
    </span>
  );
}

function ReportField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontSize: 13, color: "#1a0a14", marginTop: 3, textTransform: "capitalize" }}>{children || "—"}</div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 600, color: "#999", textTransform: "uppercase", letterSpacing: "0.06em",
};

const linkStyle: React.CSSProperties = {
  color: "#dc1e3c", textDecoration: "none", fontWeight: 500,
};
