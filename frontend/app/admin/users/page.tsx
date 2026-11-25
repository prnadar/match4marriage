"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, X, Users as UsersIcon,
  Download, UserX, UserCheck, BadgeCheck, Send, Megaphone, Tag as TagIcon, CalendarClock, MessageCircle,
} from "lucide-react";
import { PageShell, GlassCard, Button, fadeUp } from "@/components/admin/PageShell";
import { Pagination, ErrorState } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { adminApi, adminCrmApi, ApiError, downloadCsv } from "@/lib/api";
import ComposeDrawer, { type ComposeTarget } from "@/components/admin/crm/ComposeDrawer";
import {
  C, CrmStyles, ContactActions, CopyButton, TagChip, Kbd, Segmented, formatPhone, relTime,
  followUpState, inputStyle, EmptyState,
} from "@/components/admin/crm/shared";

interface AdminUserRow {
  id: string;
  membership_number: string | null;
  email: string | null;
  phone: string | null;
  phone_e164?: string | null;
  phone_country_code?: string | null;
  whatsapp_number?: string | null;
  whatsapp_preferred?: boolean;
  preferred_contact?: string | null;
  is_active: boolean;
  deleted_at: string | null;
  completeness_score: number;
  verification_status: string;
  subscription_tier: string;
  plan_label?: string;
  first_name: string;
  last_name: string;
  city: string | null;
  country: string | null;
  religion: string | null;
  occupation: string | null;
  primary_photo_url: string | null;
  created_at: string | null;
  last_active_at: string | null;
  last_contacted_at?: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  tags?: string[];
  follow_up_at?: string | null;
}

type Filter = "all" | "active" | "suspended" | "deleted" | "verified" | "pending";

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
  { value: "verified", label: "Verified" },
  { value: "suspended", label: "Suspended" },
  { value: "deleted", label: "Deleted" },
];

const PLAN_FILTERS = [
  { value: "", label: "Any plan" }, { value: "free", label: "Free" }, { value: "silver", label: "Basic" },
  { value: "gold", label: "Premium" }, { value: "platinum", label: "Elite" },
];

const GRID = "36px minmax(200px, 1.4fr) minmax(300px, 1.8fr) minmax(120px, 0.8fr) minmax(150px, 1fr) minmax(104px, 0.7fr) 84px";

