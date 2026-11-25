"use client";

/**
 * ComposeDrawer — one side drawer for every admin → member message:
 *   • a single member (from the user detail page or a list row)
 *   • a bulk selection from the users list
 *   • a segment broadcast (all, plan, verification, gender, country,
 *     incomplete profiles, expiring subscriptions, CRM tag, follow-ups due)
 *
 * Channels: email (via Resend) and/or in-app notification. Optional start
 * from an admin mail template; {{merge_fields}} are substituted per member on
 * the server. Bulk sends show a live recipient count and require
 * confirmation. ⌘/Ctrl+Enter sends, Esc closes.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X, Send, Mail, Bell, Eye, PenLine, FileText, AlertTriangle, Users as UsersIcon, Loader2, Info,
} from "lucide-react";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { useToast } from "@/components/admin/Toast";
import { adminCrmApi, type CrmAudience } from "@/lib/api";
import {
  C, Avatar, Kbd, Segmented, inputStyle, labelStyle, DO_NOT_CONTACT, CrmStyles,
} from "./shared";

export interface ComposeRecipient {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone_e164?: string | null;
  membership_number?: string | null;
  plan_label?: string | null;
  city?: string | null;
  country?: string | null;
  primary_photo_url?: string | null;
}

export type ComposeTarget =
  | { kind: "user"; user: ComposeRecipient }
  | { kind: "audience"; audience?: CrmAudience };

type Channel = "email" | "in_app";

interface Template { key: string; name: string; subject: string; body_html: string; body_text?: string | null; is_active: boolean }
interface Meta {
  tags: Array<{ tag: string; count: number }>;
  suggested_tags: string[];
  countries: Array<{ country: string; count: number }>;
  segments: Array<{ key: string; label: string }>;
  merge_fields: string[];
  email_configured: boolean;
}
interface Preview {
  count: number; with_email: number; without_email: number; label: string; capped: boolean; max: number;
  sample: Array<{ id: string; name: string; email: string | null; photo_url: string | null }>;
}

const MERGE_LABELS: Record<string, string> = {
  first_name: "First name", last_name: "Last name", full_name: "Full name", email: "Email",
  phone: "Phone", membership_number: "Member no.", plan: "Plan", city: "City", country: "Country",
};

const PLAN_OPTIONS = [
  { value: "free", label: "Free" }, { value: "silver", label: "Basic" },
  { value: "gold", label: "Premium" }, { value: "platinum", label: "Elite" },
];
const VERIFICATION_OPTIONS = [
  { value: "approved", label: "Approved" }, { value: "submitted", label: "Pending review" },
  { value: "rejected", label: "Rejected" }, { value: "draft", label: "Not submitted" },
];
const GENDER_OPTIONS = [{ value: "female", label: "Female" }, { value: "male", label: "Male" }, { value: "other", label: "Other" }];
const EXPIRING_OPTIONS = [{ value: "7", label: "Next 7 days" }, { value: "14", label: "Next 14 days" }, { value: "30", label: "Next 30 days" }];
const SEGMENTS_NEEDING_VALUE = new Set(["plan", "verification", "gender", "country", "tag", "expiring"]);

const LINK_SUGGESTIONS = [
  { value: "", label: "No link" },
  { value: "/subscription", label: "Subscription" },
  { value: "/profile/me", label: "My profile" },
  { value: "/matches", label: "Matches" },
  { value: "/messages", label: "Messages" },
  { value: "/settings", label: "Settings" },
];

function mergeSample(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (m, k) => (k.toLowerCase() in ctx ? ctx[k.toLowerCase()] : m));
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export default function ComposeDrawer({
  open, target, onClose, onSent, initialChannels,
}: {
  open: boolean;
  target: ComposeTarget | null;
  onClose: () => void;
  onSent?: () => void;
  initialChannels?: Channel[];
}) {
  const { toast } = useToast();
  const isUser = target?.kind === "user";
  const user = target?.kind === "user" ? target.user : null;
  const initialAudience = target?.kind === "audience" ? target.audience : undefined;
  const hasSelection = initialAudience?.type === "users";

  // ── Message state
  const [channels, setChannels] = useState<Set<Channel>>(new Set<Channel>(["email"]));
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [bodyFormat, setBodyFormat] = useState<"text" | "html">("text");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [replyTo, setReplyTo] = useState("");
  const [actionUrl, setActionUrl] = useState("");
  const [isMarketing, setIsMarketing] = useState(false);
  const [view, setView] = useState<"write" | "preview">("write");
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // ── Audience state
  const [audMode, setAudMode] = useState<"selection" | "segment">("segment");
  const [segment, setSegment] = useState("all");
  const [segValue, setSegValue] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");
  const restoreFocus = useRef<HTMLElement | null>(null);

  // Reset whenever the drawer opens for a new target.
  useEffect(() => {
    if (!open) return;
    restoreFocus.current = (document.activeElement as HTMLElement) || null;
    const defaults: Channel[] = initialChannels?.length
      ? initialChannels
      : user && !user.email ? ["in_app"] : ["email"];
    setChannels(new Set<Channel>(defaults));
    setSubject(""); setBody(""); setBodyFormat("text"); setTemplateKey("");
    setReplyTo(""); setActionUrl(""); setView("write"); setConfirmOpen(false); setSending(false);
    setAudMode(hasSelection ? "selection" : "segment");
    if (initialAudience?.type === "segment") {
      setSegment(initialAudience.segment); setSegValue(initialAudience.value || "");
    } else {
      setSegment("all"); setSegValue("");
    }
    setPreview(null); setPreviewError(null);
    const t = setTimeout(() => subjectRef.current?.focus(), 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, target]);

  // Load templates + meta once per open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    adminCrmApi.listTemplates()
      .then((r) => { if (alive) setTemplates(((r.data as any)?.data?.templates || []).filter((t: Template) => t.is_active)); })
      .catch(() => {});
    adminCrmApi.meta()
      .then((r) => { if (alive) setMeta((r.data as any)?.data || null); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open]);

  // Body scroll lock + return focus.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
      restoreFocus.current?.focus?.();
    };
  }, [open]);

  // ── Audience resolution
  const audience: CrmAudience | null = useMemo(() => {
    if (isUser) return null;
    if (audMode === "selection" && initialAudience?.type === "users") return initialAudience;
    if (SEGMENTS_NEEDING_VALUE.has(segment) && !segValue) return null;
    return { type: "segment", segment, value: segValue || undefined };
  }, [isUser, audMode, initialAudience, segment, segValue]);

  useEffect(() => {
    if (!open || isUser) return;
    if (!audience) { setPreview(null); setPreviewError(null); return; }
    let alive = true;
    setPreviewLoading(true);
    const t = setTimeout(() => {
      adminCrmApi.previewAudience(audience)
        .then((r) => { if (alive) { setPreview((r.data as any)?.data || null); setPreviewError(null); } })
        .catch((e: any) => { if (alive) { setPreview(null); setPreviewError(e?.message || "Couldn't count recipients"); } })
        .finally(() => { if (alive) setPreviewLoading(false); });
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [open, isUser, audience]);

  // ── Helpers
  const toggleChannel = (c: Channel) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (next.has(c)) { if (next.size > 1) next.delete(c); } else next.add(c);
      return next;
    });
  };

  const insertMerge = (field: string) => {
    const token = `{{${field}}}`;
    const el = lastFocused.current === "subject" ? subjectRef.current : bodyRef.current;
    const set = lastFocused.current === "subject" ? setSubject : setBody;
    const cur = lastFocused.current === "subject" ? subject : body;
    if (!el) { set(cur + token); return; }
    const start = el.selectionStart ?? cur.length;
    const end = el.selectionEnd ?? cur.length;
    const next = cur.slice(0, start) + token + cur.slice(end);
    set(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const applyTemplate = (key: string) => {
    setTemplateKey(key);
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    setSubject(t.subject || "");
    if (t.body_text && t.body_text.trim()) { setBody(t.body_text); setBodyFormat("text"); }
    else { setBody(t.body_html || ""); setBodyFormat("html"); }
  };

  const sampleCtx = useMemo<Record<string, string>>(() => {
    if (user) {
      return {
        first_name: user.first_name || "there",
        last_name: user.last_name || "",
        full_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || "Member",
        email: user.email || "",
        phone: user.phone_e164 || "",
        membership_number: user.membership_number || "",
        plan: user.plan_label || "Free",
        city: user.city || "",
        country: user.country || "",
      };
    }
    const first = preview?.sample?.[0]?.name?.split(" ")?.[0] || "Asha";
    return {
      first_name: first, last_name: "Patel", full_name: `${first} Patel`, email: "member@example.com",
      phone: "+44 7700 900123", membership_number: "M4M2026001", plan: "Premium", city: "Leicester", country: "United Kingdom",
    };
  }, [user, preview]);

  const recipientCount = isUser ? 1 : preview?.count ?? 0;
  const emailOn = channels.has("email");
  const inAppOn = channels.has("in_app");
  const userHasNoEmail = isUser && !user?.email;

  const problems: string[] = [];
  if (!subject.trim()) problems.push(emailOn ? "Add a subject" : "Add a title");
  if (!body.trim()) problems.push("Write a message");
  if (isUser && emailOn && userHasNoEmail && !inAppOn) problems.push("This member has no email — use In-app");
  if (!isUser && !audience) problems.push("Choose who to send to");
  if (!isUser && preview && preview.count === 0) problems.push("No members match this audience");
  if (!isUser && preview?.capped) problems.push(`Audience is over ${preview.max} — narrow it`);
  if (actionUrl && !actionUrl.startsWith("/")) problems.push("Link must start with /");
  const canSend = problems.length === 0 && !sending && (isUser || (!!preview && !previewLoading));

  const payload = () => ({
    channels: Array.from(channels),
    subject: subject.trim(),
    body,
    body_format: bodyFormat,
    template_key: templateKey || null,
    reply_to: replyTo.trim() || null,
    action_url: inAppOn && actionUrl.trim() ? actionUrl.trim() : null,
    is_marketing: emailOn && isMarketing,
  });

  const doSend = useCallback(async () => {
    if (!target) return;
    setSending(true);
    try {
      if (target.kind === "user") {
        const res = await adminCrmApi.sendToMember(target.user.id, payload());
        const data = (res.data as any)?.data || {};
        const failed = (data.results || []).filter((r: any) => r.status === "failed" || r.status === "skipped");
        if (failed.length) {
          toast("error", `${failed.map((f: any) => f.channel === "email" ? "Email" : "In-app").join(" & ")} not delivered: ${failed[0].error || "unknown error"}. Logged on the timeline.`);
        } else {
          toast("success", emailOn && inAppOn ? "Email and in-app message sent" : emailOn ? "Email sent" : "In-app message sent");
        }
      } else if (audience) {
        const res = await adminCrmApi.sendBroadcast({ ...payload(), audience, expected_count: preview?.count });
        const b = (res.data as any)?.data || {};
        const tone = b.status === "completed" ? "success" : b.status === "partial" ? "warning" : "error";
        toast(tone as any, `Broadcast to ${b.recipient_count} member${b.recipient_count === 1 ? "" : "s"}: ${b.sent_count} sent${b.failed_count ? `, ${b.failed_count} failed` : ""}${b.skipped_count ? `, ${b.skipped_count} skipped (no email)` : ""}`);
      }
      setConfirmOpen(false);
      onSent?.();
      onClose();
    } catch (e: any) {
      toast("error", e?.message || "Send failed");
      setConfirmOpen(false);
    } finally {
      setSending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, audience, preview, channels, subject, body, bodyFormat, templateKey, replyTo, actionUrl, isMarketing]);

  const requestSend = () => {
    if (!canSend) return;
    if (isUser) doSend();
    else setConfirmOpen(true);
  };

  // Keyboard: Esc closes, ⌘/Ctrl+Enter sends.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (confirmOpen) return;
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); requestSend(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const userName = user ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email || "Member" : "";
  const segmentValueOptions = (() => {
    switch (segment) {
      case "plan": return PLAN_OPTIONS;
      case "verification": return VERIFICATION_OPTIONS;
      case "gender": return GENDER_OPTIONS;
      case "expiring": return EXPIRING_OPTIONS;
      case "country": return (meta?.countries || []).map((c) => ({ value: c.country, label: `${c.country} (${c.count})` }));
      case "tag": {
        const used = new Map((meta?.tags || []).map((t) => [t.tag, t.count]));
        const all = Array.from(new Set([...(meta?.tags || []).map((t) => t.tag), ...(meta?.suggested_tags || [])]))
          .filter((t) => t !== DO_NOT_CONTACT);
        return all.map((t) => ({ value: t, label: `${t}${used.has(t) ? ` (${used.get(t)})` : ""}` }));
      }
      default: return [];
    }
  })();

  const previewHtml = useMemo(() => {
    const s = mergeSample(subject, sampleCtx);
    if (bodyFormat === "html") {
      const ctxEsc = Object.fromEntries(Object.entries(sampleCtx).map(([k, v]) => [k, escapeHtml(v)]));
      return { subject: s, html: mergeSample(body, ctxEsc) };
    }
    const paras = mergeSample(body, sampleCtx).split(/\n\s*\n/).filter((p) => p.trim());
    return { subject: s, html: paras.map((p) => `<p style="margin:0 0 14px">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`).join("") };
  }, [subject, body, bodyFormat, sampleCtx]);

  const sendLabel = isUser
    ? `Send${emailOn && inAppOn ? " email + in-app" : emailOn ? " email" : " in-app message"}`
    : previewLoading ? "Counting…" : `Send to ${recipientCount.toLocaleString("en-GB")} member${recipientCount === 1 ? "" : "s"}`;

  return (
    <>
      <CrmStyles />
      <AnimatePresence>
        {open && target && (
          <>
            <motion.div
              key="crm-backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              aria-hidden
              style={{ position: "fixed", inset: 0, background: "rgba(26,10,20,0.28)", zIndex: 79 }}
            />
            <motion.aside
              key="crm-drawer"
              role="dialog"
              aria-modal="true"
              aria-labelledby="crm-compose-title"
              className="crm-drawer"
              initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 80,
                width: "min(620px, 100vw)", background: C.panel,
                boxShadow: "-18px 0 48px rgba(26,10,20,0.16)", borderLeft: `1px solid ${C.line}`,
                display: "flex", flexDirection: "column",
                fontFamily: "var(--font-body)",
              }}
            >
              {/* Header */}
              <header style={{
                padding: "16px 20px", borderBottom: `1px solid ${C.line}`, background: "#fff",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                {isUser ? (
                  <Avatar name={userName} url={user?.primary_photo_url} size={36} />
                ) : (
                  <span aria-hidden style={{ width: 36, height: 36, borderRadius: 12, display: "grid", placeItems: "center", background: C.wineTint, color: C.wineDeep }}>
                    <UsersIcon style={{ width: 18, height: 18 }} />
                  </span>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 id="crm-compose-title" style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.ink }}>
                    {isUser ? `Message ${userName}` : "New broadcast"}
                  </h2>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {isUser
                      ? (user?.email || "No email on file — in-app only")
                      : "Email and/or in-app notification to many members at once"}
                  </p>
                </div>
                <button type="button" onClick={onClose} aria-label="Close composer" className="crm-iconaction"
                  style={{ width: 32, height: 32, borderRadius: 9, border: `1px solid ${C.line}`, background: "#fff", cursor: "pointer", display: "grid", placeItems: "center", color: C.ink2 }}>
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </header>

              {/* Scrollable body */}
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Audience */}
                {!isUser && (
                  <section aria-label="Recipients">
                    <span style={labelStyle}>To</span>
                    {hasSelection && (
                      <div style={{ marginBottom: 10 }}>
                        <Segmented
                          size="sm"
                          ariaLabel="Audience type"
                          value={audMode}
                          onChange={setAudMode}
                          options={[
                            { value: "selection", label: `Selected members (${(initialAudience as any).user_ids.length})` },
                            { value: "segment", label: "A segment" },
                          ]}
                        />
                      </div>
                    )}
                    {audMode === "segment" && (
                      <div style={{ display: "grid", gridTemplateColumns: SEGMENTS_NEEDING_VALUE.has(segment) ? "1fr 1fr" : "1fr", gap: 8 }}>
                        <select
                          aria-label="Segment"
                          className="crm-input"
                          value={segment}
                          onChange={(e) => { setSegment(e.target.value); setSegValue(e.target.value === "expiring" ? "14" : ""); }}
                          style={inputStyle}
                        >
                          {(meta?.segments || [{ key: "all", label: "All active members" }]).map((s) => (
                            <option key={s.key} value={s.key}>{s.label}</option>
                          ))}
                        </select>
                        {SEGMENTS_NEEDING_VALUE.has(segment) && (
                          <select aria-label="Segment value" className="crm-input" value={segValue} onChange={(e) => setSegValue(e.target.value)} style={inputStyle}>
                            <option value="">Choose…</option>
                            {segmentValueOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Recipient preview */}
                    <div aria-live="polite" style={{
                      marginTop: 10, padding: "12px 14px", borderRadius: 12,
                      background: "#fff", border: `1px solid ${C.line}`,
                      display: "flex", alignItems: "center", gap: 12, minHeight: 52,
                    }}>
                      {previewLoading ? (
                        <><Loader2 className="animate-spin" style={{ width: 16, height: 16, color: C.muted }} /><span style={{ fontSize: 13, color: C.muted }}>Counting recipients…</span></>
                      ) : previewError ? (
                        <><AlertTriangle style={{ width: 16, height: 16, color: C.wine }} /><span style={{ fontSize: 13, color: C.wineDeep }}>{previewError}</span></>
                      ) : preview ? (
                        <>
                          <div style={{ display: "flex" }}>
                            {preview.sample.slice(0, 5).map((s, i) => (
                              <span key={s.id} style={{ marginLeft: i ? -8 : 0 }} title={s.name}><Avatar name={s.name} url={s.photo_url} size={26} /></span>
                            ))}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, fontVariantNumeric: "tabular-nums" }}>
                              {preview.count.toLocaleString("en-GB")} member{preview.count === 1 ? "" : "s"}
                              <span style={{ fontWeight: 500, color: C.muted }}> · {preview.label}</span>
                            </div>
                            {emailOn && (
                              <div style={{ fontSize: 12, color: preview.without_email ? C.warn : C.muted, marginTop: 2 }}>
                                {preview.with_email.toLocaleString("en-GB")} with email
                                {preview.without_email > 0 && ` · ${preview.without_email} will be skipped for email${inAppOn ? " (still get in-app)" : ""}`}
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 13, color: C.muted }}>Pick a segment to see who will receive this.</span>
                      )}
                    </div>
                    {audMode === "segment" && (
                      <p style={{ margin: "8px 2px 0", fontSize: 11.5, color: C.muted, display: "flex", gap: 6, alignItems: "flex-start" }}>
                        <Info style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
                        Segments skip suspended members and anyone tagged “{DO_NOT_CONTACT}”.
                      </p>
                    )}
                  </section>
                )}

                {/* Channels */}
                <section aria-label="Channels">
                  <span style={labelStyle}>Send as</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <ChannelToggle
                      on={emailOn} onClick={() => toggleChannel("email")} icon={Mail}
                      title="Email" hint={isUser ? (user?.email || "No email on file") : "Branded email to their inbox"}
                      disabled={!!userHasNoEmail}
                    />
                    <ChannelToggle
                      on={inAppOn} onClick={() => toggleChannel("in_app")} icon={Bell}
                      title="In-app" hint="Appears in their Notifications"
                    />
                  </div>
                  {emailOn && meta && !meta.email_configured && (
                    <div role="status" style={{
                      marginTop: 10, padding: "10px 12px", borderRadius: 10, background: C.warnTint,
                      color: C.warn, fontSize: 12.5, display: "flex", gap: 8, lineHeight: 1.5,
                    }}>
                      <AlertTriangle style={{ width: 15, height: 15, flexShrink: 0, marginTop: 1 }} />
                      <span>Email sending isn’t configured on the server (RESEND_API_KEY). Emails will be logged as failed until it is set; in-app messages still work.</span>
                    </div>
                  )}
                </section>

                {/* Template */}
                {templates.length > 0 && (
                  <section>
                    <label htmlFor="crm-template" style={labelStyle}>Start from a template <span style={{ fontWeight: 500, color: C.muted }}>(optional)</span></label>
                    <div style={{ position: "relative" }}>
                      <FileText aria-hidden style={{ position: "absolute", left: 11, top: 11, width: 15, height: 15, color: C.muted }} />
                      <select id="crm-template" className="crm-input" value={templateKey} onChange={(e) => applyTemplate(e.target.value)} style={{ ...inputStyle, paddingLeft: 33 }}>
                        <option value="">Blank message</option>
                        {templates.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}
                      </select>
                    </div>
                  </section>
                )}

                {/* Subject */}
                <section>
                  <label htmlFor="crm-subject" style={labelStyle}>{emailOn ? "Subject" : "Title"}</label>
                  <input
                    id="crm-subject"
                    ref={subjectRef}
                    className="crm-input"
                    value={subject}
                    maxLength={255}
                    onFocus={() => { lastFocused.current = "subject"; }}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={isUser ? "e.g. A quick hello from Match4Marriage" : "e.g. New members in your area this month"}
                    style={inputStyle}
                  />
                </section>

                {/* Body */}
                <section>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, gap: 8 }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>
                      Message {bodyFormat === "html" && <span style={{ fontWeight: 500, color: C.muted }}>· HTML from template</span>}
                    </span>
                    <Segmented
                      size="sm"
                      ariaLabel="Editor view"
                      value={view}
                      onChange={setView}
                      options={[
                        { value: "write", label: <><PenLine style={{ width: 12, height: 12 }} /> Write</> },
                        { value: "preview", label: <><Eye style={{ width: 12, height: 12 }} /> Preview</> },
                      ]}
                    />
                  </div>
                  {view === "write" ? (
                    <textarea
                      ref={bodyRef}
                      className="crm-input"
                      value={body}
                      onFocus={() => { lastFocused.current = "body"; }}
                      onChange={(e) => setBody(e.target.value)}
                      rows={11}
                      aria-label="Message body"
                      placeholder={"Dear {{first_name}},\n\nWrite your message here. Leave a blank line between paragraphs."}
                      style={{ ...inputStyle, resize: "vertical", lineHeight: 1.6, minHeight: 200, fontFamily: bodyFormat === "html" ? "ui-monospace, SFMono-Regular, Menlo, monospace" : "inherit", fontSize: bodyFormat === "html" ? 12.5 : 13.5 }}
                    />
                  ) : (
                    <div style={{ borderRadius: 12, border: `1px solid ${C.line}`, background: "#f9f6f1", padding: 14 }}>
                      <div style={{ fontSize: 11.5, color: C.muted, marginBottom: 8 }}>
                        Preview for <strong style={{ color: C.ink2 }}>{sampleCtx.full_name}</strong>{!isUser && " (sample member)"}
                      </div>
                      <div style={{ background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <div style={{ background: C.ink, color: "#fff", textAlign: "center", padding: "14px 0", fontSize: 15, letterSpacing: 1, fontWeight: 600 }}>Match4Marriage</div>
                        <div style={{ padding: "18px 22px" }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: C.ink, marginBottom: 12 }}>{previewHtml.subject || <span style={{ color: C.faint }}>No subject</span>}</div>
                          {bodyFormat === "html" ? (
                            <iframe title="Email preview" sandbox="" srcDoc={`<div style="font-family:Arial,sans-serif;font-size:14px;color:#444;line-height:1.6">${previewHtml.html}</div>`} style={{ width: "100%", height: 260, border: "none" }} />
                          ) : (
                            <div style={{ fontSize: 14, color: "#444", lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: previewHtml.html || `<p style="color:#bbb">Nothing written yet.</p>` }} />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Merge fields */}
                  <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                    <span style={{ fontSize: 11.5, color: C.muted, marginRight: 2 }}>Insert:</span>
                    {(meta?.merge_fields || Object.keys(MERGE_LABELS)).map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="crm-focus"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => { if (view !== "write") setView("write"); insertMerge(f); }}
                        title={`Insert {{${f}}}`}
                        style={{
                          fontSize: 11.5, fontWeight: 600, color: C.ink2, background: "#fff",
                          border: `1px dashed ${C.lineStrong}`, borderRadius: 6, padding: "3px 7px", cursor: "pointer", fontFamily: "inherit",
                        }}
                      >{MERGE_LABELS[f] || f}</button>
                    ))}
                  </div>
                </section>

                {/* Options */}
                <section style={{ display: "grid", gridTemplateColumns: emailOn && inAppOn ? "1fr 1fr" : "1fr", gap: 10 }}>
                  {emailOn && (
                    <div>
                      <label htmlFor="crm-replyto" style={labelStyle}>Reply-to <span style={{ fontWeight: 500, color: C.muted }}>(optional)</span></label>
                      <input id="crm-replyto" type="email" className="crm-input" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="team@yourbureau.co.uk" style={inputStyle} />
                    </div>
                  )}
                  {inAppOn && (
                    <div>
                      <label htmlFor="crm-link" style={labelStyle}>In-app button links to</label>
                      <select id="crm-link" className="crm-input" value={LINK_SUGGESTIONS.some((l) => l.value === actionUrl) ? actionUrl : "__custom"} onChange={(e) => setActionUrl(e.target.value === "__custom" ? "/" : e.target.value)} style={inputStyle}>
                        {LINK_SUGGESTIONS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
                        <option value="__custom">Custom path…</option>
                      </select>
                      {!LINK_SUGGESTIONS.some((l) => l.value === actionUrl) && (
                        <input aria-label="Custom link path" className="crm-input" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} placeholder="/subscription" style={{ ...inputStyle, marginTop: 6 }} />
                      )}
                    </div>
                  )}
                </section>

                {emailOn && (
                  <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: C.muted, cursor: "pointer" }}>
                    <input type="checkbox" checked={isMarketing} onChange={(e) => setIsMarketing(e.target.checked)} style={{ marginTop: 2 }} />
                    <span>
                      <strong style={{ color: "inherit", fontWeight: 600 }}>Promotional message</strong> (offers, upgrades, newsletters).
                      Email goes only to members who opted in to &ldquo;News &amp; offers&rdquo;; others are skipped and logged.
                    </span>
                  </label>
                )}
              </div>

              {/* Footer */}
              <footer style={{
                padding: "12px 20px", borderTop: `1px solid ${C.line}`, background: "#fff",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <div style={{ flex: 1, minWidth: 0, fontSize: 12, color: problems.length ? C.warn : C.muted }}>
                  {problems.length
                    ? problems[0]
                    : <>Logged to the member’s timeline · <Kbd>⌘</Kbd> <Kbd>Enter</Kbd> to send</>}
                </div>
                <button type="button" onClick={onClose} className="crm-focus" style={{
                  padding: "9px 14px", borderRadius: 10, border: `1px solid ${C.line}`, background: "#fff",
                  fontSize: 13, fontWeight: 600, color: C.ink2, cursor: "pointer", fontFamily: "inherit",
                }}>Cancel</button>
                <button
                  type="button"
                  onClick={requestSend}
                  disabled={!canSend}
                  className="crm-focus"
                  style={{
                    height: 36, padding: "0 14px", borderRadius: 10, border: `1px solid ${C.wine}`,
                    background: C.wine, opacity: canSend ? 1 : 0.5,
                    color: "#fff", fontSize: 13, fontWeight: 500, cursor: canSend ? "pointer" : "not-allowed",
                    display: "inline-flex", alignItems: "center", gap: 7, fontFamily: "inherit",
                    boxShadow: "0 1px 2px rgba(160,21,60,0.25)", whiteSpace: "nowrap",
                  }}
                >
                  {sending ? <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} /> : <Send style={{ width: 14, height: 14 }} />}
                  {sending ? "Sending…" : sendLabel}
                </button>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <ConfirmModal
        open={confirmOpen}
        variant="warning"
        title={`Send to ${recipientCount.toLocaleString("en-GB")} member${recipientCount === 1 ? "" : "s"}?`}
        message={[
          preview?.label ? `Audience: ${preview.label}.` : "",
          `Channels: ${[emailOn && "email", inAppOn && "in-app notification"].filter(Boolean).join(" + ")}.`,
          emailOn && preview?.without_email ? `${preview.without_email} without an email address will be skipped for email.` : "",
          "This can't be undone.",
        ].filter(Boolean).join(" ")}
        confirmLabel={sending ? "Sending…" : "Send now"}
        onConfirm={() => { if (!sending) doSend(); }}
        onCancel={() => { if (!sending) setConfirmOpen(false); }}
      />
    </>
  );
}

