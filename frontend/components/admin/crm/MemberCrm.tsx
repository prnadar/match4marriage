"use client";

/**
 * Member-level CRM building blocks for /admin/users/[id]:
 *   useMemberCrm   – loads tags, follow-up, notes, communication timeline
 *   ContactCard    – every way to reach the member, one click each
 *   TagsFollowUp   – tag editor + follow-up date/note
 *   NotesCard      – internal staff notes (pin, edit, delete)
 *   Timeline       – admin → member communication log + "log a contact"
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Mail, Phone, MessageCircle, MapPin, Clock, BadgeCheck, ShieldAlert, Send, Bell,
  Pin, PinOff, Trash2, Pencil, CalendarClock, Plus, StickyNote, History, ChevronDown, PhoneCall, X,
  UserRound,
} from "lucide-react";
import { adminCrmApi, type CrmChannel } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";
import {
  C, ChannelIcon, ChannelBadge, StatusPill, TagChip, CopyButton, ContactActions, Segmented,
  inputStyle, labelStyle, relTime, fullTime, followUpState, formatPhone, DO_NOT_CONTACT, EmptyState,
  mailtoHref, telHref, waHref, Kbd,
} from "./shared";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MemberContact {
  id: string;
  email: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  phone_e164?: string | null;
  phone_country_code?: string | null;
  phone_source?: "account" | "profile" | null;
  alt_phone?: string | null;
  whatsapp_number?: string | null;
  whatsapp_available?: boolean;
  whatsapp_preferred?: boolean;
  preferred_contact?: string | null;
  best_time_to_call?: string | null;
  contact_person_name?: string | null;
  contact_relationship?: string | null;
  address?: string | null;
  created_at: string | null;
  last_active_at: string | null;
}

export interface Communication {
  id: string;
  channel: CrmChannel;
  subject: string | null;
  body: string;
  status: "sent" | "failed" | "skipped" | "logged";
  error: string | null;
  to_address: string | null;
  admin_email: string | null;
  broadcast_id: string | null;
  template_key: string | null;
  meta: Record<string, any>;
  created_at: string | null;
  sent_at: string | null;
}

export interface Note { id: string; body: string; pinned: boolean; admin_email: string | null; created_at: string | null; updated_at: string | null }

export interface MemberCrmData {
  tags: string[];
  follow_up_at: string | null;
  follow_up_note: string | null;
  notes: Note[];
  communications: Communication[];
  stats: { total: number; by_channel: Record<string, number>; last_contacted_at: string | null };
}

export function useMemberCrm(userId: string | undefined) {
  const [data, setData] = useState<MemberCrmData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await adminCrmApi.getMember(userId);
      setData((r.data as any)?.data || null);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Couldn't load CRM data");
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useEffect(() => { reload(); }, [reload]);
  return { data, setData, loading, error, reload };
}

// ─── Shells ──────────────────────────────────────────────────────────────────

export function Panel({ title, icon: Icon, actions, children, pad = 16 }: {
  title: string; icon?: typeof Mail; actions?: ReactNode; children: ReactNode; pad?: number;
}) {
  return (
    <section style={{
      background: "rgba(255,255,255,0.88)", border: `1px solid rgba(220,30,60,0.08)`, borderRadius: 16,
      boxShadow: "0 4px 24px rgba(26,10,20,0.04)", overflow: "hidden",
    }}>
      <header style={{
        display: "flex", alignItems: "center", gap: 8, padding: "12px 16px",
        borderBottom: `1px solid ${C.line}`,
      }}>
        {Icon && <Icon aria-hidden style={{ width: 15, height: 15, color: C.wineDeep }} />}
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 650, color: C.ink, flex: 1 }}>{title}</h3>
        {actions}
      </header>
      <div style={{ padding: pad }}>{children}</div>
    </section>
  );
}

function SmallButton({ children, onClick, tone = "neutral", disabled, type = "button", title }: {
  children: ReactNode; onClick?: () => void; tone?: "neutral" | "primary" | "danger"; disabled?: boolean; type?: "button" | "submit"; title?: string;
}) {
  const s = tone === "primary"
    ? { bg: C.ink, fg: "#fff", line: C.ink }
    : tone === "danger" ? { bg: "#fff", fg: C.wineDeep, line: C.wineLine } : { bg: "#fff", fg: C.ink2, line: C.lineStrong };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className="crm-focus" style={{
      display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 11px", borderRadius: 8,
      background: s.bg, color: s.fg, border: `1px solid ${s.line}`, fontSize: 12.5, fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1, fontFamily: "inherit", whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

// ─── Contact card ────────────────────────────────────────────────────────────

export function ContactCard({ user, onEmail, onInApp, onExternal, lastContactedAt }: {
  user: MemberContact;
  onEmail: () => void;
  onInApp: () => void;
  onExternal: (channel: "call" | "whatsapp" | "email") => void;
  lastContactedAt?: string | null;
}) {
  const phone = user.phone_e164 || null;
  const phoneDisplay = formatPhone(phone, user.phone_country_code);
  const verified = (ok: boolean, label: string) => ok
    ? <span title={`${label} verified`} style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, color: C.good }}><BadgeCheck style={{ width: 13, height: 13 }} /> Verified</span>
    : <span title={`${label} not verified`} style={{ fontSize: 11, fontWeight: 600, color: C.muted }}>Unverified</span>;

  return (
    <Panel title="Contact" icon={UserRound} pad={0}>
      <div style={{ padding: "6px 0" }}>
        <ContactRow icon={Mail} label="Email" empty={!user.email && "No email on file"}
          value={user.email && <a href={mailtoHref(user.email)} onClick={() => onExternal("email")} style={{ color: C.ink, textDecoration: "none", wordBreak: "break-all" }}>{user.email}</a>}
          meta={user.email && verified(user.is_email_verified, "Email")}
          actions={user.email && <CopyButton value={user.email} label="Copy email" size={26} />}
        />
        <ContactRow icon={Phone} label="Phone" empty={!phone && "No phone number"}
          value={phone && <a href={telHref(phone)} onClick={() => onExternal("call")} style={{ color: C.ink, textDecoration: "none", fontVariantNumeric: "tabular-nums" }}>{phoneDisplay}</a>}
          meta={phone && <>
            {verified(user.is_phone_verified, "Phone")}
            {user.phone_source === "profile" && <span style={{ fontSize: 11, color: C.muted }}>· from profile</span>}
          </>}
          actions={phone && <CopyButton value={phone} label="Copy phone" size={26} />}
        />
        <ContactRow icon={MessageCircle} label="WhatsApp" iconColor={C.wa}
          empty={!user.whatsapp_number && "Needs a phone number with country code"}
          value={user.whatsapp_number && <a href={waHref(user.whatsapp_number)} target="_blank" rel="noopener noreferrer" onClick={() => onExternal("whatsapp")} style={{ color: C.wa, textDecoration: "none", fontWeight: 600 }}>Open chat</a>}
          meta={user.whatsapp_preferred
            ? <span style={{ fontSize: 11, fontWeight: 650, color: C.wa, background: C.waTint, padding: "1px 7px", borderRadius: 99 }}>Preferred</span>
            : user.whatsapp_number ? <span style={{ fontSize: 11, color: C.muted }}>If they use WhatsApp</span> : null}
        />
        {user.alt_phone && (
          <ContactRow icon={Phone} label="Alt. phone" value={<a href={telHref(user.alt_phone)} style={{ color: C.ink, textDecoration: "none" }}>{formatPhone(user.alt_phone)}</a>}
            actions={<CopyButton value={user.alt_phone} label="Copy alternate phone" size={26} />} />
        )}
        {(user.preferred_contact || user.best_time_to_call) && (
          <ContactRow icon={Clock} label="Prefers"
            value={<span style={{ color: C.ink }}>{[user.preferred_contact, user.best_time_to_call && `${user.best_time_to_call.toLowerCase()}s`].filter(Boolean).join(", ")}</span>} />
        )}
        {user.contact_person_name && (
          <ContactRow icon={UserRound} label="Contact person"
            value={<span style={{ color: C.ink }}>{user.contact_person_name}{user.contact_relationship ? <span style={{ color: C.muted }}> · {user.contact_relationship}</span> : null}</span>} />
        )}
        {user.address && (
          <ContactRow icon={MapPin} label="Address" value={<span style={{ color: C.ink }}>{user.address}</span>}
            actions={<CopyButton value={user.address} label="Copy address" size={26} />} />
        )}
      </div>
      <div style={{ padding: "12px 16px", borderTop: `1px solid ${C.line}`, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton tone="primary" onClick={onEmail} disabled={!user.email} title={user.email ? "Email from the platform (logged)" : "No email on file"}>
          <Send style={{ width: 13, height: 13 }} /> Email
        </SmallButton>
        <SmallButton onClick={onInApp}><Bell style={{ width: 13, height: 13 }} /> In-app message</SmallButton>
        <span style={{ marginLeft: "auto" }}>
          <ContactActions phone={phone} whatsapp={user.whatsapp_number} onExternal={onExternal} />
        </span>
      </div>
      <div style={{ padding: "0 16px 12px", fontSize: 11.5, color: C.muted, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <span>Joined {user.created_at ? new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}</span>
        <span>Active {relTime(user.last_active_at)}</span>
        <span>Last contacted {lastContactedAt ? relTime(lastContactedAt) : "never"}</span>
      </div>
    </Panel>
  );
}

function ContactRow({ icon: Icon, label, value, meta, actions, empty, iconColor }: {
  icon: typeof Mail; label: string; value?: ReactNode; meta?: ReactNode; actions?: ReactNode; empty?: string | false | null; iconColor?: string;
}) {
  return (
    <div className="crm-row" style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 10, alignItems: "start", padding: "9px 16px" }}>
      <Icon aria-hidden style={{ width: 15, height: 15, color: iconColor || C.muted, marginTop: 2 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.muted, marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.4 }}>
          {value || <span style={{ color: C.faint }}>{empty || "—"}</span>}
        </div>
        {meta && <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 3 }}>{meta}</div>}
      </div>
      {actions && <div className="crm-reveal">{actions}</div>}
    </div>
  );
}

// ─── Tags + follow-up ────────────────────────────────────────────────────────

export function TagsFollowUp({ userId, data, onChange, suggestions }: {
  userId: string;
  data: Pick<MemberCrmData, "tags" | "follow_up_at" | "follow_up_note">;
  onChange: (next: Pick<MemberCrmData, "tags" | "follow_up_at" | "follow_up_note">) => void;
  suggestions: string[];
}) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [noteDraft, setNoteDraft] = useState(data.follow_up_note || "");
  useEffect(() => { setNoteDraft(data.follow_up_note || ""); }, [data.follow_up_note]);

  const save = async (patch: { tags?: string[]; follow_up_at?: string | null; follow_up_note?: string | null }, msg?: string) => {
    setSaving(true);
    const prev = { tags: data.tags, follow_up_at: data.follow_up_at, follow_up_note: data.follow_up_note };
    onChange({ ...prev, ...patch } as any); // optimistic
    try {
      const r = await adminCrmApi.updateMember(userId, patch);
      onChange((r.data as any)?.data || { ...prev, ...patch });
      if (msg) toast("success", msg);
    } catch (e: any) {
      onChange(prev);
      toast("error", e?.message || "Couldn't save");
    } finally {
      setSaving(false);
    }
  };

  const addTag = (t: string) => {
    const tag = t.trim().replace(/\s+/g, " ").slice(0, 40);
    if (!tag) return;
    if (data.tags.some((x) => x.toLowerCase() === tag.toLowerCase())) { setDraft(""); return; }
    save({ tags: [...data.tags, tag] });
    setDraft("");
  };
  const removeTag = (t: string) => save({ tags: data.tags.filter((x) => x !== t) });

  const available = suggestions.filter((s) => !data.tags.some((t) => t.toLowerCase() === s.toLowerCase()));
  const filtered = draft ? available.filter((s) => s.toLowerCase().includes(draft.toLowerCase())) : available;
  const fu = followUpState(data.follow_up_at);
  const quickDate = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const dnc = data.tags.some((t) => t.toLowerCase() === DO_NOT_CONTACT.toLowerCase());

  return (
    <Panel title="Tags & follow-up" icon={CalendarClock}>
      {dnc && (
        <div role="status" style={{ marginBottom: 12, padding: "8px 10px", borderRadius: 9, background: C.ink, color: "#fff", fontSize: 12, display: "flex", gap: 7, alignItems: "center" }}>
          <ShieldAlert style={{ width: 14, height: 14 }} /> Do not contact — excluded from all segment broadcasts.
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10, minHeight: 24 }}>
        {data.tags.length === 0 && <span style={{ fontSize: 12.5, color: C.faint }}>No tags yet</span>}
        {data.tags.map((t) => <TagChip key={t} tag={t} onRemove={() => removeTag(t)} />)}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); addTag(draft); }} style={{ display: "flex", gap: 6 }}>
        <input
          className="crm-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a tag and press Enter"
          aria-label="New tag"
          maxLength={40}
          style={{ ...inputStyle, padding: "7px 10px", fontSize: 13 }}
        />
        <SmallButton type="submit" disabled={!draft.trim() || saving}><Plus style={{ width: 13, height: 13 }} /> Add</SmallButton>
      </form>
      {filtered.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
          {filtered.slice(0, 10).map((s) => (
            <button key={s} type="button" onClick={() => addTag(s)} className="crm-focus" style={{
              fontSize: 11.5, fontWeight: 600, color: C.muted, background: "transparent",
              border: `1px dashed ${C.lineStrong}`, borderRadius: 99, padding: "2px 9px", cursor: "pointer", fontFamily: "inherit",
            }}>+ {s}</button>
          ))}
        </div>
      )}

      <div style={{ height: 1, background: C.line, margin: "16px -16px" }} />

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ ...labelStyle, marginBottom: 0 }}>Follow up on</span>
        {fu && (
          <span style={{
            fontSize: 11.5, fontWeight: 650, padding: "2px 8px", borderRadius: 99,
            color: fu.tone === "bad" ? C.wineDeep : fu.tone === "warn" ? C.warn : C.ink2,
            background: fu.tone === "bad" ? C.wineTint : fu.tone === "warn" ? C.warnTint : C.sunken,
          }}>{fu.label}</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="date"
          className="crm-input"
          aria-label="Follow-up date"
          value={data.follow_up_at || ""}
          onChange={(e) => save({ follow_up_at: e.target.value || null }, e.target.value ? "Follow-up scheduled" : "Follow-up cleared")}
          style={{ ...inputStyle, padding: "7px 10px", fontSize: 13 }}
        />
        {data.follow_up_at && (
          <SmallButton onClick={() => save({ follow_up_at: null }, "Follow-up marked done")} title="Clear follow-up">
            Done
          </SmallButton>
        )}
      </div>
      {!data.follow_up_at && (
        <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
          {[["Tomorrow", 1], ["In 3 days", 3], ["Next week", 7], ["In 2 weeks", 14]].map(([l, d]) => (
            <button key={l as string} type="button" onClick={() => save({ follow_up_at: quickDate(d as number) }, "Follow-up scheduled")} className="crm-focus" style={{
              fontSize: 11.5, fontWeight: 600, color: C.ink2, background: C.sunken, border: "none",
              borderRadius: 7, padding: "4px 9px", cursor: "pointer", fontFamily: "inherit",
            }}>{l}</button>
          ))}
        </div>
      )}
      {data.follow_up_at && (
        <input
          className="crm-input"
          aria-label="Follow-up reason"
          value={noteDraft}
          maxLength={500}
          onChange={(e) => setNoteDraft(e.target.value)}
          onBlur={() => { if ((noteDraft || "") !== (data.follow_up_note || "")) save({ follow_up_note: noteDraft || null }); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          placeholder="What's the follow-up about?"
          style={{ ...inputStyle, padding: "7px 10px", fontSize: 13, marginTop: 8 }}
        />
      )}
    </Panel>
  );
}

// ─── Notes ───────────────────────────────────────────────────────────────────

export function NotesCard({ userId, notes, onNotes }: { userId: string; notes: Note[]; onNotes: (n: Note[]) => void }) {
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const sorted = useMemo(() => [...notes].sort((a, b) =>
    Number(b.pinned) - Number(a.pinned) || (b.created_at || "").localeCompare(a.created_at || "")), [notes]);

  const add = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      const r = await adminCrmApi.addNote(userId, { body: draft.trim() });
      onNotes([(r.data as any).data, ...notes]);
      setDraft("");
    } catch (e: any) { toast("error", e?.message || "Couldn't save note"); }
    finally { setSaving(false); }
  };
  const patch = async (id: string, body: { body?: string; pinned?: boolean }) => {
    try {
      const r = await adminCrmApi.updateNote(userId, id, body);
      onNotes(notes.map((n) => n.id === id ? (r.data as any).data : n));
    } catch (e: any) { toast("error", e?.message || "Couldn't update note"); }
  };
  const del = async (id: string) => {
    const prev = notes;
    onNotes(notes.filter((n) => n.id !== id));
    setConfirmDel(null);
    try { await adminCrmApi.deleteNote(userId, id); }
    catch (e: any) { onNotes(prev); toast("error", e?.message || "Couldn't delete note"); }
  };

  return (
    <Panel title="Internal notes" icon={StickyNote} actions={<span style={{ fontSize: 11.5, color: C.muted }}>Only admins see these</span>}>
      <div style={{ position: "relative" }}>
        <textarea
          id="crm-note-input"
          className="crm-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); add(); } }}
          rows={3}
          placeholder="e.g. Spoke to her mother — looking for a doctor in the Midlands"
          aria-label="New note"
          style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5, fontSize: 13 }}
        />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
          <span style={{ fontSize: 11, color: C.muted }}><Kbd>⌘</Kbd> <Kbd>Enter</Kbd> to save</span>
          <SmallButton tone="primary" onClick={add} disabled={!draft.trim() || saving}>{saving ? "Saving…" : "Add note"}</SmallButton>
        </div>
      </div>

      {sorted.length > 0 && <div style={{ height: 1, background: C.line, margin: "14px -16px 4px" }} />}
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {sorted.map((n) => (
          <li key={n.id} className="crm-row" style={{ padding: "10px 0", borderBottom: `1px solid ${C.line}` }}>
            {editing === n.id ? (
              <div>
                <textarea className="crm-input" value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} aria-label="Edit note"
                  onKeyDown={(e) => {
                    if (e.key === "Escape") setEditing(null);
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (editText.trim()) { patch(n.id, { body: editText.trim() }); setEditing(null); } }
                  }}
                  style={{ ...inputStyle, fontSize: 13, lineHeight: 1.5 }} autoFocus />
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", marginTop: 6 }}>
                  <SmallButton onClick={() => setEditing(null)}>Cancel</SmallButton>
                  <SmallButton tone="primary" disabled={!editText.trim()} onClick={() => { patch(n.id, { body: editText.trim() }); setEditing(null); }}>Save</SmallButton>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  {n.pinned && <Pin aria-label="Pinned" style={{ width: 13, height: 13, color: C.wine, marginTop: 3, flexShrink: 0 }} />}
                  <p style={{ margin: 0, fontSize: 13, color: C.ink, lineHeight: 1.55, whiteSpace: "pre-wrap", flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>{n.body}</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                  <span style={{ fontSize: 11.5, color: C.muted, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={fullTime(n.created_at)}>
                    {n.admin_email || "Admin"} · {relTime(n.created_at)}
                  </span>
                  {confirmDel === n.id ? (
                    <>
                      <span style={{ fontSize: 11.5, color: C.wineDeep }}>Delete?</span>
                      <SmallButton tone="danger" onClick={() => del(n.id)}>Delete</SmallButton>
                      <SmallButton onClick={() => setConfirmDel(null)}>Keep</SmallButton>
                    </>
                  ) : (
                    <span className="crm-reveal" style={{ display: "inline-flex", gap: 2 }}>
                      <NoteIcon label={n.pinned ? "Unpin" : "Pin to top"} onClick={() => patch(n.id, { pinned: !n.pinned })}>{n.pinned ? <PinOff /> : <Pin />}</NoteIcon>
                      <NoteIcon label="Edit" onClick={() => { setEditing(n.id); setEditText(n.body); }}><Pencil /></NoteIcon>
                      <NoteIcon label="Delete" onClick={() => setConfirmDel(n.id)}><Trash2 /></NoteIcon>
                    </span>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function NoteIcon({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="crm-iconaction" style={{
      width: 26, height: 26, borderRadius: 7, border: "1px solid transparent", background: "transparent",
      color: C.muted, display: "grid", placeItems: "center", cursor: "pointer",
    }}>
      <span style={{ width: 13, height: 13, display: "grid", placeItems: "center" }}>{children}</span>
    </button>
  );
}

// ─── Log contact ─────────────────────────────────────────────────────────────

const OUTCOMES: Record<string, Array<{ value: string; label: string }>> = {
  call: [{ value: "reached", label: "Spoke to them" }, { value: "no_answer", label: "No answer" }, { value: "voicemail", label: "Left voicemail" }, { value: "wrong_number", label: "Wrong number" }],
  whatsapp: [{ value: "sent", label: "Message sent" }, { value: "replied", label: "They replied" }, { value: "no_reply", label: "No reply yet" }],
  default: [{ value: "done", label: "Done" }, { value: "follow_up", label: "Needs follow-up" }],
};

export function LogContactForm({ userId, initialChannel = "call", onLogged, onCancel, compact }: {
  userId: string;
  initialChannel?: "call" | "whatsapp" | "sms" | "meeting" | "email" | "other";
  onLogged: (c: Communication) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const { toast } = useToast();
  const [channel, setChannel] = useState(initialChannel);
  const [outcome, setOutcome] = useState(OUTCOMES[initialChannel]?.[0]?.value || "done");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setChannel(initialChannel); setOutcome((OUTCOMES[initialChannel] || OUTCOMES.default)[0].value); }, [initialChannel]);
  const outcomes = OUTCOMES[channel] || OUTCOMES.default;

  const submit = async () => {
    setSaving(true);
    try {
      const r = await adminCrmApi.logContact(userId, { channel, body: body.trim(), outcome });
      onLogged((r.data as any).data);
      toast("success", "Contact logged");
      setBody("");
    } catch (e: any) { toast("error", e?.message || "Couldn't log contact"); }
    finally { setSaving(false); }
  };

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      style={{ padding: compact ? 0 : 14, borderRadius: 12, background: compact ? "transparent" : C.sunken, display: "flex", flexDirection: "column", gap: 8 }}
    >
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select aria-label="Channel" className="crm-input" value={channel} onChange={(e) => { const v = e.target.value as any; setChannel(v); setOutcome((OUTCOMES[v] || OUTCOMES.default)[0].value); }} style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 13 }}>
          <option value="call">Phone call</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="sms">SMS / text</option>
          <option value="meeting">Meeting</option>
          <option value="email">Email (outside platform)</option>
          <option value="other">Other</option>
        </select>
        <select aria-label="Outcome" className="crm-input" value={outcome} onChange={(e) => setOutcome(e.target.value)} style={{ ...inputStyle, width: "auto", padding: "7px 10px", fontSize: 13 }}>
          {outcomes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <textarea className="crm-input" value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="What was discussed? (optional)" aria-label="Contact summary"
        onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } }}
        style={{ ...inputStyle, fontSize: 13, lineHeight: 1.5, resize: "vertical" }} />
      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
        {onCancel && <SmallButton onClick={onCancel}>Cancel</SmallButton>}
        <SmallButton tone="primary" type="submit" disabled={saving}><PhoneCall style={{ width: 13, height: 13 }} /> {saving ? "Logging…" : "Log contact"}</SmallButton>
      </div>
    </form>
  );
}

// ─── Timeline ────────────────────────────────────────────────────────────────

const OUTCOME_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(OUTCOMES).flat().map((o) => [o.value, o.label]),
);

export function Timeline({ userId, items, loading, onLogged, logPrompt, onDismissPrompt, onCompose }: {
  userId: string;
  items: Communication[];
  loading: boolean;
  onLogged: (c: Communication) => void;
  /** Set after an admin clicks tel:/WhatsApp so we can offer to log it. */
  logPrompt: "call" | "whatsapp" | "email" | null;
  onDismissPrompt: () => void;
  onCompose: () => void;
}) {
  const [filter, setFilter] = useState<"all" | "messages" | "calls">("all");
  const [logOpen, setLogOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const promptRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (logPrompt) promptRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [logPrompt]);

  const shown = items.filter((c) =>
    filter === "all" ? true : filter === "messages" ? ((c.channel === "email" || c.channel === "in_app") && c.status !== "logged") : !(c.channel === "email" || c.channel === "in_app") || c.status === "logged");
  const counts = {
    all: items.length,
    messages: items.filter((c) => (c.channel === "email" || c.channel === "in_app") && c.status !== "logged").length,
    calls: items.filter((c) => !(c.channel === "email" || c.channel === "in_app") || c.status === "logged").length,
  };

  return (
    <Panel
      title="Communication"
      icon={History}
      pad={0}
      actions={
        <div style={{ display: "flex", gap: 6 }}>
          <SmallButton onClick={() => setLogOpen((v) => !v)}><PhoneCall style={{ width: 13, height: 13 }} /> Log contact</SmallButton>
          <SmallButton tone="primary" onClick={onCompose}><Send style={{ width: 13, height: 13 }} /> Message</SmallButton>
        </div>
      }
    >
      {logPrompt && (
        <div ref={promptRef} style={{ padding: 14, borderBottom: `1px solid ${C.line}`, background: "rgba(92,122,82,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <ChannelIcon channel={logPrompt === "email" ? "email" : logPrompt} size={24} />
            <strong style={{ fontSize: 13, color: C.ink, flex: 1 }}>
              {logPrompt === "call" ? "How did the call go?" : logPrompt === "whatsapp" ? "Log this WhatsApp conversation?" : "Log the email you sent?"}
            </strong>
            <button type="button" aria-label="Dismiss" onClick={onDismissPrompt} className="crm-iconaction" style={{ width: 26, height: 26, borderRadius: 7, border: "none", background: "transparent", color: C.muted, cursor: "pointer", display: "grid", placeItems: "center" }}>
              <X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <LogContactForm compact userId={userId} initialChannel={logPrompt} onLogged={(c) => { onLogged(c); onDismissPrompt(); }} onCancel={onDismissPrompt} />
        </div>
      )}
      {logOpen && !logPrompt && (
        <div style={{ padding: 14, borderBottom: `1px solid ${C.line}` }}>
          <LogContactForm userId={userId} onLogged={(c) => { onLogged(c); setLogOpen(false); }} onCancel={() => setLogOpen(false)} />
        </div>
      )}

      <div style={{ padding: "10px 16px", borderBottom: `1px solid ${C.line}` }}>
        <Segmented size="sm" ariaLabel="Filter timeline" value={filter} onChange={setFilter} options={[
          { value: "all", label: "All", count: counts.all },
          { value: "messages", label: "Messages", count: counts.messages },
          { value: "calls", label: "Calls & logged", count: counts.calls },
        ]} />
      </div>

      {loading ? (
        <div style={{ padding: 16 }}>{[0, 1, 2].map((i) => <div key={i} className="m4m-shimmer" style={{ height: 54, borderRadius: 10, marginBottom: 8 }} />)}</div>
      ) : shown.length === 0 ? (
        <EmptyState
          icon={History}
          title={items.length ? "Nothing in this filter" : "No contact yet"}
          body={items.length ? undefined : "Emails, in-app messages and logged calls with this member will build up here, so the whole team can see the history."}
          action={!items.length && <SmallButton tone="primary" onClick={onCompose}><Send style={{ width: 13, height: 13 }} /> Send the first message</SmallButton>}
        />
      ) : (
        <ol style={{ listStyle: "none", margin: 0, padding: "6px 0" }}>
          {shown.map((c, i) => {
            const open = expanded.has(c.id);
            const long = (c.body || "").length > 160;
            return (
              <li key={c.id} style={{ display: "grid", gridTemplateColumns: "44px 1fr", padding: "0 16px 0 10px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ paddingTop: 12 }}><ChannelIcon channel={c.channel} size={28} /></div>
                  {i < shown.length - 1 && <span aria-hidden style={{ flex: 1, width: 1, background: C.line, marginTop: 4 }} />}
                </div>
                <div style={{ padding: "12px 0 14px", borderBottom: i < shown.length - 1 ? `1px solid ${C.line}` : "none", minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 650, color: C.ink, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {c.subject || (c.status === "logged" ? `${(c.channel === "call" ? "Phone call" : c.channel === "whatsapp" ? "WhatsApp" : c.channel.charAt(0).toUpperCase() + c.channel.slice(1))}${c.meta?.outcome ? ` · ${OUTCOME_LABEL[c.meta.outcome] || c.meta.outcome}` : ""}` : "(no subject)")}
                    </span>
                    {c.broadcast_id && <span style={{ fontSize: 10.5, fontWeight: 700, color: C.info, background: C.infoTint, padding: "1px 6px", borderRadius: 5 }}>Broadcast</span>}
                    <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted, whiteSpace: "nowrap" }} title={fullTime(c.created_at)}>{relTime(c.created_at)}</span>
                  </div>
                  <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}>
                    <StatusPill status={c.status} title={c.error || undefined} />
                    <span style={{ fontSize: 11.5, color: C.muted }}>
                      by {c.admin_email || "admin"}{c.to_address ? ` → ${c.to_address}` : ""}
                    </span>
                  </div>
                  {c.error && c.status !== "sent" && (
                    <div style={{ marginTop: 6, fontSize: 12, color: C.wineDeep, background: C.wineTint, padding: "6px 9px", borderRadius: 8 }}>{c.error}</div>
                  )}
                  {c.body && (
                    <div style={{ marginTop: 6 }}>
                      <p style={{
                        margin: 0, fontSize: 13, color: C.ink2, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere",
                        ...(open || !long ? {} : { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any, overflow: "hidden" }),
                      }}>{c.body}</p>
                      {long && (
                        <button type="button" className="crm-focus" onClick={() => setExpanded((s) => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })}
                          style={{ marginTop: 4, border: "none", background: "none", padding: 0, color: C.wineDeep, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "inherit" }}>
                          {open ? "Show less" : "Show full message"} <ChevronDown style={{ width: 12, height: 12, transform: open ? "rotate(180deg)" : "none" }} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Panel>
  );
}

export { ChannelBadge };
