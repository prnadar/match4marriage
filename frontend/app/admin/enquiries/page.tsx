"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Inbox, Mail, Phone,
  CheckCircle2, MessageSquareReply, Trash2, UserCheck, Download, RotateCcw, Reply,
} from "lucide-react";
import { PageShell, Button, fadeUp } from "@/components/admin/PageShell";
import { ErrorState, Pagination, TABLE_CARD } from "@/components/admin/primitives";
import {
  Segmented, SearchField, EmptyState, SkeletonRows, Pill, Kbd, relTime, formatDateTime, type Tone,
} from "@/components/admin/primitives";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { adminApi, ApiError, downloadCsv } from "@/lib/api";
import { usePersistentState, oneOf } from "../_lib/view-state";

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

const FILTER_KEYS = ["all", "new", "in_review", "responded", "closed"] as const;
type Filter = (typeof FILTER_KEYS)[number];

const STATUS_FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "new",       label: "New" },
  { value: "in_review", label: "In review" },
  { value: "responded", label: "Responded" },
  { value: "closed",    label: "Closed" },
  { value: "all",       label: "All" },
];

const STATUS_META: Record<Status, { label: string; tone: Tone }> = {
  new:       { label: "New",       tone: "brand" },
  in_review: { label: "In review", tone: "warn" },
  responded: { label: "Responded", tone: "good" },
  closed:    { label: "Closed",    tone: "neutral" },
};

const SOURCE_LABEL: Record<Source, string> = {
  contact_form:     "Contact form",
  landing:          "Landing page",
  profile_interest: "Profile interest",
  other:            "Other",
};

export default function AdminEnquiriesPage() {
  const { toast } = useToast();
  const [items, setItems] = useState<Enquiry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filter, setFilter] = usePersistentState<Filter>("enquiries.status", "new", oneOf(FILTER_KEYS));
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [counts, setCounts] = useState<Counts>({ new: 0, in_review: 0, responded: 0, closed: 0, total: 0 });
  const [exporting, setExporting] = useState(false);

  // Deep link from the ⌘K palette: /admin/enquiries?q=<email or name>.
  useEffect(() => {
    try {
      const pre = new URLSearchParams(window.location.search).get("q");
      if (pre) { setQLive(pre); setQ(pre); setFilter("all"); }
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      // Auto-select the first one when nothing's selected (or the selection left the list).
      setSelectedId((cur) => (list.length === 0 ? null : cur && list.some((e) => e.id === cur) ? cur : list[0].id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q, filter, page, limit]);

  useEffect(() => { load(); loadCounts(); }, [load, loadCounts]);
  useEffect(() => { setPage(1); }, [filter, q]);

  const selected = useMemo(() => items.find((e) => e.id === selectedId) || null, [items, selectedId]);
  const pageCount = Math.max(1, Math.ceil(total / limit));

  // j / k (or ↓ / ↑) moves through the inbox when focus isn't in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey || !items.length) return;
      const idx = items.findIndex((x) => x.id === selectedId);
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedId(items[Math.min(items.length - 1, idx + 1)].id);
      } else if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedId(items[Math.max(0, idx - 1)].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedId]);

  const onUpdated = (updated: Enquiry) => {
    setItems((prev) => prev.map((e) => e.id === updated.id ? updated : e));
    loadCounts();
  };
  const onDeleted = (id: string) => {
    setItems((prev) => prev.filter((e) => e.id !== id));
    setSelectedId(null);
    loadCounts();
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const url = adminApi.exportEnquiriesCsvUrl({
        q: q || undefined,
        status_filter: filter === "all" ? undefined : filter,
      });
      await downloadCsv(url, "enquiries.csv");
    } catch (e) {
      toast("error", e instanceof Error ? `Export failed: ${e.message}` : "Export failed");
    } finally {
      setExporting(false);
    }
  };

  const countFor = (k: Filter) => (k === "all" ? counts.total : counts[k] ?? 0);

  return (
    <PageShell
      title="Enquiries"
      subtitle="Leads from the contact form and landing pages. Reply, assign and close them here."
      meta={counts.new > 0 ? <Pill tone="brand" dot>{counts.new} new</Pill> : undefined}
      actions={
        <Button size="sm" onClick={exportCsv} loading={exporting} title="Exports every enquiry matching the current filters">
          <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <SearchField value={qLive} onChange={setQLive} placeholder="Search name, email, subject…" className="w-full sm:max-w-xs" />
          <div className="max-w-full overflow-x-auto">
            <Segmented<Filter>
              ariaLabel="Filter by status"
              layoutId="enq-status-pill"
              options={STATUS_FILTERS.map((f) => ({ ...f, count: countFor(f.value) }))}
              value={filter}
              onChange={setFilter}
            />
          </div>
        </div>
      }
    >
      <motion.div variants={fadeUp} className="grid items-start gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
        {/* Left: list */}
        <div className={TABLE_CARD}>
          {loading ? (
            <div className="p-3"><SkeletonRows rows={6} /></div>
          ) : error ? (
            <ErrorState title="Couldn't load enquiries" message={error} onRetry={load} />
          ) : items.length === 0 ? (
            <EmptyState
              icon={filter === "new" && !q ? CheckCircle2 : Inbox}
              title={q ? `No enquiries matching “${q}”` : filter === "new" ? "Inbox zero" : "No enquiries in this view"}
              description={q ? "Try a different name, email or subject." : filter === "new" ? "Every new lead has been picked up." : "Switch status to see other enquiries."}
            />
          ) : (
            <ul role="listbox" aria-label="Enquiries" className="flex flex-col p-1.5">
              {items.map((e) => (
                <ListRow key={e.id} e={e} selected={e.id === selectedId} onClick={() => setSelectedId(e.id)} />
              ))}
            </ul>
          )}

          {pageCount > 1 && <Pagination page={page} pageCount={pageCount} onPage={setPage} />}
          {!loading && items.length > 1 && (
            <div className="hidden items-center gap-1.5 border-t border-border/60 px-3 py-2 text-[11px] text-muted2-foreground lg:flex">
              <Kbd>j</Kbd><Kbd>k</Kbd> to move between enquiries
            </div>
          )}
        </div>

        {/* Right: detail panel */}
        <div className="rounded-xl border border-border/70 bg-card shadow-[var(--adm-shadow-card)]">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <DetailPane enquiry={selected} onUpdated={onUpdated} onDeleted={onDeleted} />
              </motion.div>
            ) : (
              <motion.div key="empty-detail" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <EmptyState icon={Inbox} title="Select an enquiry" description="Its message, contact details and notes appear here." />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </PageShell>
  );
}

