"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Flag, CheckCircle2, XCircle, X, ArrowRight, Download, ShieldAlert } from "lucide-react";
import { PageShell, Button, fadeUp } from "@/components/admin/PageShell";
import { ErrorState, Select, TABLE_CARD } from "@/components/admin/primitives";
import {
  Segmented, SearchField, EmptyState, SkeletonRows, Pill, Panel, relTime, formatDateTime, type Tone,
} from "@/components/admin/primitives";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";
import { usePersistentState, oneOf, exportRowsToCsv } from "../_lib/view-state";

const FILTER_KEYS = ["all", "open", "under_review", "resolved_action_taken", "resolved_no_action", "dismissed"] as const;
type Filter = (typeof FILTER_KEYS)[number];

const TABS: Array<{ value: Filter; label: string }> = [
  { value: "open",                  label: "Open" },
  { value: "under_review",          label: "Under review" },
  { value: "resolved_action_taken", label: "Actioned" },
  { value: "resolved_no_action",    label: "No action" },
  { value: "dismissed",             label: "Dismissed" },
  { value: "all",                   label: "All" },
];

const STATUS_PILL: Record<string, { tone: Tone; label: string }> = {
  open:                  { tone: "bad",     label: "Open" },
  under_review:          { tone: "warn",    label: "Under review" },
  resolved_action_taken: { tone: "good",    label: "Actioned" },
  resolved_no_action:    { tone: "neutral", label: "No action" },
  dismissed:             { tone: "neutral", label: "Dismissed" },
};

// Categories that put a member at real risk jump the queue.
const HIGH_PRIORITY = new Set(["underage", "fraud", "scam", "harassment", "impersonation"]);

