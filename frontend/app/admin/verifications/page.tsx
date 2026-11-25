"use client";

/**
 * Verification queue — built for throughput.
 *
 *  · Pending queue is first-in-first-out (oldest first) with an SLA badge.
 *  · Side-by-side review: the profile on the left, ID documents + contact
 *    checks + review history on the right.
 *  · Keyboard: J/K or ↑/↓ move · A approve · R reject · I request info ·
 *    N next · X select · Esc close · ? help. After a decision the next
 *    profile opens automatically.
 *  · Bulk approve selected profiles; rejection / request-info presets.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle, BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, ExternalLink, FileText,
  GraduationCap, Heart, Image as ImageIcon, Inbox, Keyboard, Mail, MapPin, MessageSquare, Phone,
  ShieldCheck, User, X, XCircle,
} from "lucide-react";
import { PageShell, Button } from "@/components/admin/PageShell";
import {
  Avatar, EmptyState, Kbd, Pill, SearchField, Segmented, Skeleton, SkeletonRows,
  formatDateTime, hoursSince, relTime, waitingLabel, type Tone,
} from "@/components/admin/primitives";
import { describeAction } from "@/components/admin/audit-labels";
import { adminApi, adminOpsApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";
import { cn } from "@/lib/utils";

type Status = "draft" | "submitted" | "approved" | "rejected";
type Filter = "submitted" | "approved" | "rejected" | "all";

interface Profile {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  religion?: string | null;
  caste?: string | null;
  mother_tongue?: string | null;
  marital_status?: string | null;
  height_cm?: number | null;
  education_level?: string | null;
  education_field?: string | null;
  college?: string | null;
  occupation?: string | null;
  employer?: string | null;
  annual_income_inr?: number | null;
  bio?: string | null;
  about_family?: string | null;
  photos?: Array<{ url?: string | null; key?: string | null; is_primary?: boolean }> | null;
  completeness_score?: number | null;
  verification_status: string;
  rejection_reason?: string | null;
  last_rejection_reason?: string | null;
  submitted_at?: string | null;
  reviewed_at?: string | null;
  family_details?: Record<string, unknown> | null;
  partner_prefs?: Record<string, unknown> | null;
}

interface Review {
  user: {
    id: string; email: string | null; phone: string | null; membership_number: string | null;
    is_email_verified: boolean; is_phone_verified: boolean; created_at: string | null; last_active_at: string | null;
    subscription_tier: string; is_active: boolean; visa_status: string | null;
  };
  documents: Array<{
    id: string; type: string; status: string; doc_type: string | null; doc_country: string | null;
    doc_number_masked: string | null; front: { url: string } | null; back: { url: string } | null;
    selfie: { url: string } | null; submitted_at: string | null; verified_at: string | null;
  }>;
  history: Array<{ id: string; created_at: string | null; actor_email: string | null; action: string; summary: string | null }>;
  open_reports_against: number;
}

const SLA_HOURS = 48;

const REJECT_PRESETS = [
  "Photos are unclear or don't clearly show you",
  "ID document is unreadable — please upload a clearer image",
  "Name on ID doesn't match the profile",
  "Selfie doesn't match the ID photo",
  "Profile is incomplete — please add more about yourself",
  "Photos or bio contain content that isn't allowed",
  "Looks like a duplicate of an existing account",
];
const INFO_PRESETS = [
  "Please upload a clear, recent photo of yourself",
  "Please upload the back of your ID document",
  "Please add your education and career details",
  "Please tell us a little more about yourself and your family",
];

const errorMessage = (e: unknown): string => {
  if (e instanceof ApiError) {
    const d = e.detail;
    if (typeof d === "string") return d;
    if (d && typeof d === "object") {
      const m = (d as any).message;
      if (typeof m === "string") return m;
      if (Array.isArray((d as any).missing)) return `Missing: ${(d as any).missing.join(", ")}`;
    }
    return e.message;
  }
  if (e instanceof Error) return e.message;
  return "Unknown error";
};

const fullName = (p: Profile): string =>
  [String(p.first_name || "").trim(), String(p.last_name || "").trim()].filter(Boolean).join(" ") || "(unnamed)";

const ageOf = (dob?: string | null) => {
  if (!dob) return null;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
};

const heightLabel = (cm?: number | null) => {
  if (!cm || cm <= 0) return null;
  const totalIn = cm / 2.54;
  const ft = Math.floor(totalIn / 12);
  const inch = Math.round(totalIn - ft * 12);
  return `${ft}′${inch}″ · ${cm} cm`;
};

const photosOf = (p: Profile) => (Array.isArray(p.photos) ? p.photos : []).filter((x) => !!x?.url) as Array<{ url: string; key?: string | null; is_primary?: boolean }>;
const primaryPhoto = (p: Profile) => {
  const list = photosOf(p);
  return list.find((x) => x.is_primary)?.url || list[0]?.url || null;
};

const STATUS: Record<Status, { tone: Tone; label: string }> = {
  draft:     { tone: "neutral", label: "Draft" },
  submitted: { tone: "warn", label: "Pending" },
  approved:  { tone: "good", label: "Approved" },
  rejected:  { tone: "bad", label: "Rejected" },
};

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

const refreshCounts = () => { try { window.dispatchEvent(new Event("admin:counts-refresh")); } catch { /* noop */ } };

