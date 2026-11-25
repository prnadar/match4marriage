"use client";

/**
 * Shared CRM primitives for the admin console: colour tokens (mapped onto
 * the console's shared tokens), contact-link builders, and the small
 * components every CRM surface uses — contact actions, channel + status
 * badges, tag chips, avatars, segmented controls, skeletons, empty states.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Check, Copy, Mail, Phone, MessageCircle, Bell, PhoneCall, MessageSquare,
  Users as UsersIcon, MoreHorizontal, type LucideIcon,
} from "lucide-react";

// ─── Tokens ──────────────────────────────────────────────────────────────────

// CRM surfaces are written with inline styles; `C` maps every one of them
// onto the console's tokens (shadcn semantic vars + the `--adm-*` status
// roles in globals.css) so CRM pages and Tailwind pages share one palette.
export const C = {
  ink: "hsl(var(--foreground))",
  ink2: "hsl(var(--secondary-foreground))",
  muted: "hsl(var(--muted-foreground))",   // ≥4.5:1 on white
  faint: "#766a70",                         // decorative / large text only
  line: "hsl(var(--border))",
  lineStrong: "hsl(346 22% 86%)",
  wine: "hsl(var(--primary))",
  wineDeep: "var(--adm-brand)",
  wineTint: "var(--adm-brand-bg)",
  wineLine: "var(--adm-brand-line)",
  surface: "hsl(var(--card))",
  panel: "hsl(var(--background))",
  sunken: "hsl(var(--secondary) / 0.7)",
  good: "var(--adm-good)",
  goodTint: "var(--adm-good-bg)",
  warn: "var(--adm-warn)",
  warnTint: "var(--adm-warn-bg)",
  info: "var(--adm-info)",
  infoTint: "var(--adm-info-bg)",
  wa: "#16794a",
  waTint: "rgba(22,121,74,0.10)",
} as const;

export const FOCUS_RING = "0 0 0 2px hsl(var(--ring) / 0.28)";

// ─── Contact links ───────────────────────────────────────────────────────────

export const mailtoHref = (email: string, subject?: string) =>
  `mailto:${email}${subject ? `?subject=${encodeURIComponent(subject)}` : ""}`;
export const telHref = (e164: string) => `tel:${e164.replace(/[^\d+]/g, "")}`;
export const waHref = (digits: string, text?: string) =>
  `https://wa.me/${digits.replace(/\D/g, "")}${text ? `?text=${encodeURIComponent(text)}` : ""}`;

/** "+447700900123" → "+44 7700 900123" (light grouping, display only). */
export function formatPhone(e164?: string | null, cc?: string | null): string {
  if (!e164) return "";
  if (!e164.startsWith("+")) return e164;
  const code = cc && e164.startsWith(cc) ? cc : null;
  const rest = code ? e164.slice(code.length) : e164.slice(1);
  const grouped = rest.length > 7
    ? `${rest.slice(0, rest.length - 6)} ${rest.slice(-6)}`
    : rest;
  return code ? `${code} ${grouped}` : `+${grouped}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

// ─── Time ────────────────────────────────────────────────────────────────────

export function relTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 172800) return "yesterday";
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return d.toLocaleDateString("en-GB", {
    day: "numeric", month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function fullTime(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

/** Follow-up date (YYYY-MM-DD) → { label, tone }. */
export function followUpState(ymd?: string | null): { label: string; tone: "bad" | "warn" | "neutral" } | null {
  if (!ymd) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${ymd}T00:00:00`);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { label: `Overdue ${-days}d`, tone: "bad" };
  if (days === 0) return { label: "Due today", tone: "warn" };
  if (days === 1) return { label: "Tomorrow", tone: "neutral" };
  return {
    label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    tone: "neutral",
  };
}

// ─── Channel + status vocabulary ─────────────────────────────────────────────