const ACTIONS: Array<{ value: string; label: string }> = [
  { value: "warning",         label: "Warning issued" },
  { value: "temp_suspension", label: "Temporary suspension" },
  { value: "permanent_ban",   label: "Permanent ban" },
  { value: "content_removed", label: "Content removed" },
  { value: "no_action",       label: "No action" },
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

const humanize = (s?: string | null) => (s || "").replace(/_/g, " ");
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function AdminReportsPage() {
  const { toast } = useToast();
  const [filter, setFilter] = usePersistentState<Filter>("reports.status", "open", oneOf(FILTER_KEYS));
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [all, setAll] = useState<ReportRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [notes, setNotes] = useState("");
  const [action, setAction] = useState("");
  const [busy, setBusy] = useState(false);

  // One fetch of the most recent 200 reports powers every tab + its count, so
  // switching tabs is instant and the counts are always in step.
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listReports({ limit: 200 });
      const payload = res.data as any;
      setAll(Array.isArray(payload?.data) ? payload.data : []);
      setTotal(typeof payload?.total === "number" ? payload.total : 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all.length };
    for (const r of all) c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, [all]);

  const categories = useMemo(
    () => Array.from(new Set(all.map((r) => r.category).filter(Boolean))).sort(),
    [all],
  );

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = all.filter((r) =>
      (filter === "all" || r.status === filter) &&
      (category === "all" || r.category === category) &&
      (!q || [r.reporter_name, r.reported_user_name, r.description, r.category].filter(Boolean).join(" ").toLowerCase().includes(q)),
    );
    // Open queues: high-priority categories first, then oldest first (FIFO).
    if (filter === "open" || filter === "under_review") {
      return [...list].sort((a, b) => {
        const pa = HIGH_PRIORITY.has(a.category) ? 0 : 1;
        const pb = HIGH_PRIORITY.has(b.category) ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.created_at || "").localeCompare(b.created_at || "");
      });
    }
    return list;
  }, [all, filter, category, search]);

  const open = (r: ReportRow) => {
    setSelected(r);
    setNotes(r.admin_notes || "");
    setAction(r.action_taken || "");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const resolve = async (status: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await adminApi.resolveReport(selected.id, {
        status,
        admin_notes: notes.trim() || undefined,
        action_taken: action.trim() || undefined,
      });
      toast("success", `Report marked ${STATUS_PILL[status]?.label.toLowerCase() || humanize(status)}`);
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

  const exportCsv = () => exportRowsToCsv<ReportRow>(
    `reports-${filter}.csv`,
    [
      { label: "Filed", value: (r) => r.created_at },
      { label: "Category", value: (r) => humanize(r.category) },
      { label: "Status", value: (r) => STATUS_PILL[r.status]?.label || r.status },
      { label: "Reporter", value: (r) => r.reporter_name },
      { label: "Reporter ID", value: (r) => r.reporter_id },
      { label: "Reported member", value: (r) => r.reported_user_name },
      { label: "Reported member ID", value: (r) => r.reported_user_id },
      { label: "Description", value: (r) => r.description },
      { label: "Action taken", value: (r) => r.action_taken },
      { label: "Admin notes", value: (r) => r.admin_notes },
      { label: "Resolved", value: (r) => r.resolved_at },
    ],
    items,
  );

  return (
    <PageShell
      title="Reports"
      subtitle={total > all.length
        ? `Member reports awaiting review. Showing the ${all.length} most recent of ${total.toLocaleString("en-GB")}.`
        : "Member reports awaiting review. High-risk categories are listed first."}
      meta={!loading && (counts.open || 0) > 0 ? <Pill tone="bad" dot>{counts.open} open</Pill> : undefined}
      actions={
        <Button size="sm" onClick={exportCsv} disabled={loading || items.length === 0} title="Exports the rows currently shown">
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <div className="max-w-full overflow-x-auto">
            <Segmented<Filter>
              ariaLabel="Filter by status"
              layoutId="report-tab-pill"
              options={TABS.map((t) => ({ ...t, count: loading ? null : counts[t.value] || 0 }))}
              value={filter}
              onChange={(v) => { setFilter(v); setSelected(null); }}
            />
          </div>
          <SearchField value={search} onChange={setSearch} placeholder="Search names or description…" className="w-full sm:max-w-xs" />
          <Select id="report-category" ariaLabel="Category" value={category} onChange={setCategory}>
            <option value="all">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{capitalize(humanize(c))}</option>)}
          </Select>
        </div>
      }
    >
      <motion.div variants={fadeUp} className={`grid items-start gap-4 ${selected ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : "grid-cols-1"}`}>
        {/* List */}
        <div className={TABLE_CARD}>
          {loading ? (
            <div className="p-3"><SkeletonRows rows={5} /></div>
          ) : error ? (
            <ErrorState title="Couldn't load reports" message={error} onRetry={load} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={filter === "open" ? CheckCircle2 : Flag}
              title={search || category !== "all" ? "No reports match these filters" : filter === "open" ? "No open reports" : "No reports in this view"}
              description={filter === "open" && !search && category === "all"
                ? "You're all caught up. New member reports land here first."
                : "Try another status tab or clear the search."}
            />
          ) : (
            <ul role="list">
              {items.map((r) => (
                <ReportRowEl key={r.id} report={r} active={selected?.id === r.id} onClick={() => open(r)} />
              ))}
            </ul>
          )}
        </div>

        {/* Detail panel */}
        <AnimatePresence mode="wait">
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="lg:sticky lg:top-20"
            >
              <Panel
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    Investigate
                    <Pill tone={STATUS_PILL[selected.status]?.tone || "neutral"}>{STATUS_PILL[selected.status]?.label || humanize(selected.status)}</Pill>
                    {HIGH_PRIORITY.has(selected.category) && <Pill tone="bad"><ShieldAlert className="h-3 w-3" aria-hidden />High priority</Pill>}
                  </span>
                }
                description={`Filed ${relTime(selected.created_at)}`}
                actions={
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    aria-label="Close report"
                    className="grid h-7 w-7 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <X className="h-4 w-4" />
                  </button>
                }
              >
                <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-3">
                  <ReportField label="Category">{capitalize(humanize(selected.category))}</ReportField>
                  <ReportField label="Action taken">{selected.action_taken ? capitalize(humanize(selected.action_taken)) : null}</ReportField>
                  <ReportField label="Reporter">
                    <Link href={`/admin/users/${selected.reporter_id}`} className="font-medium text-primary hover:underline">{selected.reporter_name}</Link>
                  </ReportField>
                  <ReportField label="Reported member">
                    <Link href={`/admin/users/${selected.reported_user_id}`} className="font-medium text-primary hover:underline">{selected.reported_user_name}</Link>
                  </ReportField>
                  <ReportField label="Filed">{formatDateTime(selected.created_at)}</ReportField>
                  <ReportField label="Resolved">{selected.resolved_at ? formatDateTime(selected.resolved_at) : null}</ReportField>
                </dl>

                {selected.description && (
                  <div className="mb-4">
                    <div className="text-[11.5px] font-medium text-muted2-foreground">Description</div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{selected.description}</p>
                  </div>
                )}

                {selected.evidence && selected.evidence.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11.5px] font-medium text-muted2-foreground">Evidence</div>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-[12.5px] text-foreground/80">
                      {selected.evidence.map((ev, i) => (
                        <li key={i} className="break-all">
                          {/^https?:\/\//.test(ev)
                            ? <a href={ev} target="_blank" rel="noreferrer noopener" className="text-primary hover:underline">{ev}</a>
                            : ev}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <label htmlFor="report-notes" className="text-[11.5px] font-medium text-muted2-foreground">Admin notes (internal)</label>
                <textarea
                  id="report-notes"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What you found, decisions taken…"
                  className="mt-1 w-full resize-y rounded-lg border border-border bg-card p-2.5 text-[13px] text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20"
                />

                <label htmlFor="report-action" className="mt-3 block text-[11.5px] font-medium text-muted2-foreground">Action taken</label>
                <select
                  id="report-action"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-card px-2.5 text-[13px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <option value="">—</option>
                  {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button onClick={() => resolve("resolved_action_taken")} disabled={busy} variant="primary">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Resolve · action taken
                  </Button>
                  <Button onClick={() => resolve("resolved_no_action")} disabled={busy} variant="secondary">
                    Resolve · no action
                  </Button>
                  <Button onClick={() => resolve("under_review")} disabled={busy} variant="warn">
                    Mark under review
                  </Button>
                  <Button onClick={() => resolve("dismissed")} disabled={busy} variant="ghost">
                    <XCircle className="h-3.5 w-3.5" aria-hidden /> Dismiss
                  </Button>
                </div>
              </Panel>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </PageShell>
  );
}

function ReportRowEl({ report, active, onClick }: { report: ReportRow; active: boolean; onClick: () => void }) {
  const st = STATUS_PILL[report.status] || { tone: "neutral" as Tone, label: humanize(report.status) };
  const high = HIGH_PRIORITY.has(report.category);
  const isOpen = report.status === "open" || report.status === "under_review";
  return (
    <li className="border-b border-border/40 last:border-0">
      <button
        type="button"
        onClick={onClick}
        aria-current={active || undefined}
        className={`w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:bg-secondary/60 ${active ? "bg-primary/[0.05]" : "hover:bg-secondary/40"}`}
      >
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-md border border-border/70 bg-secondary/60">
            <Flag className="h-3 w-3 text-primary" aria-hidden />
          </span>
          <span className="text-[13px] font-medium text-foreground">{capitalize(humanize(report.category))}</span>
          <Pill tone={st.tone}>{st.label}</Pill>
          {high && isOpen && <Pill tone="bad">High priority</Pill>}
          <span className="ml-auto text-[11.5px] text-muted2-foreground tabular-nums" title={formatDateTime(report.created_at)}>
            {relTime(report.created_at)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-muted2-foreground">
          <span className="font-medium text-foreground">{report.reporter_name}</span>
          <ArrowRight className="h-3 w-3" aria-label="reported" />
          <span className="font-medium text-foreground">{report.reported_user_name}</span>
        </div>
        {report.description && (
          <p className="mt-1 truncate text-[12px] text-muted2-foreground">{report.description}</p>
        )}
      </button>
    </li>
  );
}

function ReportField({ label, children }: { label: string; children: React.ReactNode }) {
  const empty = children === null || children === undefined || children === "";
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] font-medium text-muted2-foreground">{label}</dt>
      <dd className={`mt-0.5 truncate text-[13px] ${empty ? "text-muted2-foreground" : "text-foreground"}`}>{empty ? "—" : children}</dd>
    </div>
  );
}