export default function AdminVerificationsPage() {
  const { toast } = useToast();
  // Deep link (?open=<user_id>). Read from window.location rather than
  // useSearchParams so the page needs no Suspense boundary.
  const [deepLink, setDeepLink] = useState<string | null>(null);
  useEffect(() => {
    try { setDeepLink(new URLSearchParams(window.location.search).get("open")); } catch { /* ignore */ }
  }, []);

  const [filter, setFilter] = useState<Filter>("submitted");
  const [lists, setLists] = useState<Record<"submitted" | "approved" | "rejected", Profile[]>>({ submitted: [], approved: [], rejected: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"reject" | "info" | null>(null);
  const [note, setNote] = useState("");
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [reviews, setReviews] = useState<Record<string, Review | "error">>({});
  const noteRef = useRef<HTMLTextAreaElement>(null);
  const deepLinkUsed = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [s, a, r] = await Promise.all([
        adminApi.listVerifications("submitted"),
        adminApi.listVerifications("approved"),
        adminApi.listVerifications("rejected"),
      ]);
      const pick = (res: any) => (Array.isArray(res?.data?.data) ? res.data.data : []) as Profile[];
      // Pending is a FIFO queue: oldest submission first.
      const sub = pick(s).sort((x, y) => (x.submitted_at || "").localeCompare(y.submitted_at || ""));
      setLists({ submitted: sub, approved: pick(a), rejected: pick(r) });
    } catch (e) {
      setLoadError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const items = useMemo(
    () => filter === "all" ? [...lists.submitted, ...lists.approved, ...lists.rejected] : lists[filter],
    [lists, filter],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      [fullName(p), p.city, p.occupation, p.religion, p.country, p.education_level]
        .filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [items, search]);

  const selected = useMemo(
    () => (selectedId ? [...lists.submitted, ...lists.approved, ...lists.rejected].find((p) => p.user_id === selectedId) || null : null),
    [selectedId, lists],
  );

  // Deep link (?open=<user_id>) from the dashboard / palette.
  useEffect(() => {
    if (deepLinkUsed.current || loading || !deepLink) return;
    deepLinkUsed.current = true;
    const all = [...lists.submitted, ...lists.approved, ...lists.rejected];
    const hit = all.find((p) => p.user_id === deepLink);
    if (hit) {
      if (!lists.submitted.includes(hit)) setFilter(lists.approved.includes(hit) ? "approved" : "rejected");
      setSelectedId(hit.user_id);
    }
  }, [deepLink, loading, lists]);

  // Load the review panel data (documents/contact/history) for the open profile.
  useEffect(() => {
    if (!selectedId || reviews[selectedId]) return;
    let cancelled = false;
    adminOpsApi.verificationReview(selectedId)
      .then((res) => { if (!cancelled) setReviews((m) => ({ ...m, [selectedId]: (res.data as any)?.data })); })
      .catch(() => { if (!cancelled) setReviews((m) => ({ ...m, [selectedId]: "error" })); });
    return () => { cancelled = true; };
  }, [selectedId, reviews]);

  const open = useCallback((p: Profile | null) => {
    setSelectedId(p?.user_id || null);
    setMode(null);
    setNote("");
  }, []);

  const move = useCallback((dir: 1 | -1) => {
    if (!filtered.length) return;
    const idx = selectedId ? filtered.findIndex((p) => p.user_id === selectedId) : -1;
    const next = filtered[Math.max(0, Math.min(filtered.length - 1, idx + dir))];
    open(next || null);
  }, [filtered, selectedId, open]);

  /** Remove decided profile from the pending list and open the next one. */
  const advanceAfter = useCallback((userId: string, newStatus: Status) => {
    const idx = filtered.findIndex((p) => p.user_id === userId);
    const nextCandidate = filtered[idx + 1] || filtered[idx - 1] || null;
    setLists((l) => {
      const fromAll = [...l.submitted, ...l.approved, ...l.rejected].find((p) => p.user_id === userId);
      const strip = (arr: Profile[]) => arr.filter((p) => p.user_id !== userId);
      const next = { submitted: strip(l.submitted), approved: strip(l.approved), rejected: strip(l.rejected) };
      if (fromAll && (newStatus === "approved" || newStatus === "rejected")) {
        next[newStatus] = [{ ...fromAll, verification_status: newStatus, reviewed_at: new Date().toISOString() }, ...next[newStatus]];
      }
      return next;
    });
    setChecked((c) => { const n = new Set(c); n.delete(userId); return n; });
    setReviews((m) => { const n = { ...m }; delete n[userId]; return n; });
    if (filter === "submitted" || filter === newStatus) open(nextCandidate && nextCandidate.user_id !== userId ? nextCandidate : null);
    refreshCounts();
  }, [filtered, filter, open]);

  const approve = useCallback(async (p: Profile) => {
    if (busy) return;
    setBusy(true);
    try {
      await adminApi.approveVerification(p.user_id);
      toast("success", `Approved ${fullName(p)}`);
      advanceAfter(p.user_id, "approved");
    } catch (e) { toast("error", errorMessage(e)); }
    finally { setBusy(false); }
  }, [busy, toast, advanceAfter]);

  const submitNote = useCallback(async (p: Profile) => {
    const text = note.trim();
    if (!text || !mode) { toast("warning", mode === "info" ? "Say what you need from the member." : "Give the member a reason."); noteRef.current?.focus(); return; }
    setBusy(true);
    try {
      if (mode === "reject") {
        await adminApi.rejectVerification(p.user_id, text);
        toast("success", `Rejected ${fullName(p)}`);
        advanceAfter(p.user_id, "rejected");
      } else {
        await adminApi.requestInfo(p.user_id, text);
        toast("success", `Asked ${fullName(p)} for more information`);
        advanceAfter(p.user_id, "draft");
      }
    } catch (e) { toast("error", errorMessage(e)); }
    finally { setBusy(false); }
  }, [note, mode, toast, advanceAfter]);

  const bulkApprove = useCallback(async () => {
    const ids = Array.from(checked).filter((id) => lists.submitted.some((p) => p.user_id === id));
    if (!ids.length) return;
    setBusy(true);
    try {
      const res = await adminOpsApi.bulkApproveVerifications(ids);
      const d = (res.data as any)?.data || {};
      const approved: string[] = d.approved || [];
      toast("success", `Approved ${approved.length} profile${approved.length === 1 ? "" : "s"}${(d.skipped || []).length ? ` · ${(d.skipped || []).length} skipped (no longer pending)` : ""}`);
      setChecked(new Set());
      if (selectedId && approved.includes(selectedId)) open(null);
      await load();
      refreshCounts();
    } catch (e) { toast("error", errorMessage(e)); }
    finally { setBusy(false); }
  }, [checked, lists.submitted, toast, selectedId, open, load]);

  const toggleCheck = (id: string) => setChecked((c) => { const n = new Set(c); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const pendingVisible = filtered.filter((p) => p.verification_status === "submitted");
  const allChecked = pendingVisible.length > 0 && pendingVisible.every((p) => checked.has(p.user_id));

  // ── Keyboard shortcuts ────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (lightbox) {
        if (e.key === "Escape") setLightbox(null);
        if (e.key === "ArrowRight") setLightbox((l) => l && { ...l, index: (l.index + 1) % l.urls.length });
        if (e.key === "ArrowLeft") setLightbox((l) => l && { ...l, index: (l.index - 1 + l.urls.length) % l.urls.length });
        return;
      }
      if (isTyping(e.target)) {
        if (e.key === "Escape") { (e.target as HTMLElement).blur(); setMode(null); }
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "?") { setShowHelp((s) => !s); return; }
      if (k === "j" || e.key === "ArrowDown" || k === "n") { e.preventDefault(); move(1); return; }
      if (k === "k" || e.key === "ArrowUp") { e.preventDefault(); move(-1); return; }
      if (e.key === "Escape") { if (mode) setMode(null); else open(null); return; }
      if (!selected || busy) return;
      const canAct = selected.verification_status !== "approved";
      if (k === "x" && selected.verification_status === "submitted") { e.preventDefault(); toggleCheck(selected.user_id); return; }
      if (!canAct) return;
      if (k === "a") { e.preventDefault(); approve(selected); }
      else if (k === "r") { e.preventDefault(); setMode("reject"); setNote(""); setTimeout(() => noteRef.current?.focus(), 30); }
      else if (k === "i") { e.preventDefault(); setMode("info"); setNote(""); setTimeout(() => noteRef.current?.focus(), 30); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox, mode, selected, busy, move, open, approve]);

  const counts = {
    submitted: lists.submitted.length,
    approved: lists.approved.length,
    rejected: lists.rejected.length,
    all: lists.submitted.length + lists.approved.length + lists.rejected.length,
  };
  const overdue = lists.submitted.filter((p) => (hoursSince(p.submitted_at) ?? 0) >= SLA_HOURS).length;

  return (
    <PageShell
      title="Verifications"
      subtitle="Review new profiles and ID documents before members can browse and be seen."
      meta={!loading && counts.submitted > 0 ? (
        <Pill tone={overdue ? "bad" : "warn"}>{counts.submitted} pending{overdue ? ` · ${overdue} over ${SLA_HOURS}h` : ""}</Pill>
      ) : undefined}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setShowHelp((s) => !s)} ariaLabel="Keyboard shortcuts" ariaKeyShortcuts="?">
          <Keyboard className="h-3.5 w-3.5" aria-hidden /> Shortcuts
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Filter>
            layoutId="verif-tab" ariaLabel="Filter by status"
            value={filter}
            onChange={(v) => { setFilter(v); setChecked(new Set()); }}
            options={[
              { value: "submitted", label: "Pending", count: counts.submitted },
              { value: "approved", label: "Approved", count: counts.approved },
              { value: "rejected", label: "Rejected", count: counts.rejected },
              { value: "all", label: "All", count: counts.all },
            ]}
          />
          <SearchField value={search} onChange={setSearch} placeholder="Filter by name, city, religion…" className="w-full sm:w-72" />
          <AnimatePresence>
            {checked.size > 0 && (
              <motion.div
                initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -4 }}
                className="flex items-center gap-2 rounded-lg border border-border bg-card py-1 pl-3 pr-1"
              >
                <span className="text-[12.5px] font-medium tabular-nums text-foreground">{checked.size} selected</span>
                <Button size="sm" variant="success" onClick={bulkApprove} loading={busy}>
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Approve {checked.size}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Clear</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      }
    >
      <div className={cn("grid items-start gap-4", selected ? "lg:grid-cols-[340px_minmax(0,1fr)]" : "grid-cols-1")}>
        {/* ── Queue ─────────────────────────────────────────────────────── */}
        <section
          aria-label="Verification queue"
          className={cn("overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(26,10,20,0.04)]", selected && "hidden lg:block")}
        >
          {filter === "submitted" && pendingVisible.length > 1 && (
            <label className="flex items-center gap-2 border-b border-border/60 px-4 py-2 text-[12px] text-muted2-foreground">
              <input
                type="checkbox" checked={allChecked}
                onChange={() => setChecked(allChecked ? new Set() : new Set(pendingVisible.map((p) => p.user_id)))}
                className="h-3.5 w-3.5 accent-[#DC1E3C]"
              />
              Select all {pendingVisible.length} · oldest first
            </label>
          )}
          <div data-admin-scroll className={cn("overflow-y-auto", selected ? "max-h-[calc(100vh-260px)]" : "max-h-none")}>
            {loading ? (
              <div className="p-3"><SkeletonRows rows={6} /></div>
            ) : loadError ? (
              <EmptyState icon={AlertTriangle} title="Couldn't load the queue" description={loadError} action={<Button size="sm" onClick={() => { setLoading(true); load(); }}>Try again</Button>} />
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={filter === "submitted" && !search ? ShieldCheck : Inbox}
                title={search ? `No profiles match “${search}”` : filter === "submitted" ? "Queue is clear" : "No profiles here yet"}
                description={filter === "submitted" && !search ? "New submissions land here when members press “Submit for verification”." : undefined}
              />
            ) : (
              <ul className={cn(!selected && "sm:grid sm:grid-cols-2 xl:grid-cols-3")}>
                {filtered.map((p) => (
                  <QueueRow
                    key={p.user_id}
                    profile={p}
                    active={selectedId === p.user_id}
                    checked={checked.has(p.user_id)}
                    onToggle={() => toggleCheck(p.user_id)}
                    onOpen={() => open(p)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ── Review panel ──────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {selected && (
            <motion.section
              key={selected.user_id}
              aria-label={`Review ${fullName(selected)}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0 overflow-hidden rounded-xl border border-border/70 bg-card shadow-[0_1px_2px_rgba(26,10,20,0.04)]"
            >
              <ReviewPanel
                profile={selected}
                review={reviews[selected.user_id]}
                position={{ index: filtered.findIndex((p) => p.user_id === selected.user_id), total: filtered.length }}
                busy={busy}
                mode={mode}
                setMode={(m) => { setMode(m); setNote(""); if (m) setTimeout(() => noteRef.current?.focus(), 30); }}
                note={note}
                setNote={setNote}
                noteRef={noteRef}
                onClose={() => open(null)}
                onPrev={() => move(-1)}
                onNext={() => move(1)}
                onApprove={() => approve(selected)}
                onSubmitNote={() => submitNote(selected)}
                onPhoto={(urls, index) => setLightbox({ urls, index })}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* ── Lightbox ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            role="dialog" aria-modal="true" aria-label="Image viewer"
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-6 sm:p-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.urls[lightbox.index]} alt="" onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full rounded-lg object-contain shadow-2xl" />
            <button onClick={() => setLightbox(null)} aria-label="Close" className="fixed right-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <X className="h-5 w-5" />
            </button>
            {lightbox.urls.length > 1 && (
              <>
                <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => l && { ...l, index: (l.index - 1 + l.urls.length) % l.urls.length }); }} aria-label="Previous image" className="fixed left-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); setLightbox((l) => l && { ...l, index: (l.index + 1) % l.urls.length }); }} aria-label="Next image" className="fixed right-4 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white hover:bg-white/25">
                  <ChevronRight className="h-5 w-5" />
                </button>
                <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-3 py-1 text-[12px] tabular-nums text-white">{lightbox.index + 1} / {lightbox.urls.length}</div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Shortcut help ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showHelp && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.15 }}
            role="dialog" aria-label="Keyboard shortcuts"
            className="fixed bottom-4 right-4 z-[60] w-[280px] rounded-xl border border-border bg-card p-4 shadow-[0_12px_32px_rgba(26,10,20,0.16)]"
          >
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-foreground">Keyboard shortcuts</h2>
              <button onClick={() => setShowHelp(false)} aria-label="Close shortcuts" className="grid h-6 w-6 place-items-center rounded text-muted2-foreground hover:bg-secondary"><X className="h-3.5 w-3.5" /></button>
            </div>
            <dl className="space-y-1.5 text-[12.5px]">
              {[
                [["J", "↓"], "Next profile"], [["K", "↑"], "Previous profile"], [["N"], "Next (skip)"],
                [["A"], "Approve"], [["R"], "Reject with reason"], [["I"], "Request more info"],
                [["X"], "Select for bulk approve"], [["Esc"], "Close / cancel"], [["?"], "Toggle this panel"],
              ].map(([keys, label]) => (
                <div key={label as string} className="flex items-center justify-between gap-3">
                  <dt className="text-muted2-foreground">{label as string}</dt>
                  <dd className="flex gap-1">{(keys as string[]).map((k) => <Kbd key={k}>{k}</Kbd>)}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Queue row ───────────────────────────────────────────────────────────────

function QueueRow({ profile, active, checked, onToggle, onOpen }: {
  profile: Profile; active: boolean; checked: boolean; onToggle: () => void; onOpen: () => void;
}) {
  const name = fullName(profile);
  const a = ageOf(profile.date_of_birth);
  const status = (profile.verification_status as Status) || "draft";
  const pending = status === "submitted";
  const h = pending ? hoursSince(profile.submitted_at) : null;
  const over = (h ?? 0) >= SLA_HOURS;
  return (
    <li className={cn("relative border-b border-border/50", active && "bg-primary/[0.045]")}>
      {active && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-primary" />}
      <div className="flex items-start gap-3 px-4 py-3">
        {pending ? (
          <input
            type="checkbox" checked={checked} onChange={onToggle}
            aria-label={`Select ${name} for bulk approval`}
            className="mt-3 h-3.5 w-3.5 shrink-0 accent-[#DC1E3C]"
          />
        ) : <span className="w-3.5 shrink-0" />}
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
          <Avatar name={name} url={primaryPhoto(profile)} size={40} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-[13.5px] font-medium text-foreground">{name}</span>
              {a !== null && <span className="shrink-0 text-[12px] text-muted2-foreground">{a}</span>}
            </div>
            <div className="truncate text-[12px] text-muted2-foreground">
              {[profile.city || profile.country, profile.religion, profile.occupation].filter(Boolean).join(" · ") || "No details yet"}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {pending
                ? <Pill tone={over ? "bad" : "warn"}><Clock className="h-3 w-3" aria-hidden />Waiting {waitingLabel(h)}</Pill>
                : <Pill tone={STATUS[status]?.tone || "neutral"}>{STATUS[status]?.label || status}</Pill>}
              {typeof profile.completeness_score === "number" && (
                <span className="text-[11.5px] tabular-nums text-muted2-foreground">{profile.completeness_score}% complete</span>
              )}
            </div>
          </div>
        </button>
      </div>
    </li>
  );
}

// ─── Review panel ────────────────────────────────────────────────────────────

function ReviewPanel({
  profile, review, position, busy, mode, setMode, note, setNote, noteRef,
  onClose, onPrev, onNext, onApprove, onSubmitNote, onPhoto,
}: {
  profile: Profile;
  review: Review | "error" | undefined;
  position: { index: number; total: number };
  busy: boolean;
  mode: "reject" | "info" | null;
  setMode: (m: "reject" | "info" | null) => void;
  note: string;
  setNote: (v: string) => void;
  noteRef: React.RefObject<HTMLTextAreaElement>;
  onClose: () => void; onPrev: () => void; onNext: () => void;
  onApprove: () => void; onSubmitNote: () => void;
  onPhoto: (urls: string[], index: number) => void;
}) {
  const name = fullName(profile);
  const a = ageOf(profile.date_of_birth);
  const status = (profile.verification_status as Status) || "draft";
  const photos = photosOf(profile);
  const canAct = status !== "approved";
  const h = status === "submitted" ? hoursSince(profile.submitted_at) : null;
  const r = review && review !== "error" ? review : null;

  return (
    <div className="flex max-h-[calc(100vh-200px)] min-h-[480px] flex-col">
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} url={primaryPhoto(profile)} size={44} />
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-foreground">
              {name}{a !== null && <span className="font-normal text-muted2-foreground">, {a}</span>}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-muted2-foreground">
              <Pill tone={STATUS[status]?.tone || "neutral"}>{STATUS[status]?.label || status}</Pill>
              {h !== null && <Pill tone={h >= SLA_HOURS ? "bad" : "neutral"}><Clock className="h-3 w-3" aria-hidden />Waiting {waitingLabel(h)}</Pill>}
              {r?.user.membership_number && <span className="tabular-nums">{r.user.membership_number}</span>}
              {typeof profile.completeness_score === "number" && <span>· {profile.completeness_score}% complete</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {position.total > 1 && (
            <span className="mr-1 hidden text-[12px] tabular-nums text-muted2-foreground sm:inline">{position.index + 1} of {position.total}</span>
          )}
          <IconBtn label="Previous profile (K)" onClick={onPrev}><ChevronLeft className="h-4 w-4" /></IconBtn>
          <IconBtn label="Next profile (J)" onClick={onNext}><ChevronRight className="h-4 w-4" /></IconBtn>
          <Link href={`/admin/users/${profile.user_id}`} title="Open member record" aria-label="Open member record" className="grid h-8 w-8 place-items-center rounded-md text-muted2-foreground hover:bg-secondary hover:text-foreground">
            <ExternalLink className="h-4 w-4" />
          </Link>
          <IconBtn label="Close (Esc)" onClick={onClose}><X className="h-4 w-4" /></IconBtn>
        </div>
      </header>

      {/* Body: profile | identity */}
      <div data-admin-scroll className="flex-1 overflow-y-auto">
        {(profile.rejection_reason || (profile.last_rejection_reason && profile.last_rejection_reason !== profile.rejection_reason) || (r?.open_reports_against ?? 0) > 0) && (
          <div className="space-y-2 border-b border-border/60 px-5 py-3">
            {profile.rejection_reason && (
              <Callout tone="bad" title={status === "rejected" ? "Rejection reason" : "Outstanding request"}>{profile.rejection_reason}</Callout>
            )}
            {profile.last_rejection_reason && profile.last_rejection_reason !== profile.rejection_reason && (
              <Callout tone="neutral" title="Previously rejected for">{profile.last_rejection_reason}</Callout>
            )}
            {(r?.open_reports_against ?? 0) > 0 && (
              <Callout tone="bad" title={`${r!.open_reports_against} open report${r!.open_reports_against === 1 ? "" : "s"} against this member`}>
                <Link href="/admin/reports" className="underline">Check reports</Link> before approving.
              </Callout>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-2">
          {/* Profile column */}
          <div className="space-y-5 px-5 py-4 xl:border-r xl:border-border/60">
            <Block icon={ImageIcon} title={`Photos (${photos.length})`}>
              {photos.length === 0 ? (
                <p className="text-[12.5px] text-muted2-foreground">No photos uploaded.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((ph, i) => (
                    <button
                      key={ph.key || ph.url}
                      type="button"
                      onClick={() => onPhoto(photos.map((x) => x.url), i)}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                      aria-label={`Open photo ${i + 1}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={ph.url} alt="" className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" loading="lazy" />
                      {ph.is_primary && <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">Primary</span>}
                    </button>
                  ))}
                </div>
              )}
            </Block>

            <Block icon={User} title="Basics">
              <Facts rows={[
                ["Gender", profile.gender], ["Date of birth", profile.date_of_birth],
                ["Height", heightLabel(profile.height_cm)], ["Marital status", profile.marital_status?.replace(/_/g, " ")],
                ["Religion", profile.religion], ["Community", [profile.caste].filter(Boolean).join(" ")],
                ["Mother tongue", profile.mother_tongue],
              ]} />
            </Block>

            <Block icon={MapPin} title="Location">
              <Facts rows={[["City", profile.city], ["State / county", profile.state], ["Country", profile.country]]} />
            </Block>

            <Block icon={GraduationCap} title="Education & career">
              <Facts rows={[
                ["Education", profile.education_level], ["Field", profile.education_field], ["College", profile.college],
                ["Occupation", profile.occupation], ["Employer", profile.employer],
                ["Annual income", profile.annual_income_inr ? `£${profile.annual_income_inr.toLocaleString("en-GB")}` : null],
              ]} />
            </Block>

            {profile.bio && (
              <Block icon={MessageSquare} title="About">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{profile.bio}</p>
              </Block>
            )}
            {profile.about_family && (
              <Block icon={Heart} title="Family">
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground">{profile.about_family}</p>
              </Block>
            )}
            {profile.partner_prefs && Object.keys(profile.partner_prefs).length > 0 && (
              <Block icon={Heart} title="Partner preferences"><KeyValues data={profile.partner_prefs} /></Block>
            )}
          </div>

          {/* Identity column */}
          <div className="space-y-5 bg-secondary/25 px-5 py-4">
            <Block icon={FileText} title="ID documents">
              {review === undefined ? (
                <div className="grid grid-cols-2 gap-2"><Skeleton className="aspect-[3/2]" /><Skeleton className="aspect-[3/2]" /></div>
              ) : review === "error" ? (
                <p className="text-[12.5px] text-[#B42343]">Couldn&apos;t load documents. Close and reopen to retry.</p>
              ) : review.documents.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card px-3 py-4 text-[12.5px] text-muted2-foreground">
                  No ID submitted. Approving verifies the profile only — consider requesting an ID (<Kbd>I</Kbd>).
                </div>
              ) : (
                <div className="space-y-4">
                  {review.documents.map((doc) => {
                    const imgs = [
                      doc.front && { label: "Front", url: doc.front.url },
                      doc.back && { label: "Back", url: doc.back.url },
                      doc.selfie && { label: "Selfie", url: doc.selfie.url },
                    ].filter(Boolean) as Array<{ label: string; url: string }>;
                    return (
                      <div key={doc.id}>
                        <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12.5px]">
                          <span className="font-medium text-foreground">{doc.doc_type || doc.type.replace(/_/g, " ")}</span>
                          {doc.doc_country && <span className="text-muted2-foreground">· {doc.doc_country}</span>}
                          {doc.doc_number_masked && <span className="tabular-nums text-muted2-foreground">· {doc.doc_number_masked}</span>}
                          <Pill tone={doc.status === "verified" ? "good" : doc.status === "failed" ? "bad" : "warn"}>{doc.status.replace(/_/g, " ")}</Pill>
                          <span className="ml-auto text-[11.5px] text-muted2-foreground">{relTime(doc.submitted_at)}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {imgs.map((im, i) => (
                            <button
                              key={im.label}
                              type="button"
                              onClick={() => onPhoto(imgs.map((x) => x.url), i)}
                              className="group overflow-hidden rounded-lg border border-border/70 bg-card text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                              aria-label={`Open ${im.label.toLowerCase()} image`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={im.url} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]" loading="lazy" />
                              <span className="block px-2 py-1 text-[11.5px] text-muted2-foreground">{im.label}</span>
                            </button>
                          ))}
                        </div>
                        {doc.selfie && primaryPhoto(profile) && (
                          <button
                            type="button"
                            onClick={() => onPhoto([primaryPhoto(profile)!, doc.selfie!.url, ...(doc.front ? [doc.front.url] : [])], 0)}
                            className="mt-2 text-[12px] font-medium text-primary hover:underline"
                          >
                            Compare profile photo · selfie · ID →
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Block>

            <Block icon={BadgeCheck} title="Contact & account">
              {r ? (
                <ul className="space-y-1.5 text-[13px]">
                  <Check ok={r.user.is_email_verified} icon={Mail} label={r.user.email || "No email"} note={r.user.is_email_verified ? "verified" : "unverified"} />
                  <Check ok={r.user.is_phone_verified} icon={Phone} label={r.user.phone || "No phone"} note={r.user.is_phone_verified ? "verified" : "unverified"} />
                  <li className="pt-1 text-[12px] text-muted2-foreground">
                    Joined {relTime(r.user.created_at)} · last active {relTime(r.user.last_active_at)}
                    {!r.user.is_active && <> · <span className="font-medium text-[#B42343]">suspended</span></>}
                  </li>
                </ul>
              ) : review === undefined ? <SkeletonRows rows={2} /> : <p className="text-[12.5px] text-muted2-foreground">—</p>}
            </Block>

            <Block icon={Clock} title="Review history">
              <ul className="space-y-2 text-[12.5px]">
                {profile.submitted_at && (
                  <li className="flex gap-2"><span className="text-muted2-foreground">{formatDateTime(profile.submitted_at)}</span><span className="text-foreground">Submitted</span></li>
                )}
                {(r?.history || []).map((h) => (
                  <li key={h.id} className="flex flex-wrap gap-x-2">
                    <span className="text-muted2-foreground">{formatDateTime(h.created_at)}</span>
                    <span className="text-foreground">{(h.actor_email || "Admin").split("@")[0]} {describeAction(h.action)}</span>
                    {h.summary && <span className="w-full text-muted2-foreground">“{h.summary}”</span>}
                  </li>
                ))}
                {!profile.submitted_at && !(r?.history || []).length && <li className="text-muted2-foreground">No history yet.</li>}
              </ul>
            </Block>
          </div>
        </div>
      </div>

      {/* Decision bar */}
      {canAct && (
        <footer className="border-t border-border/60 bg-card px-5 py-3">
          <AnimatePresence initial={false}>
            {mode && (
              <motion.div
                initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <div className="pb-3">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {(mode === "reject" ? REJECT_PRESETS : INFO_PRESETS).map((p) => (
                      <button
                        key={p} type="button" onClick={() => { setNote(p); noteRef.current?.focus(); }}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                          note === p ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-card text-foreground hover:bg-secondary",
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <label className="sr-only" htmlFor="verif-note">{mode === "reject" ? "Reason shown to the member" : "What you need from the member"}</label>
                  <textarea
                    id="verif-note"
                    ref={noteRef}
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); onSubmitNote(); } }}
                    placeholder={mode === "reject" ? "Reason the member will see… (⌘↵ to send)" : "What should the member add or fix? (⌘↵ to send)"}
                    className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground outline-none placeholder:text-muted2-foreground/80 focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="flex flex-wrap items-center gap-2">
            {mode ? (
              <>
                <Button variant={mode === "reject" ? "danger" : "warn"} onClick={onSubmitNote} loading={busy} disabled={!note.trim()}>
                  {mode === "reject" ? <><XCircle className="h-3.5 w-3.5" aria-hidden /> Reject profile</> : "Send request"}
                </Button>
                <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
              </>
            ) : (
              <>
                <Button variant="success" onClick={onApprove} loading={busy} ariaKeyShortcuts="a" className="min-w-[132px]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Approve <Kbd className="ml-1 border-white/30 bg-white/15 text-white shadow-none">A</Kbd>
                </Button>
                <Button variant="warn" onClick={() => setMode("info")} disabled={busy} ariaKeyShortcuts="i">
                  Request info <Kbd className="ml-1">I</Kbd>
                </Button>
                <Button variant="danger" onClick={() => setMode("reject")} disabled={busy} ariaKeyShortcuts="r">
                  Reject <Kbd className="ml-1">R</Kbd>
                </Button>
                <span className="ml-auto hidden text-[12px] text-muted2-foreground md:inline">
                  <Kbd>N</Kbd> skip to next
                </span>
              </>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}

// ─── Small pieces ────────────────────────────────────────────────────────────

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-md text-muted2-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
      {children}
    </button>
  );
}

function Block({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-muted2-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden /> {title}
      </h3>
      {children}
    </div>
  );
}

function Facts({ rows }: { rows: Array<[string, unknown]> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
      {rows.map(([label, v]) => {
        const empty = v === null || v === undefined || v === "";
        return (
          <div key={label} className="min-w-0">
            <dt className="text-[11.5px] text-muted2-foreground">{label}</dt>
            <dd className={cn("truncate text-[13px] capitalize", empty ? "text-muted2-foreground/60" : "text-foreground")} title={empty ? undefined : String(v)}>
              {empty ? "—" : String(v)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function KeyValues({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== "" && (Array.isArray(v) ? v.length > 0 : true));
  if (!entries.length) return <p className="text-[12.5px] text-muted2-foreground">—</p>;
  return (
    <Facts rows={entries.map(([k, v]) => [
      k.replace(/[_-]/g, " ").replace(/^./, (c) => c.toUpperCase()),
      Array.isArray(v) ? v.join(", ") : typeof v === "object" ? JSON.stringify(v) : String(v),
    ])} />
  );
}

function Callout({ tone, title, children }: { tone: "bad" | "neutral"; title: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-2 rounded-lg border px-3 py-2 text-[12.5px]", tone === "bad" ? "border-[#F7CCD5] bg-[#FDECEF]/60" : "border-border bg-secondary/50")}>
      <AlertTriangle className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", tone === "bad" ? "text-[#B42343]" : "text-muted2-foreground")} aria-hidden />
      <div><span className="font-medium text-foreground">{title}: </span><span className="text-foreground/80">{children}</span></div>
    </div>
  );
}

function Check({ ok, icon: Icon, label, note }: { ok: boolean; icon: any; label: string; note: string }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted2-foreground" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
      <Pill tone={ok ? "good" : "neutral"}>{ok ? <CheckCircle2 className="h-3 w-3" aria-hidden /> : null}{note}</Pill>
    </li>
  );
}