function ChannelToggle({
  on, onClick, icon: Icon, title, hint, disabled,
}: {
  on: boolean; onClick: () => void; icon: typeof Mail; title: string; hint: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onClick}
      disabled={disabled}
      className="crm-focus"
      style={{
        textAlign: "left", display: "flex", gap: 10, alignItems: "flex-start",
        padding: "11px 12px", borderRadius: 12, cursor: disabled ? "not-allowed" : "pointer",
        background: on ? "#fff" : "transparent",
        border: `1px solid ${on ? C.wine : C.line}`,
        boxShadow: on ? `inset 0 0 0 1px ${C.wine}` : "none",
        opacity: disabled ? 0.5 : 1, fontFamily: "inherit",
        transition: "border-color .15s, background .15s, box-shadow .15s",
      }}
    >
      <span aria-hidden style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0, display: "grid", placeItems: "center",
        background: on ? C.wineTint : C.sunken, color: on ? C.wineDeep : C.muted,
      }}>
        <Icon style={{ width: 15, height: 15 }} />
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink }}>{title}</span>
        <span style={{ display: "block", fontSize: 11.5, color: C.muted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hint}</span>
      </span>
      <span aria-hidden style={{
        marginLeft: "auto", width: 16, height: 16, borderRadius: 5, flexShrink: 0, marginTop: 2,
        border: on ? "none" : `1.5px solid ${C.lineStrong}`, background: on ? C.wine : "#fff",
        display: "grid", placeItems: "center", color: "#fff", fontSize: 11, fontWeight: 600,
      }}>{on ? "✓" : ""}</span>
    </button>
  );
}