export const CHANNEL_META: Record<string, { label: string; icon: LucideIcon; fg: string; bg: string }> = {
  email:    { label: "Email",    icon: Mail,           fg: C.info,     bg: C.infoTint },
  in_app:   { label: "In-app",   icon: Bell,           fg: C.wineDeep, bg: C.wineTint },
  call:     { label: "Call",     icon: PhoneCall,      fg: C.good,     bg: C.goodTint },
  whatsapp: { label: "WhatsApp", icon: MessageCircle,  fg: C.wa,       bg: C.waTint },
  sms:      { label: "SMS",      icon: MessageSquare,  fg: C.ink2,     bg: C.sunken },
  meeting:  { label: "Meeting",  icon: UsersIcon,      fg: C.warn,     bg: C.warnTint },
  other:    { label: "Other",    icon: MoreHorizontal, fg: C.ink2,     bg: C.sunken },
};

export function ChannelIcon({ channel, size = 30 }: { channel: string; size?: number }) {
  const m = CHANNEL_META[channel] || CHANNEL_META.other;
  const Icon = m.icon;
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: size / 3, flexShrink: 0,
      display: "grid", placeItems: "center", background: m.bg, color: m.fg,
    }}>
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2} />
    </span>
  );
}

export function ChannelBadge({ channel }: { channel: string }) {
  const m = CHANNEL_META[channel] || CHANNEL_META.other;
  const Icon = m.icon;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11.5, fontWeight: 600, color: m.fg, background: m.bg,
      padding: "3px 8px", borderRadius: 6, whiteSpace: "nowrap",
    }}>
      <Icon style={{ width: 12, height: 12 }} strokeWidth={2.2} /> {m.label}
    </span>
  );
}

const STATUS_META: Record<string, { label: string; fg: string; dot: string }> = {
  sent:    { label: "Sent",    fg: C.good, dot: "var(--adm-good)" },
  logged:  { label: "Logged",  fg: C.ink2, dot: "#766a70" },
  failed:  { label: "Failed",  fg: "var(--adm-bad)", dot: "var(--adm-bad)" },
  skipped: { label: "Skipped", fg: C.warn, dot: "var(--adm-warn)" },
};

export function StatusPill({ status, title }: { status: string; title?: string }) {
  const m = STATUS_META[status] || { label: status, fg: C.ink2, dot: C.faint };
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 500, color: m.fg, whiteSpace: "nowrap",
    }}>
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 99, background: m.dot }} />
      {m.label}
    </span>
  );
}

// ─── Tags ────────────────────────────────────────────────────────────────────

export const DO_NOT_CONTACT = "Do not contact";

const TAG_TONES: Array<{ fg: string; bg: string; line: string }> = [
  { fg: "#7a1530", bg: "rgba(220,30,60,0.08)",   line: "rgba(220,30,60,0.20)" },
  { fg: "#2c4a8a", bg: "rgba(90,120,230,0.09)",  line: "rgba(90,120,230,0.22)" },
  { fg: "#3F5937", bg: "rgba(92,122,82,0.11)",   line: "rgba(92,122,82,0.24)" },
  { fg: "#7a5400", bg: "rgba(200,144,32,0.13)",  line: "rgba(200,144,32,0.28)" },
  { fg: "#5b3a7a", bg: "rgba(130,80,180,0.09)",  line: "rgba(130,80,180,0.22)" },
  { fg: "#1d5f63", bg: "rgba(30,140,150,0.10)",  line: "rgba(30,140,150,0.22)" },
];

export function tagTone(tag: string) {
  if (tag.toLowerCase() === DO_NOT_CONTACT.toLowerCase()) {
    return { fg: "#fff", bg: C.ink, line: C.ink };
  }
  if (tag.toLowerCase() === "vip") return { fg: "#7a5400", bg: "rgba(200,144,32,0.16)", line: "rgba(200,144,32,0.34)" };
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.toLowerCase().charCodeAt(i)) >>> 0;
  return TAG_TONES[h % TAG_TONES.length];
}