export default function AdminUsersPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filter, setFilter] = useState<Filter>("all");
  const [plan, setPlan] = useState("");
  const [tag, setTag] = useState("");
  const [followUp, setFollowUp] = useState<"" | "due" | "upcoming" | "any">("");
  const [q, setQ] = useState("");
  const [qLive, setQLive] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<null | "suspend" | "activate">(null);
  const [tagMenu, setTagMenu] = useState(false);
  const [tagOptions, setTagOptions] = useState<Array<{ tag: string; count?: number }>>([]);
  const [compose, setCompose] = useState<{ target: ComposeTarget; channels?: Array<"email" | "in_app"> } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);

  // Deep links: /admin/users?tag=VIP&follow_up=due&plan=gold&status=pending
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("tag")) setTag(sp.get("tag") as string);
      const fu = sp.get("follow_up");
      if (fu === "due" || fu === "upcoming" || fu === "any") setFollowUp(fu);
      if (sp.get("plan")) setPlan(sp.get("plan") as string);
      const st = sp.get("status") as Filter | null;
      if (st && FILTERS.some((f) => f.value === st)) setFilter(st);
      if (sp.get("q")) { setQ(sp.get("q") as string); setQLive(sp.get("q") as string); }
    } catch { /* ignore */ }
    setReady(true);
  }, []);

  useEffect(() => {
    adminCrmApi.meta().then((r) => {
      const d = (r.data as any)?.data;
      if (!d) return;
      const used: Array<{ tag: string; count: number }> = d.tags || [];
      const names = new Set(used.map((t) => t.tag));
      setTagOptions([...used, ...(d.suggested_tags || []).filter((t: string) => !names.has(t)).map((t: string) => ({ tag: t }))]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setQ(qLive), 250);
    return () => clearTimeout(t);
  }, [qLive]);

  const params = useMemo(() => ({
    q: q || undefined,
    status_filter: filter === "all" ? undefined : filter,
    tag: tag || undefined,
    follow_up: followUp || undefined,
    plan: plan || undefined,
  }), [q, filter, tag, followUp, plan]);

  const load = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await adminCrmApi.listUsers({ ...params, page, limit });
      const payload = res.data as any;
      setItems(Array.isArray(payload?.data) ? payload.data : []);
      setTotal(typeof payload?.total === "number" ? payload.total : 0);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [params, page, limit, ready]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [params]);
  useEffect(() => { setSelected(new Set()); }, [params, page]);

  // Keyboard: "/" focuses search, Esc clears selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (compose || confirm) return;
      const t = e.target as HTMLElement;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape" && !typing && selected.size) setSelected(new Set());
      if (e.key === "Escape" && tagMenu) setTagMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compose, confirm, selected, tagMenu]);

  const pageCount = Math.max(1, Math.ceil(total / limit));
  const allOnPageSelected = items.length > 0 && items.every((u) => selected.has(u.id));
  const someOnPageSelected = !allOnPageSelected && items.some((u) => selected.has(u.id));
  const filtersActive = !!(tag || followUp || plan || q || filter !== "all");

  const togglePage = () => {
    const next = new Set(selected);
    if (allOnPageSelected) items.forEach((u) => next.delete(u.id));
    else items.forEach((u) => next.add(u.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const runBulk = async (action: "suspend" | "activate") => {
    if (busy || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await adminApi.bulkUserAction(action, Array.from(selected));
      const data = (res.data as any)?.data;
      toast("success", `${action === "suspend" ? "Suspended" : "Activated"} ${data?.affected ?? 0} member${data?.affected === 1 ? "" : "s"}`);
      setSelected(new Set());
      await load();
    } catch (e: any) {
      toast("error", e?.message || "Bulk action failed");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const bulkTag = async (t: string) => {
    setTagMenu(false);
    const rows = items.filter((u) => selected.has(u.id));
    if (!rows.length) return;
    setBusy(true);
    let ok = 0;
    for (const u of rows) {
      const current = u.tags || [];
      if (current.some((x) => x.toLowerCase() === t.toLowerCase())) { ok++; continue; }
      try { await adminCrmApi.updateMember(u.id, { tags: [...current, t] }); ok++; } catch { /* counted below */ }
    }
    setBusy(false);
    toast(ok === rows.length ? "success" : "warning", `Tagged ${ok} of ${rows.length} member${rows.length === 1 ? "" : "s"} “${t}”`);
    await load();
  };

  const exportCsv = () => {
    const url = adminCrmApi.exportUsersCsvUrl(params);
    downloadCsv(url, "members-contacts.csv").catch((e: any) => toast("error", e?.message || "Export failed"));
  };

  const clearFilters = () => { setFilter("all"); setPlan(""); setTag(""); setFollowUp(""); setQLive(""); setQ(""); };

  const messageUser = (u: AdminUserRow, channels: Array<"email" | "in_app">) => setCompose({
    channels,
    target: {
      kind: "user",
      user: {
        id: u.id, first_name: u.first_name, last_name: u.last_name, email: u.email, phone_e164: u.phone_e164,
        membership_number: u.membership_number, plan_label: u.plan_label, city: u.city, country: u.country,
        primary_photo_url: u.primary_photo_url,
      },
    },
  });

  return (
    <PageShell
      title="Users"
      subtitle={filtersActive ? "Members matching the current filters." : "Everyone registered, with contact details, plan and follow-ups."}
      meta={!loading ? <span className="inline-flex items-center rounded-full border border-border/70 bg-muted2 px-2 py-[2px] text-[11px] font-medium leading-4 text-muted2-foreground">{total.toLocaleString("en-GB")}</span> : undefined}
      actions={
        <>
          <Button size="sm" variant="secondary" onClick={exportCsv} title="Export the filtered list with contact details">
            <Download style={{ width: 14, height: 14 }} aria-hidden /> Export CSV
          </Button>
          <Button size="sm" variant="primary" onClick={() => setCompose({ target: { kind: "audience" } })}>
            <Megaphone style={{ width: 14, height: 14 }} aria-hidden /> Broadcast
          </Button>
        </>
      }
    >
      <CrmStyles />

      {/* Toolbar */}
      <motion.div variants={fadeUp} style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={searchBoxStyle}>
          <Search aria-hidden style={{ width: 15, height: 15, color: C.muted }} />
          <input
            ref={searchRef}
            type="search"
            aria-label="Search members"
            placeholder="Search name, email, phone, membership no."
            value={qLive}
            onChange={(e) => setQLive(e.target.value)}
            style={searchInputStyle}
          />
          {qLive ? (
            <button onClick={() => setQLive("")} aria-label="Clear search" style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.muted, display: "flex" }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          ) : <Kbd>/</Kbd>}
        </div>
        <Segmented ariaLabel="Status" value={filter} onChange={setFilter} options={FILTERS} />
      </motion.div>

      <motion.div variants={fadeUp} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <FilterSelect label="Plan" value={plan} onChange={setPlan} options={PLAN_FILTERS} />
        <FilterSelect
          label="Tag"
          icon={TagIcon}
          value={tag}
          onChange={setTag}
          options={[{ value: "", label: "Any tag" }, ...tagOptions.map((t) => ({ value: t.tag, label: t.count ? `${t.tag} (${t.count})` : t.tag }))]}
        />
        <FilterSelect
          label="Follow-up"
          icon={CalendarClock}
          value={followUp}
          onChange={(v) => setFollowUp(v as any)}
          options={[{ value: "", label: "Any follow-up" }, { value: "due", label: "Due or overdue" }, { value: "upcoming", label: "Upcoming" }, { value: "any", label: "Has a follow-up" }]}
        />
        {filtersActive && (
          <button type="button" onClick={clearFilters} className="crm-focus" style={{
            border: "none", background: "none", color: C.wineDeep, fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "6px 4px", fontFamily: "inherit",
          }}>Clear filters</button>
        )}
        {filtersActive && total > 0 && (
          <button type="button" className="crm-focus" onClick={() => {
            if (tag && !q && filter === "all" && !plan && !followUp) setCompose({ target: { kind: "audience", audience: { type: "segment", segment: "tag", value: tag } } });
            else if (followUp === "due" && !q && filter === "all" && !plan && !tag) setCompose({ target: { kind: "audience", audience: { type: "segment", segment: "follow_up_due" } } });
            else if (plan && !q && filter === "all" && !tag && !followUp) setCompose({ target: { kind: "audience", audience: { type: "segment", segment: "plan", value: plan } } });
            else setCompose({ target: { kind: "audience", audience: { type: "users", user_ids: items.map((u) => u.id) } } });
          }} style={{
            marginLeft: "auto", border: `1px solid ${C.line}`, background: C.surface, color: C.ink, fontSize: 12.5, fontWeight: 500,
            borderRadius: 10, height: 32, padding: "0 12px", cursor: "pointer", display: "inline-flex", gap: 6, alignItems: "center", fontFamily: "inherit",
          }}>
            <Send style={{ width: 13, height: 13 }} /> Message these members
          </button>
        )}
      </motion.div>

      {/* Table */}
      <motion.div variants={fadeUp}>
        <GlassCard padding={0} style={{ overflow: "hidden" }}>
          <div style={{ overflow: "auto", maxHeight: "calc(100vh - 250px)", minHeight: 280 }}>
            <div style={{ minWidth: 1090 }} role="table" aria-label="Members">
              <div role="row" style={tableHeadStyle}>
                <div style={{ display: "grid", placeItems: "center" }}>
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    ref={(el) => { if (el) el.indeterminate = someOnPageSelected; }}
                    onChange={togglePage}
                    aria-label="Select all on page"
                    style={{ accentColor: C.wine, cursor: "pointer", width: 15, height: 15 }}
                  />
                </div>
                <div role="columnheader">Member</div>
                <div role="columnheader">Contact</div>
                <div role="columnheader">Plan · status</div>
                <div role="columnheader">Tags</div>
                <div role="columnheader">Last contact</div>
                <div role="columnheader">Joined</div>
              </div>

              {loading ? (
                <div style={{ padding: "6px 10px" }}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="m4m-shimmer" style={{ height: 56, margin: "6px 0", borderRadius: 10, opacity: 1 - i * 0.08 }} />
                  ))}
                </div>
              ) : error ? (
                <ErrorState title="Couldn't load members" message={error} onRetry={load} />
              ) : items.length === 0 ? (
                <EmptyState
                  icon={UsersIcon}
                  title={q ? `No members match “${q}”` : filtersActive ? "No members match these filters" : "No members yet"}
                  body={filtersActive ? "Try a different tag, plan or status — or clear the filters." : "New sign-ups will appear here with their contact details."}
                  action={filtersActive && <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}
                />
              ) : (
                items.map((u) => (
                  <UserRow
                    key={u.id}
                    user={u}
                    checked={selected.has(u.id)}
                    onToggle={() => toggleOne(u.id)}
                    onOpen={() => router.push(`/admin/users/${u.id}`)}
                    onMessage={() => messageUser(u, u.email ? ["email"] : ["in_app"])}
                    onTag={(t) => setTag(t)}
                  />
                ))
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {pageCount > 1 && (
        <motion.div variants={fadeUp} className="mt-3">
          <Pagination bare page={page} pageCount={pageCount} onPage={setPage} total={total} pageSize={limit} />
        </motion.div>
      )}

      {/* Floating bulk-action bar */}
      <AnimatePresence>
        {selected.size > 0 && (
          <motion.div
            initial={{ y: 24, opacity: 0, x: "-50%" }}
            animate={{ y: 0, opacity: 1, x: "-50%" }}
            exit={{ y: 24, opacity: 0, x: "-50%" }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            role="toolbar"
            aria-label="Bulk actions"
            style={{
              position: "fixed", bottom: 24, left: "50%", zIndex: 70,
              display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center",
              padding: "8px 10px 8px 16px", maxWidth: "calc(100vw - 32px)",
              background: "rgba(26,10,20,0.96)", borderRadius: 999,
              boxShadow: "0 14px 38px rgba(0,0,0,0.32), 0 0 0 1px rgba(255,255,255,0.06) inset",
              fontFamily: "var(--font-body)",
            }}
          >
            <span style={{ fontSize: 13, color: "#fff", fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{selected.size} selected</span>
            <span aria-hidden style={{ width: 1, height: 18, background: "rgba(255,255,255,0.14)" }} />
            <button
              onClick={() => setCompose({ target: { kind: "audience", audience: { type: "users", user_ids: Array.from(selected) } } })}
              disabled={busy}
              style={bulkBtn("primary")}
            >
              <Send style={{ width: 13, height: 13 }} /> Message
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setTagMenu((v) => !v)} disabled={busy} style={bulkBtn("neutral")} aria-haspopup="menu" aria-expanded={tagMenu}>
                <TagIcon style={{ width: 13, height: 13 }} /> Tag
              </button>
              {tagMenu && (
                <div role="menu" style={{
                  position: "absolute", bottom: "calc(100% + 10px)", left: 0, minWidth: 200, maxHeight: 280, overflowY: "auto",
                  background: "#fff", borderRadius: 12, padding: 6, boxShadow: "0 14px 38px rgba(26,10,20,0.22)", border: `1px solid ${C.line}`,
                }}>
                  <BulkTagInput onSubmit={bulkTag} />
                  {tagOptions.map((t) => (
                    <button key={t.tag} role="menuitem" onClick={() => bulkTag(t.tag)} className="crm-row crm-focus" style={{
                      display: "flex", width: "100%", textAlign: "left", padding: "7px 8px", border: "none", background: "transparent",
                      borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
                    }}>
                      <TagChip tag={t.tag} size="sm" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setConfirm("activate")} disabled={busy} style={bulkBtn("good")}>
              <UserCheck style={{ width: 13, height: 13 }} /> Activate
            </button>
            <button onClick={() => setConfirm("suspend")} disabled={busy} style={bulkBtn("bad")}>
              <UserX style={{ width: 13, height: 13 }} /> Suspend
            </button>
            <button
              onClick={() => setSelected(new Set())}
              disabled={busy}
              aria-label="Clear selection (Esc)"
              title="Clear selection (Esc)"
              style={{ background: "transparent", border: "none", padding: 6, color: "rgba(255,255,255,0.7)", cursor: "pointer", display: "grid", placeItems: "center" }}
            >
              <X style={{ width: 14, height: 14 }} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirm}
        variant={confirm === "suspend" ? "danger" : "default"}
        title={`${confirm === "suspend" ? "Suspend" : "Activate"} ${selected.size} member${selected.size === 1 ? "" : "s"}?`}
        message={confirm === "suspend"
          ? "Suspended members are signed out immediately and hidden from browse until reactivated."
          : "Activated members can sign in and appear in browse again (if approved)."}
        confirmLabel={busy ? "Working…" : confirm === "suspend" ? "Suspend" : "Activate"}
        onConfirm={() => confirm && runBulk(confirm)}
        onCancel={() => !busy && setConfirm(null)}
      />

      <ComposeDrawer
        open={!!compose}
        target={compose?.target || null}
        initialChannels={compose?.channels}
        onClose={() => setCompose(null)}
        onSent={() => { setSelected(new Set()); load(); }}
      />
    </PageShell>
  );
}

function BulkTagInput({ onSubmit }: { onSubmit: (t: string) => void }) {
  const [v, setV] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()); }} style={{ padding: 4, borderBottom: `1px solid ${C.line}`, marginBottom: 4 }}>
      <input autoFocus value={v} onChange={(e) => setV(e.target.value)} placeholder="New tag…" aria-label="New tag" className="crm-input" maxLength={40}
        style={{ ...inputStyle, padding: "6px 9px", fontSize: 12.5 }} />
    </form>
  );
}

function FilterSelect({ label, value, onChange, options, icon: Icon }: {
  label: string; value: string; onChange: (v: string) => void; options: Array<{ value: string; label: string }>; icon?: typeof TagIcon;
}) {
  const active = !!value;
  return (
    <label style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "0 4px 0 10px", height: 32, borderRadius: 10,
      background: active ? C.wineTint : C.surface, border: `1px solid ${active ? C.wineLine : C.line}`,
      fontSize: 12.5, color: active ? C.wineDeep : C.ink, fontWeight: 500,
    }}>
      {Icon && <Icon aria-hidden style={{ width: 13, height: 13 }} />}
      <span className="sr-only" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="crm-focus"
        style={{ border: "none", background: "transparent", fontSize: 12.5, fontWeight: 500, color: "inherit", cursor: "pointer", fontFamily: "inherit", outline: "none", padding: "6px 4px" }}
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

function bulkBtn(tone: "good" | "bad" | "primary" | "neutral"): React.CSSProperties {
  const palette = tone === "good"
    ? { bg: "rgba(92,122,82,0.22)", fg: "#b9dca3", border: "rgba(92,122,82,0.4)" }
    : tone === "bad"
    ? { bg: "rgba(220,30,60,0.22)", fg: "#ffadc0", border: "rgba(220,30,60,0.4)" }
    : tone === "primary"
    ? { bg: "#dc1e3c", fg: "#fff", border: "#dc1e3c" }
    : { bg: "rgba(255,255,255,0.08)", fg: "#fff", border: "rgba(255,255,255,0.18)" };
  return {
    display: "inline-flex", alignItems: "center", gap: 5,
    padding: "7px 13px", borderRadius: 999,
    background: palette.bg, border: `1px solid ${palette.border}`,
    color: palette.fg, fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit",
  };
}

function UserRow({
  user, checked, onToggle, onOpen, onMessage, onTag,
}: {
  user: AdminUserRow; checked: boolean; onToggle: () => void; onOpen: () => void; onMessage: () => void; onTag: (t: string) => void;
}) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || "(unnamed)";
  const phone = user.phone_e164 || user.phone;
  const fu = followUpState(user.follow_up_at);
  const tags = user.tags || [];

  return (
    <div
      role="row"
      className="crm-row"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a,button,input,label,select")) return;
        onOpen();
      }}
      style={{
        ...tableRowStyle,
        background: checked ? "rgba(220,30,60,0.05)" : undefined,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "grid", placeItems: "center" }}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select ${name}`}
          style={{ accentColor: C.wine, cursor: "pointer", width: 15, height: 15 }}
        />
      </div>

      {/* Member */}
      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 11, minWidth: 0 }}>
        <span aria-hidden style={{
          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
          background: user.primary_photo_url ? `center / cover no-repeat url(${user.primary_photo_url})` : "hsl(var(--secondary))",
          color: C.ink2, fontSize: 12.5, fontWeight: 600, display: "grid", placeItems: "center",
          boxShadow: `0 0 0 1px ${C.line}`,
        }}>
          {!user.primary_photo_url && (name[0]?.toUpperCase() || "?")}
        </span>
        <div style={{ minWidth: 0 }}>
          <Link href={`/admin/users/${user.id}`} className="crm-focus" style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", borderRadius: 4 }}>
            {name}
          </Link>
          <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {[user.membership_number, [user.city, user.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
      </div>

      {/* Contact */}
      <div role="cell" style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <div style={{ minWidth: 0, flex: 1, fontSize: 12.5, lineHeight: 1.5 }}>
          {user.email ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
              <span title={user.email} style={{ color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</span>
              {user.is_email_verified && <BadgeCheck aria-label="Email verified" size={13} strokeWidth={2.2} style={{ color: "var(--adm-good)", flexShrink: 0 }} />}
            </div>
          ) : <div style={{ color: C.faint }}>No email</div>}
          {phone ? (
            <div style={{ display: "flex", alignItems: "center", gap: 5, color: C.ink2, fontVariantNumeric: "tabular-nums", minWidth: 0, overflow: "hidden" }}>
              <span style={{ whiteSpace: "nowrap" }}>{formatPhone(phone, user.phone_country_code)}</span>
              {user.is_phone_verified && <BadgeCheck aria-label="Phone verified" size={13} strokeWidth={2.2} style={{ color: "var(--adm-good)", flexShrink: 0 }} />}
              {user.whatsapp_preferred && (
                <span title="Prefers WhatsApp" style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10.5, fontWeight: 600, color: C.wa, background: C.waTint, padding: "0 5px", borderRadius: 4 }}>
                  <MessageCircle style={{ width: 10, height: 10 }} /> WA
                </span>
              )}
            </div>
          ) : <div style={{ color: C.faint }}>No phone</div>}
        </div>
        <span className="crm-reveal" style={{ display: "inline-flex", gap: 4 }}>
          {user.email && <CopyButton value={user.email} label="Copy email" size={26} />}
          <ContactActions email={user.email} phone={phone} whatsapp={user.whatsapp_number} size={26} onEmail={onMessage} />
        </span>
      </div>

      {/* Plan · status */}
      <div role="cell" style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-start" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.ink }}>{user.plan_label || user.subscription_tier}</span>
        <StatusChip user={user} />
      </div>

      {/* Tags */}
      <div role="cell" style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center", minWidth: 0 }}>
        {tags.slice(0, 3).map((t) => (
          <button key={t} type="button" onClick={() => onTag(t)} title={`Filter by “${t}”`} style={{ border: "none", background: "none", padding: 0, cursor: "pointer" }}>
            <TagChip tag={t} size="sm" />
          </button>
        ))}
        {tags.length > 3 && <span style={{ fontSize: 11, color: C.muted }}>+{tags.length - 3}</span>}
        {fu && (
          <span title={user.follow_up_at || ""} style={{
            display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, padding: "2px 7px", borderRadius: 99,
            color: fu.tone === "bad" ? C.wineDeep : fu.tone === "warn" ? C.warn : C.ink2,
            background: fu.tone === "bad" ? C.wineTint : fu.tone === "warn" ? C.warnTint : C.sunken,
          }}>
            <CalendarClock style={{ width: 11, height: 11 }} /> {fu.label}
          </span>
        )}
        {!tags.length && !fu && <span style={{ fontSize: 12, color: C.faint }}>—</span>}
      </div>

      <div role="cell" style={{ fontSize: 12, color: user.last_contacted_at ? C.ink2 : C.faint }}>
        {user.last_contacted_at ? relTime(user.last_contacted_at) : "Never"}
      </div>

      <div role="cell" style={{ fontSize: 12, color: C.muted }} title={user.created_at || ""}>
        {user.created_at ? relTime(user.created_at) : "—"}
      </div>
    </div>
  );
}

function StatusChip({ user }: { user: AdminUserRow }) {
  // Same roles as the console Pill: good = live, info = verified, warn = waiting, bad = blocked.
  let label = "Active", tone = "good";
  if (user.deleted_at) { label = "Deleted"; tone = "neutral"; }
  else if (!user.is_active) { label = "Suspended"; tone = "bad"; }
  else if (user.verification_status === "approved") { label = "Verified"; tone = "info"; }
  else if (user.verification_status === "submitted") { label = "Pending"; tone = "warn"; }
  return (
    <span
      className={tone === "neutral" ? "border border-border/70 bg-muted2 text-muted2-foreground" : `border adm-soft-${tone}`}
      style={{ fontSize: 11, fontWeight: 500, lineHeight: "16px", padding: "1px 8px", borderRadius: 999, whiteSpace: "nowrap" }}
    >{label}</span>
  );
}

const searchBoxStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8,
  background: C.surface,
  border: `1px solid ${C.line}`,
  borderRadius: 10, padding: "0 12px", height: 36, boxSizing: "border-box", width: 360, maxWidth: "100%",
};

const searchInputStyle: React.CSSProperties = {
  flex: 1, border: "none", outline: "none", minWidth: 0,
  fontSize: 13, color: C.ink, background: "transparent",
  fontFamily: "inherit",
};

const tableHeadStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: GRID,
  gap: 12,
  position: "sticky", top: 0, zIndex: 2,
  background: "hsl(18 40% 97%)",
  borderBottom: `1px solid ${C.line}`,
  padding: "10px 16px",
  fontSize: 11.5, fontWeight: 500, color: C.muted,
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: GRID,
  gap: 12,
  padding: "10px 16px",
  borderBottom: `1px solid ${C.line}`,
  alignItems: "center",
};
