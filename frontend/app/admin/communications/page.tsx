"use client";

/**
 * /admin/communications — the bureau's contact centre.
 *   • Activity log of every admin → member contact (email, in-app, logged calls)
 *   • Broadcast history with delivery counts
 *   • Follow-ups due, with one-click call / WhatsApp / email
 *   • Compose a broadcast to a segment (side drawer, recipient preview, confirm)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Megaphone, Search, X, AlertTriangle, Inbox, ChevronDown,
  CalendarClock, Check, Send, Radio, Info,
} from "lucide-react";
import { PageShell, GlassCard, Button, fadeUp } from "@/components/admin/PageShell";
import { ErrorState, Pagination } from "@/components/admin/primitives";
import { useToast } from "@/components/admin/Toast";
import { adminCrmApi } from "@/lib/api";
import ComposeDrawer, { type ComposeTarget } from "@/components/admin/crm/ComposeDrawer";
import {
  C, CrmStyles, ChannelIcon, ChannelBadge, StatusPill, Avatar, Segmented, ContactActions, Kbd,
  relTime, fullTime, followUpState, EmptyState, inputStyle,
} from "@/components/admin/crm/shared";

interface CommRow {
  id: string;
  user_id: string;
  channel: string;
  subject: string | null;
  body: string;
  status: string;
  error: string | null;
  to_address: string | null;
  admin_email: string | null;
  broadcast_id: string | null;
  meta: Record<string, any>;
  created_at: string | null;
  user?: { id: string; name: string; email: string | null; membership_number: string | null; photo_url: string | null };
}

interface Broadcast {
  id: string; admin_email: string | null; channels: string[]; audience_label: string | null; subject: string | null; body: string;
  recipient_count: number; sent_count: number; failed_count: number; skipped_count: number; status: string; created_at: string | null;
}

interface FollowUp {
  user_id: string; name: string; email: string | null; phone_e164: string | null; whatsapp_number: string | null;
  photo_url: string | null; membership_number: string | null; plan: string; tags: string[];
  follow_up_at: string | null; follow_up_note: string | null; overdue: boolean;
}

interface Stats {
  sent_7d: number; sent_30d: number; failed_30d: number; members_contacted_30d: number;
  follow_ups_due: number; follow_ups_next_7d: number; email_configured: boolean; from_email: string;
  by_channel_30d: Record<string, Record<string, number>>;
}

type ChannelFilter = "" | "email" | "in_app" | "call" | "whatsapp";

const LIMIT = 40;

export default function CommunicationsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"log" | "broadcasts">("log");
  const [stats, setStats] = useState<Stats | null>(null);

  // Log
  const [rows, setRows] = useState<CommRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qLive, setQLive] = useState("");
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState<ChannelFilter>("");
  const [status, setStatus] = useState("");
  const [days, setDays] = useState<"7" | "30" | "90" | "">("30");
  const [broadcastFilter, setBroadcastFilter] = useState<Broadcast | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Broadcasts
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [bLoading, setBLoading] = useState(false);

  // Follow-ups
  const [fuScope, setFuScope] = useState<"due" | "upcoming">("due");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [fuLoading, setFuLoading] = useState(true);

  const [compose, setCompose] = useState<{ target: ComposeTarget; channels?: Array<"email" | "in_app"> } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => { const t = setTimeout(() => setQ(qLive), 250); return () => clearTimeout(t); }, [qLive]);

  const loadStats = useCallback(() => {
    adminCrmApi.stats().then((r) => setStats((r.data as any)?.data || null)).catch(() => {});
  }, []);

  const loadLog = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const r = await adminCrmApi.listCommunications({
        q: q || undefined, channel: channel || undefined, status: status || undefined,
        days: days ? Number(days) : undefined, broadcast_id: broadcastFilter?.id, page, limit: LIMIT,
      });
      const d = r.data as any;
      setRows(d?.data || []); setTotal(d?.total || 0);
    } catch (e: any) {
      setError(e?.message || "Couldn't load the log");
    } finally { setLoading(false); }
  }, [q, channel, status, days, broadcastFilter, page]);

  const loadBroadcasts = useCallback(async () => {
    setBLoading(true);
    try {
      const r = await adminCrmApi.listBroadcasts({ limit: 50 });
      setBroadcasts((r.data as any)?.data || []);
    } catch { /* surfaced by empty state */ }
    finally { setBLoading(false); }
  }, []);

  const loadFollowUps = useCallback(async () => {
    setFuLoading(true);
    try {
      const r = await adminCrmApi.followUps(fuScope, 30);
      setFollowUps((r.data as any)?.data || []);
    } catch { setFollowUps([]); }
    finally { setFuLoading(false); }
  }, [fuScope]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadLog(); }, [loadLog]);
  useEffect(() => { setPage(1); }, [q, channel, status, days, broadcastFilter]);
  useEffect(() => { if (tab === "broadcasts") loadBroadcasts(); }, [tab, loadBroadcasts]);
  useEffect(() => { loadFollowUps(); }, [loadFollowUps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (compose || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "b") { e.preventDefault(); setCompose({ target: { kind: "audience" } }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compose]);

  const refreshAll = () => { loadStats(); loadLog(); loadFollowUps(); if (tab === "broadcasts") loadBroadcasts(); };

  const markDone = async (f: FollowUp) => {
    setFollowUps((xs) => xs.filter((x) => x.user_id !== f.user_id));
    try {
      await adminCrmApi.updateMember(f.user_id, { follow_up_at: null });
      toast("success", `Follow-up with ${f.name} marked done`);
      loadStats();
    } catch (e: any) {
      toast("error", e?.message || "Couldn't update follow-up");
      loadFollowUps();
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / LIMIT));
  const filtersActive = !!(q || channel || status || broadcastFilter || days !== "30");

  const channelCounts = useMemo(() => {
    const by = stats?.by_channel_30d || {};
    const sum = (ch: string) => Object.values(by[ch] || {}).reduce((a, b) => a + b, 0);
    return { email: sum("email"), in_app: sum("in_app"), call: sum("call"), whatsapp: sum("whatsapp") };
  }, [stats]);

  return (
    <PageShell
      title="Communications"
      subtitle="Every email, in-app message and logged call between your team and members"
      actions={
        <Button size="sm" variant="primary" onClick={() => setCompose({ target: { kind: "audience" } })} title="New broadcast (B)">
          <Megaphone style={{ width: 14, height: 14 }} aria-hidden /> New broadcast
        </Button>
      }
    >
      <CrmStyles />
      <style>{`
        .crm-comms-grid { display: grid; grid-template-columns: minmax(0, 1fr); gap: 14px; align-items: start; }
        @media (min-width: 1180px) {
          .crm-comms-grid { grid-template-columns: minmax(0, 1fr) 340px; }
          .crm-comms-rail { position: sticky; top: 96px; }
        }
        .crm-stat { padding: 14px 18px; min-width: 0; }
        .crm-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .crm-stats > * + * { border-left: 1px solid ${C.line}; }
        .crm-stats > :nth-child(3) { border-left: none; border-top: 1px solid ${C.line}; }
        .crm-stats > :nth-child(4) { border-top: 1px solid ${C.line}; }
        @media (min-width: 760px) {
          .crm-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); }
          .crm-stats > :nth-child(3) { border-left: 1px solid ${C.line}; border-top: none; }
          .crm-stats > :nth-child(4) { border-top: none; }
        }
      `}</style>

      {stats && !stats.email_configured && (
        <motion.div variants={fadeUp} role="status" style={{
          marginBottom: 14, padding: "10px 14px", borderRadius: 10, background: C.warnTint, color: C.warn, border: "1px solid var(--adm-warn-line)",
          display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.55,
        }}>
          <AlertTriangle style={{ width: 16, height: 16, flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong>Email sending is not configured.</strong> Set <code>RESEND_API_KEY</code> (and a verified <code>RESEND_FROM_EMAIL</code>, currently {stats.from_email}) on the API server.
            Until then emails are logged as failed — in-app messages, call logs and WhatsApp links work now.
          </span>
        </motion.div>
      )}

      {/* Stat strip */}
      <motion.div variants={fadeUp} style={{ marginBottom: 14 }}>
        <GlassCard padding={0}>
          <div className="crm-stats">
            <Stat label="Sent · last 7 days" value={stats?.sent_7d} hint={stats ? `${stats.sent_30d.toLocaleString("en-GB")} in 30 days` : undefined} />
            <Stat label="Members contacted · 30 days" value={stats?.members_contacted_30d}
              hint={stats ? `${channelCounts.email} email · ${channelCounts.in_app} in-app · ${channelCounts.call + channelCounts.whatsapp} calls/WA` : undefined} />
            <Stat label="Failed · 30 days" value={stats?.failed_30d} tone={stats?.failed_30d ? "bad" : undefined}
              onClick={stats?.failed_30d ? () => { setTab("log"); setStatus("failed"); setDays("30"); } : undefined}
              hint={stats?.failed_30d ? "Show failures" : "All delivered"} />
            <Stat label="Follow-ups due" value={stats?.follow_ups_due} tone={stats?.follow_ups_due ? "warn" : undefined}
              hint={stats ? `${stats.follow_ups_next_7d} more in the next 7 days` : undefined} />
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={fadeUp} className="crm-comms-grid">
        {/* Main */}
        <GlassCard padding={0} style={{ overflow: "hidden", minWidth: 0 }}>
          <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <Segmented ariaLabel="View" value={tab} onChange={setTab} options={[
              { value: "log", label: <><Inbox style={{ width: 13, height: 13 }} /> Activity</>, count: total },
              { value: "broadcasts", label: <><Radio style={{ width: 13, height: 13 }} /> Broadcasts</> },
            ]} />
            <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted, display: "inline-flex", gap: 8 }}>
              <span><Kbd>/</Kbd> search</span><span><Kbd>B</Kbd> broadcast</span>
            </span>
          </div>

          {tab === "log" ? (
            <>
              {/* Sticky filter toolbar */}
              <div style={{
                position: "sticky", top: 0, zIndex: 2, background: "#fcfaf9",
                padding: "10px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#fff", border: `1px solid ${C.lineStrong}`, borderRadius: 9, padding: "6px 10px", flex: "1 1 220px", maxWidth: 320 }}>
                  <Search aria-hidden style={{ width: 14, height: 14, color: C.muted }} />
                  <input ref={searchRef} type="search" aria-label="Search the log" value={qLive} onChange={(e) => setQLive(e.target.value)}
                    placeholder="Member, email or subject" style={{ border: "none", outline: "none", flex: 1, minWidth: 0, fontSize: 13, fontFamily: "inherit", background: "transparent", color: C.ink }} />
                  {qLive && <button aria-label="Clear search" onClick={() => setQLive("")} style={{ border: "none", background: "none", cursor: "pointer", color: C.muted, display: "flex", padding: 0 }}><X style={{ width: 13, height: 13 }} /></button>}
                </div>
                <Segmented size="sm" ariaLabel="Channel" value={channel} onChange={setChannel} options={[
                  { value: "", label: "All" }, { value: "email", label: "Email" }, { value: "in_app", label: "In-app" },
                  { value: "call", label: "Calls" }, { value: "whatsapp", label: "WhatsApp" },
                ]} />
                <select aria-label="Status" className="crm-input" value={status} onChange={(e) => setStatus(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "6px 9px", fontSize: 12.5 }}>
                  <option value="">Any status</option><option value="sent">Sent</option><option value="failed">Failed</option>
                  <option value="skipped">Skipped</option><option value="logged">Logged</option>
                </select>
                <select aria-label="Date range" className="crm-input" value={days} onChange={(e) => setDays(e.target.value as any)} style={{ ...inputStyle, width: "auto", padding: "6px 9px", fontSize: 12.5 }}>
                  <option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="">All time</option>
                </select>
                {broadcastFilter && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: C.info, background: C.infoTint, padding: "4px 6px 4px 10px", borderRadius: 8 }}>
                    Broadcast: {broadcastFilter.subject || "untitled"}
                    <button aria-label="Clear broadcast filter" onClick={() => setBroadcastFilter(null)} style={{ border: "none", background: "none", cursor: "pointer", color: "inherit", display: "flex", padding: 0 }}><X style={{ width: 13, height: 13 }} /></button>
                  </span>
                )}
              </div>

              {loading ? (
                <div style={{ padding: "6px 14px" }}>{Array.from({ length: 7 }).map((_, i) => <div key={i} className="m4m-shimmer" style={{ height: 54, borderRadius: 10, margin: "6px 0", opacity: 1 - i * 0.1 }} />)}</div>
              ) : error ? (
                <ErrorState title="Couldn't load the message log" message={error} onRetry={loadLog} />
              ) : rows.length === 0 ? (
                <EmptyState
                  icon={Inbox}
                  title={filtersActive ? "Nothing matches these filters" : "No communication yet"}
                  body={filtersActive
                    ? "Widen the date range or clear a filter."
                    : <>Message a member from their profile, or send a broadcast to a segment. Calls and WhatsApp chats you log on a member’s page show up here too.</>}
                  action={!filtersActive && <Button variant="primary" onClick={() => setCompose({ target: { kind: "audience" } })}><Megaphone style={{ width: 14, height: 14 }} aria-hidden /> New broadcast</Button>}
                />
              ) : (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {rows.map((c) => {
                    const open = expanded === c.id;
                    return (
                      <li key={c.id} style={{ borderBottom: `1px solid ${C.line}` }}>
                        <div className="crm-row" style={{ display: "grid", gridTemplateColumns: "32px minmax(150px, 0.9fr) minmax(0, 2fr) auto", gap: 12, alignItems: "center", padding: "10px 16px" }}>
                          <ChannelIcon channel={c.channel} size={30} />
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <Avatar name={c.user?.name || "?"} url={c.user?.photo_url} size={26} />
                            <div style={{ minWidth: 0 }}>
                              <Link href={`/admin/users/${c.user_id}`} className="crm-focus" style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.user?.name || "Member"}
                              </Link>
                              <div style={{ fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.to_address || c.user?.membership_number || ""}</div>
                            </div>
                          </div>
                          <button type="button" onClick={() => setExpanded(open ? null : c.id)} aria-expanded={open} className="crm-focus" style={{
                            border: "none", background: "none", textAlign: "left", padding: 0, cursor: "pointer", minWidth: 0, fontFamily: "inherit",
                          }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {c.subject || (c.status === "logged" ? `${c.channel === "call" ? "Phone call" : c.channel === "whatsapp" ? "WhatsApp" : "Contact"} logged${c.meta?.outcome ? ` · ${String(c.meta.outcome).replace(/_/g, " ")}` : ""}` : "(no subject)")}
                              </span>
                              {c.broadcast_id && <span style={{ fontSize: 10, fontWeight: 600, color: C.info, background: C.infoTint, padding: "1px 5px", borderRadius: 4, flexShrink: 0 }}>Broadcast</span>}
                              <ChevronDown aria-hidden style={{ width: 13, height: 13, color: C.muted, flexShrink: 0, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }} />
                            </div>
                            <div style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>
                              {(c.body || "").replace(/\s+/g, " ").slice(0, 140) || "—"}
                            </div>
                          </button>
                          <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                            <StatusPill status={c.status} title={c.error || undefined} />
                            <span style={{ fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }} title={fullTime(c.created_at)}>{relTime(c.created_at)}</span>
                          </div>
                        </div>
                        {open && (
                          <div style={{ padding: "0 16px 14px 60px" }}>
                            <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px" }}>
                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
                                <ChannelBadge channel={c.channel} />
                                <span>by {c.admin_email || "admin"}</span>
                                <span>{fullTime(c.created_at)}</span>
                              </div>
                              {c.error && <div style={{ marginBottom: 8, fontSize: 12.5, color: C.wineDeep, background: C.wineTint, padding: "6px 9px", borderRadius: 8 }}>{c.error}</div>}
                              <p style={{ margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowWrap: "anywhere", maxWidth: "75ch" }}>{c.body || "—"}</p>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}

              {pageCount > 1 && (
                <Pagination page={page} pageCount={pageCount} onPage={setPage} total={total} pageSize={LIMIT} />
              )}
            </>
          ) : (
            <BroadcastList
              loading={bLoading}
              items={broadcasts}
              onNew={() => setCompose({ target: { kind: "audience" } })}
              onView={(b) => { setBroadcastFilter(b); setDays(""); setChannel(""); setStatus(""); setQLive(""); setTab("log"); }}
            />
          )}
        </GlassCard>

        {/* Follow-ups rail */}
        <aside className="crm-comms-rail" style={{ minWidth: 0 }}>
          <GlassCard padding={0} style={{ overflow: "hidden" }}>
            <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 8 }}>
              <CalendarClock aria-hidden style={{ width: 15, height: 15, color: C.wineDeep }} />
              <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 600, color: C.ink, flex: 1 }}>Follow-ups</h2>
              <Segmented size="sm" ariaLabel="Follow-up scope" value={fuScope} onChange={setFuScope} options={[
                { value: "due", label: "Due", count: stats?.follow_ups_due },
                { value: "upcoming", label: "Upcoming" },
              ]} />
            </div>
            {fuLoading ? (
              <div style={{ padding: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="m4m-shimmer" style={{ height: 58, borderRadius: 10, marginBottom: 8 }} />)}</div>
            ) : followUps.length === 0 ? (
              <EmptyState
                icon={Check}
                title={fuScope === "due" ? "You're all caught up" : "Nothing scheduled"}
                body={<>Set a follow-up date on any member’s page and it lands here on the day.</>}
              />
            ) : (
              <ul style={{ listStyle: "none", margin: 0, padding: "4px 0" }}>
                {followUps.map((f) => {
                  const st = followUpState(f.follow_up_at);
                  return (
                    <li key={f.user_id} className="crm-row" style={{ padding: "10px 16px", borderBottom: `1px solid ${C.line}` }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <Avatar name={f.name} url={f.photo_url} size={32} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Link href={`/admin/users/${f.user_id}`} className="crm-focus" style={{ fontSize: 13, fontWeight: 600, color: C.ink, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{f.name}</Link>
                            {st && (
                              <span style={{
                                fontSize: 11, fontWeight: 600, padding: "1px 7px", borderRadius: 99, flexShrink: 0,
                                color: st.tone === "bad" ? C.wineDeep : st.tone === "warn" ? C.warn : C.ink2,
                                background: st.tone === "bad" ? C.wineTint : st.tone === "warn" ? C.warnTint : C.sunken,
                              }}>{st.label}</span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: C.muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {f.follow_up_note || `${f.plan}${f.membership_number ? ` · ${f.membership_number}` : ""}`}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8 }}>
                            <ContactActions
                              email={f.email}
                              phone={f.phone_e164}
                              whatsapp={f.whatsapp_number}
                              size={26}
                              onEmail={() => setCompose({ channels: ["email"], target: { kind: "user", user: { id: f.user_id, first_name: f.name.split(" ")[0], last_name: f.name.split(" ").slice(1).join(" "), email: f.email, phone_e164: f.phone_e164, membership_number: f.membership_number, plan_label: f.plan, primary_photo_url: f.photo_url } } })}
                            />
                            <button type="button" onClick={() => markDone(f)} className="crm-focus" style={{
                              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600,
                              color: C.good, background: C.goodTint, border: "none", borderRadius: 7, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit",
                            }}><Check style={{ width: 12, height: 12 }} /> Done</button>
                          </div>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {followUps.length > 0 && (
              <div style={{ padding: "10px 16px" }}>
                <Link href={`/admin/users?follow_up=${fuScope === "due" ? "due" : "upcoming"}`} style={{ fontSize: 12.5, fontWeight: 600, color: C.wineDeep, textDecoration: "none" }}>
                  Open in Users →
                </Link>
              </div>
            )}
          </GlassCard>

          <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.6)", border: `1px solid ${C.line}`, fontSize: 12, color: C.muted, lineHeight: 1.55, display: "flex", gap: 8 }}>
            <Info aria-hidden style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} />
            <span>
              Need a member’s details right now? Their email, phone and WhatsApp are on every row in <Link href="/admin/users" style={{ color: C.wineDeep, fontWeight: 600 }}>Users</Link>, and in the Contact panel on their profile.
            </span>
          </div>
        </aside>
      </motion.div>

      <ComposeDrawer
        open={!!compose}
        target={compose?.target || null}
        initialChannels={compose?.channels}
        onClose={() => setCompose(null)}
        onSent={refreshAll}
      />
    </PageShell>
  );
}

function Stat({ label, value, hint, tone, onClick }: {
  label: string; value?: number; hint?: string; tone?: "bad" | "warn"; onClick?: () => void;
}) {
  const color = tone === "bad" ? "var(--adm-bad)" : tone === "warn" ? C.warn : C.ink;
  const inner = (
    <>
      <div style={{ fontSize: 12, fontWeight: 500, color: C.muted }}>{label}</div>
      {value === undefined ? (
        <div className="m4m-shimmer" style={{ height: 26, width: 60, borderRadius: 6, marginTop: 6 }} />
      ) : (
        <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1, color, marginTop: 6, fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>{value.toLocaleString("en-GB")}</div>
      )}
      {hint && <div style={{ fontSize: 11.5, color: onClick ? C.wineDeep : C.muted, marginTop: 2, fontWeight: onClick ? 600 : 400, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hint}</div>}
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="crm-stat crm-focus crm-row" style={{ textAlign: "left", border: "none", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>{inner}</button>
  ) : <div className="crm-stat">{inner}</div>;
}

function BroadcastList({ loading, items, onNew, onView }: {
  loading: boolean; items: Broadcast[]; onNew: () => void; onView: (b: Broadcast) => void;
}) {
  if (loading) {
    return <div style={{ padding: "6px 14px" }}>{[0, 1, 2, 3].map((i) => <div key={i} className="m4m-shimmer" style={{ height: 74, borderRadius: 10, margin: "6px 0" }} />)}</div>;
  }
  if (!items.length) {
    return (
      <EmptyState
        icon={Megaphone}
        title="No broadcasts yet"
        body="Reach many members at once — everyone on Premium, profiles still incomplete, subscriptions expiring this fortnight, or anyone you’ve tagged."
        action={<Button variant="primary" onClick={onNew}><Send style={{ width: 13, height: 13 }} /> Compose a broadcast</Button>}
      />
    );
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((b) => {
        const delivered = b.recipient_count ? Math.round((b.sent_count / Math.max(1, b.sent_count + b.failed_count + b.skipped_count)) * 100) : 0;
        const tone = b.status === "completed" ? C.good : b.status === "partial" ? C.warn : C.wineDeep;
        return (
          <li key={b.id} className="crm-row" style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 280px", minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.subject || "(no subject)"}</div>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  {b.channels.map((ch) => <ChannelBadge key={ch} channel={ch} />)}
                  <span>{b.audience_label || "Audience"}</span>
                  <span>· {b.admin_email || "admin"}</span>
                  <span title={fullTime(b.created_at)}>· {relTime(b.created_at)}</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                    {b.recipient_count.toLocaleString("en-GB")} <span style={{ fontWeight: 500, color: C.muted }}>recipients</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: tone, fontWeight: 600 }}>
                    {b.sent_count} sent{b.failed_count ? ` · ${b.failed_count} failed` : ""}{b.skipped_count ? ` · ${b.skipped_count} skipped` : ""}
                  </div>
                  <div aria-hidden style={{ marginTop: 5, width: 140, height: 4, borderRadius: 99, background: C.sunken, overflow: "hidden", marginLeft: "auto" }}>
                    <div style={{ width: `${delivered}%`, height: "100%", background: tone }} />
                  </div>
                </div>
                <button type="button" onClick={() => onView(b)} className="crm-focus" style={{
                  border: `1px solid ${C.lineStrong}`, background: "#fff", color: C.ink2, fontSize: 12, fontWeight: 600,
                  borderRadius: 8, padding: "6px 10px", cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
                }}>View recipients</button>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