export function TagChip({ tag, onRemove, size = "md" }: { tag: string; onRemove?: () => void; size?: "sm" | "md" }) {
  const t = tagTone(tag);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: size === "sm" ? 11 : 12, fontWeight: 600, lineHeight: 1.2,
      color: t.fg, background: t.bg, border: `1px solid ${t.line}`,
      padding: size === "sm" ? "2px 7px" : "3px 9px", borderRadius: 999, whiteSpace: "nowrap",
    }}>
      {tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove tag ${tag}`}
          style={{
            border: "none", background: "transparent", color: "inherit", cursor: "pointer",
            padding: 0, marginLeft: 1, opacity: 0.7, fontSize: 14, lineHeight: 1, fontFamily: "inherit",
          }}
        >×</button>
      )}
    </span>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

export function Avatar({ name, url, size = 32 }: { name: string; url?: string | null; size?: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      // Initials sit on the quiet neutral chip (rose is reserved for actions).
      background: url ? `center / cover no-repeat url(${url})` : "hsl(var(--secondary))",
      color: C.ink2, fontSize: Math.max(10, size * 0.36), fontWeight: 600,
      display: "grid", placeItems: "center",
      boxShadow: `0 0 0 1px ${C.line}`,
    }}>
      {!url && (name?.trim()?.[0]?.toUpperCase() || "?")}
    </span>
  );
}

// ─── Buttons ─────────────────────────────────────────────────────────────────

export function IconAction({
  label, onClick, href, icon: Icon, tone = "neutral", external, size = 28, disabled, onAfterOpen,
}: {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
  href?: string;
  icon: LucideIcon;
  tone?: "neutral" | "wa" | "info" | "good" | "wine";
  external?: boolean;
  size?: number;
  disabled?: boolean;
  onAfterOpen?: () => void;
}) {
  const fg = tone === "wa" ? C.wa : tone === "info" ? C.info : tone === "good" ? C.good : tone === "wine" ? C.wineDeep : C.ink2;
  const style: CSSProperties = {
    width: size, height: size, borderRadius: 8, flexShrink: 0,
    display: "inline-grid", placeItems: "center",
    border: `1px solid ${C.line}`, background: C.surface, color: fg,
    cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.4 : 1,
    textDecoration: "none", transition: "background .15s, border-color .15s, transform .1s",
    outline: "none",
  };
  const common = {
    "aria-label": label,
    title: label,
    className: "crm-iconaction",
    style,
  };
  const inner = <Icon style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2} />;
  if (href && !disabled) {
    return (
      <a
        {...common}
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        onClick={(e) => { e.stopPropagation(); onClick?.(e); onAfterOpen?.(); }}
      >
        {inner}
      </a>
    );
  }
  return (
    <button {...common} type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick?.(e); }}>
      {inner}
    </button>
  );
}

export function CopyButton({ value, label, size = 28 }: { value: string; label: string; size?: number }) {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <IconAction
      label={done ? "Copied" : label}
      icon={done ? Check : Copy}
      tone={done ? "good" : "neutral"}
      size={size}
      onClick={async (e) => {
        e.preventDefault();
        if (await copyText(value)) {
          setDone(true);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => setDone(false), 1400);
        }
      }}
    />
  );
}

/**
 * The one-click contact cluster: copy, mail, call, WhatsApp. `onExternal`
 * fires after a tel: / wa.me link is opened so callers can offer to log it.
 */
export function ContactActions({
  email, phone, whatsapp, size = 28, onExternal, onEmail,
}: {
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  size?: number;
  onExternal?: (channel: "call" | "whatsapp" | "email") => void;
  /** If provided, the mail button opens the in-platform composer instead of mailto:. */
  onEmail?: () => void;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
      {email && (onEmail
        ? <IconAction label="Email from the platform" icon={Mail} tone="info" size={size} onClick={(e) => { e.preventDefault(); onEmail(); }} />
        : <IconAction label={`Email ${email}`} icon={Mail} tone="info" size={size} href={mailtoHref(email)} onAfterOpen={() => onExternal?.("email")} />)}
      {phone && <IconAction label={`Call ${phone}`} icon={Phone} tone="good" size={size} href={telHref(phone)} onAfterOpen={() => onExternal?.("call")} />}
      {whatsapp && <IconAction label="Open WhatsApp chat" icon={MessageCircle} tone="wa" size={size} href={waHref(whatsapp)} external onAfterOpen={() => onExternal?.("whatsapp")} />}
    </span>
  );
}

// ─── Segmented control ───────────────────────────────────────────────────────

export function Segmented<T extends string>({
  value, onChange, options, size = "md", ariaLabel,
}: {
  value: T;
  onChange: (v: NoInfer<T>) => void;
  options: ReadonlyArray<{ value: NoInfer<T>; label: ReactNode; count?: number }>;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} style={{
      display: "inline-flex", gap: 2, padding: 2, borderRadius: 10,
      background: C.sunken, border: `1px solid ${C.line}`, flexWrap: "wrap",
    }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className="crm-seg"
            style={{
              height: size === "sm" ? 28 : 32, padding: size === "sm" ? "0 10px" : "0 12px",
              borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: size === "sm" ? 12 : 12.5, fontWeight: 500, fontFamily: "inherit",
              color: active ? C.ink : C.muted,
              background: active ? C.surface : "transparent",
              boxShadow: active ? "0 1px 2px rgba(26,10,20,0.08), 0 0 0 1px rgba(26,10,20,0.04)" : "none",
              display: "inline-flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
              transition: "background .15s, color .15s",
            }}
          >
            {o.label}
            {typeof o.count === "number" && (
              <span style={{
                fontSize: 10.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                minWidth: 18, textAlign: "center", padding: "0 6px", borderRadius: 999, lineHeight: "16px",
                color: active ? C.wineDeep : C.muted,
                background: active ? C.wineTint : "hsl(var(--border) / 0.6)",
              }}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ─── Form bits ───────────────────────────────────────────────────────────────

export const inputStyle: CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "8px 12px", borderRadius: 10,
  border: `1px solid ${C.line}`, background: C.surface,
  fontSize: 13, color: C.ink, fontFamily: "inherit", outline: "none",
  transition: "border-color .15s, box-shadow .15s",
};

export const labelStyle: CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500, color: C.ink2, marginBottom: 6,
};

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      height: 20, minWidth: 20, boxSizing: "border-box",
      fontFamily: "inherit", fontSize: 10.5, fontWeight: 500, color: C.muted,
      padding: "0 4px", borderRadius: 4, border: `1px solid ${C.line}`,
      background: C.surface, boxShadow: "0 1px 0 rgba(26,10,20,0.06)",
    }}>{children}</kbd>
  );
}

export function SkeletonRows({ rows = 6, height = 52 }: { rows?: number; height?: number }) {
  return (
    <div aria-busy="true" aria-label="Loading" style={{ padding: "8px 12px" }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="m4m-shimmer" style={{ height, margin: "6px 0", borderRadius: 10, opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: {
  icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode;
}) {
  // Same shape as primitives.EmptyState (quiet round chip, 13px title).
  return (
    <div style={{ padding: "48px 24px", textAlign: "center" }}>
      <span aria-hidden style={{
        width: 40, height: 40, borderRadius: "50%", margin: "0 auto 12px",
        display: "grid", placeItems: "center",
        background: C.sunken, border: `1px solid ${C.line}`, color: C.muted,
      }}>
        <Icon style={{ width: 16, height: 16 }} />
      </span>
      <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: C.ink }}>{title}</p>
      {body && <p style={{ margin: "4px auto 0", fontSize: 12.5, color: C.muted, maxWidth: 380, lineHeight: 1.55 }}>{body}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

/** Global styles for CRM focus/hover states. Render once per page. */
export function CrmStyles() {
  return (
    <style>{`
      .crm-iconaction:hover { background: hsl(var(--secondary)) !important; border-color: hsl(346 22% 86%) !important; }
      .crm-iconaction:active { transform: translateY(1px); }
      .crm-iconaction:focus-visible, .crm-seg:focus-visible, .crm-focus:focus-visible { box-shadow: ${FOCUS_RING}; outline: none; }
      .crm-input:focus { border-color: hsl(var(--primary) / 0.5) !important; box-shadow: ${FOCUS_RING}; }
      .crm-row { transition: background .12s; }
      .crm-row:hover { background: hsl(var(--secondary) / 0.4); }
      .crm-row:focus-within { background: hsl(var(--secondary) / 0.5); }
      .crm-row .crm-reveal { opacity: .55; transition: opacity .15s; }
      .crm-row:hover .crm-reveal, .crm-row:focus-within .crm-reveal { opacity: 1; }
      @media (hover: none) { .crm-row .crm-reveal { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) {
        .crm-drawer, .crm-fade { transition: none !important; animation: none !important; }
      }
    `}</style>
  );
}