// ─── List row ────────────────────────────────────────────────────────────────

function ListRow({ e, selected, onClick }: { e: Enquiry; selected: boolean; onClick: () => void }) {
  const meta = STATUS_META[e.status] || STATUS_META.new;
  return (
    <li role="option" aria-selected={selected}>
      <button
        type="button"
        onClick={onClick}
        className={`relative block w-full rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
          selected ? "bg-primary/[0.06]" : "hover:bg-secondary/50"
        }`}
      >
        {selected && <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-primary" />}
        <div className="mb-0.5 flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className={`truncate text-[13px] ${e.status === "new" ? "font-semibold" : "font-medium"} text-foreground`}>{e.name}</div>
            <div className="truncate text-[11.5px] text-muted2-foreground">{e.subject || e.email || e.phone || "—"}</div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className="text-[11px] text-muted2-foreground tabular-nums">{relTime(e.created_at)}</span>
            <Pill tone={meta.tone}>{meta.label}</Pill>
          </div>
        </div>
        <div className="truncate text-[12px] text-muted2-foreground">{e.message}</div>
      </button>
    </li>
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
  const { toast } = useToast();
  const [notes, setNotes] = useState(enquiry.admin_notes || "");
  const [saving, setSaving] = useState<null | "status" | "notes" | "delete" | "assign">(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Reset notes draft when the selected enquiry changes
  useEffect(() => { setNotes(enquiry.admin_notes || ""); setErr(null); }, [enquiry.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = STATUS_META[enquiry.status] || STATUS_META.new;

  const updateStatus = async (status: Status) => {
    if (saving) return;
    setSaving("status");
    setErr(null);
    try {
      const res = await adminApi.updateEnquiry(enquiry.id, { status });
      onUpdated((res.data as any)?.data);
      toast("success", `Marked ${STATUS_META[status].label.toLowerCase()}`);
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
      toast("success", "Assigned to you");
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
      toast("success", "Notes saved");
    } catch (e: any) {
      setErr(e?.message || "Could not save notes");
    } finally {
      setSaving(null);
    }
  };

  const remove = async () => {
    setConfirmDelete(false);
    if (saving) return;
    setSaving("delete");
    try {
      await adminApi.deleteEnquiry(enquiry.id);
      onDeleted(enquiry.id);
      toast("success", "Enquiry deleted");
    } catch (e: any) {
      setErr(e?.message || "Could not delete");
      setSaving(null);
    }
  };

  const replyHref = enquiry.email
    ? `mailto:${enquiry.email}?subject=${encodeURIComponent(`Re: ${enquiry.subject || "Your enquiry to Match4Marriage"}`)}`
    : null;

  return (
    <div className="p-5">
      {/* Header */}
      <div className="mb-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[18px] font-semibold text-foreground">{enquiry.name}</h2>
          <div className="mt-0.5 flex flex-wrap gap-x-2 text-[12px] text-muted2-foreground">
            <span className="tabular-nums">{formatDateTime(enquiry.created_at)}</span>
            <span aria-hidden>·</span>
            <span>{SOURCE_LABEL[enquiry.source] || enquiry.source}</span>
            {enquiry.assigned_admin_id && (<><span aria-hidden>·</span><span>Assigned</span></>)}
          </div>
        </div>
        <Pill tone={meta.tone}>{meta.label}</Pill>
      </div>

      {/* Contact info */}
      <div className="mb-4 mt-3 flex flex-wrap gap-2">
        {enquiry.email && (
          <a href={`mailto:${enquiry.email}`} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 text-[12px] font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <Mail className="h-3 w-3" aria-hidden /> {enquiry.email}
          </a>
        )}
        {enquiry.phone && (
          <a href={`tel:${enquiry.phone}`} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 text-[12px] font-medium text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
            <Phone className="h-3 w-3" aria-hidden /> {enquiry.phone}
          </a>
        )}
      </div>

      {/* Subject + message */}
      {enquiry.subject && <div className="mb-1.5 text-[13px] font-semibold text-foreground">{enquiry.subject}</div>}
      <div className="mb-5 whitespace-pre-wrap rounded-lg border border-border/70 bg-secondary/30 px-4 py-3 text-[13.5px] leading-relaxed text-foreground/90" style={{ maxWidth: "75ch" }}>
        {enquiry.message}
      </div>

      {err && (
        <ErrorState compact message={err} className="mb-4" />
      )}

      {/* Quick actions */}
      <div className="mb-5 flex flex-wrap gap-2">
        {replyHref && (
          <a
            href={replyHref}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary bg-primary px-3 text-[12.5px] font-medium text-primary-foreground hover:bg-[#C21933] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Reply className="h-3.5 w-3.5" aria-hidden /> Reply by email
          </a>
        )}
        {enquiry.status !== "in_review" && enquiry.status !== "closed" && (
          <Button size="sm" variant="secondary" onClick={() => updateStatus("in_review")} disabled={!!saving}>
            <UserCheck className="h-3.5 w-3.5" aria-hidden /> Mark in review
          </Button>
        )}
        {enquiry.status !== "responded" && enquiry.status !== "closed" && (
          <Button size="sm" variant="secondary" onClick={() => updateStatus("responded")} disabled={!!saving}>
            <MessageSquareReply className="h-3.5 w-3.5" aria-hidden /> Mark responded
          </Button>
        )}
        {enquiry.status !== "closed" ? (
          <Button size="sm" onClick={() => updateStatus("closed")} disabled={!!saving}>
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Close
          </Button>
        ) : (
          <Button size="sm" onClick={() => updateStatus("new")} disabled={!!saving}>
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reopen
          </Button>
        )}
        {!enquiry.assigned_admin_id && (
          <Button size="sm" variant="ghost" onClick={assignToMe} disabled={!!saving} loading={saving === "assign"}>
            Assign to me
          </Button>
        )}
        <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)} disabled={!!saving} className="ml-auto">
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
        </Button>
      </div>

      {/* Admin notes */}
      <div>
        <label htmlFor="enq-notes" className="mb-1.5 block text-[12px] font-medium text-muted2-foreground">Internal notes</label>
        <textarea
          id="enq-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes for the team. Never shown to the enquirer."
          rows={4}
          className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2.5 text-[13px] leading-relaxed text-foreground outline-none focus:border-primary/50 focus:ring-2 focus:ring-ring/20"
        />
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={saveNotes} disabled={!!saving || (notes === (enquiry.admin_notes || ""))} loading={saving === "notes"}>
            Save notes
          </Button>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete this enquiry?"
        message={`The enquiry from ${enquiry.name} will be removed from the inbox. This can't be undone from the console.`}
        confirmLabel="Delete enquiry"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
