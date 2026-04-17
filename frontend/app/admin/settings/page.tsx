"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ShieldCheck, Plus, Trash2, Lock,
  Globe, Search as SearchIcon, Mail, Palette, CreditCard,
} from "lucide-react";
import { PageShell, Button, GlassCard, fadeUp } from "@/components/admin/PageShell";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";

// ─── Tabbed shell ────────────────────────────────────────────────────────────

type TabKey = "site" | "admins" | "seo" | "mail" | "appearance" | "payment-gateway";

const TABS: Array<{ key: TabKey; label: string; icon: any; available: boolean }> = [
  { key: "site",            label: "Site",            icon: Globe,       available: true },
  { key: "admins",          label: "Admins",          icon: ShieldCheck, available: true },
  { key: "seo",             label: "SEO",             icon: SearchIcon,  available: true },
  { key: "mail",            label: "Mail templates",  icon: Mail,        available: true },
  { key: "appearance",      label: "Appearance",      icon: Palette,     available: true },
  { key: "payment-gateway", label: "Payment gateway", icon: CreditCard,  available: true },
];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<TabKey>("site");

  return (
    <PageShell
      title="Settings"
      subtitle="Site configuration, admin access, and platform-wide options."
    >
      {/* Tab bar */}
      <motion.div
        variants={fadeUp}
        style={{
          display: "flex", gap: 2, flexWrap: "wrap",
          background: "rgba(255,255,255,0.6)", padding: 4, borderRadius: 12,
          border: "1px solid rgba(220,30,60,0.08)", backdropFilter: "blur(6px)",
          marginBottom: 18,
        }}
      >
        {TABS.map(({ key, label, icon: Icon, available }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              onClick={() => available && setTab(key)}
              disabled={!available}
              title={available ? undefined : "Coming soon"}
              style={{
                position: "relative",
                padding: "8px 14px",
                borderRadius: 9, border: "none",
                background: "transparent",
                fontSize: 12.5, fontWeight: active ? 600 : 500,
                color: !available ? "#bbb" : active ? "#fff" : "#666",
                cursor: available ? "pointer" : "not-allowed",
                display: "inline-flex", alignItems: "center", gap: 6,
                fontFamily: "inherit",
                zIndex: 1,
              }}
            >
              {active && (
                <motion.span
                  layoutId="settings-tab-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 28 }}
                  style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                    borderRadius: 9,
                    boxShadow: "0 4px 12px rgba(220,30,60,0.3)",
                    zIndex: -1,
                  }}
                />
              )}
              <Icon style={{ width: 13, height: 13 }} />
              {label}
              {!available && (
                <span style={{
                  fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                  padding: "1px 6px", borderRadius: 999,
                  background: "rgba(0,0,0,0.05)", color: "#aaa",
                }}>Soon</span>
              )}
            </button>
          );
        })}
      </motion.div>

      {/* Tab content */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "site"   && <SiteTab />}
          {tab === "admins" && <AdminsTab />}
          {tab === "seo"             && <SeoTab />}
          {tab === "mail"            && <MailTab />}
          {tab === "appearance"      && <AppearanceTab />}
          {tab === "payment-gateway" && <PaymentGatewayTab />}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Site tab ────────────────────────────────────────────────────────────────

interface SiteSettings {
  site_name: string;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  timezone: string;
  default_currency: string;
  default_locale: string;
  extras: Record<string, unknown>;
  updated_at: string | null;
}

const TIMEZONES = [
  "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles",
  "Australia/Sydney", "UTC",
];
const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "SGD", "AUD", "CAD"];
const LOCALES = ["en", "hi", "ta", "ml", "te", "bn", "kn", "mr"];

function SiteTab() {
  const { toast } = useToast();
  const [data, setData] = useState<SiteSettings | null>(null);
  const [draft, setDraft] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getSiteSettings();
        const payload = (res.data as any)?.data as SiteSettings | undefined;
        if (payload) {
          setData(payload);
          setDraft(payload);
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = data && draft && (
    data.site_name        !== draft.site_name        ||
    (data.tagline ?? "")  !== (draft.tagline ?? "")  ||
    (data.support_email ?? "") !== (draft.support_email ?? "") ||
    (data.support_phone ?? "") !== (draft.support_phone ?? "") ||
    data.timezone         !== draft.timezone         ||
    data.default_currency !== draft.default_currency ||
    data.default_locale   !== draft.default_locale
  );

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await adminApi.updateSiteSettings({
        site_name: draft.site_name,
        tagline: draft.tagline,
        support_email: draft.support_email,
        support_phone: draft.support_phone,
        timezone: draft.timezone,
        default_currency: draft.default_currency,
        default_locale: draft.default_locale,
      });
      const updated = (res.data as any)?.data as SiteSettings;
      setData(updated);
      setDraft(updated);
      toast("success", "Site settings saved");
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (e?.message || "Save failed");
      setError(msg);
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="m4m-shimmer" style={{ height: 100, borderRadius: 16 }} />
        <div className="m4m-shimmer" style={{ height: 220, borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div style={{
          padding: 14, background: "rgba(220,30,60,0.06)", color: "#a0153c",
          borderRadius: 12, fontSize: 13, border: "1px solid rgba(220,30,60,0.12)",
        }}>
          <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} />
          {error}
        </div>
      )}

      <GlassCard>
        <SectionTitle icon={Globe} title="Brand" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Site name">
            <input
              value={draft.site_name}
              onChange={(e) => setDraft({ ...draft, site_name: e.target.value })}
              placeholder="e.g. Match4Marriage"
              style={inputStyle}
            />
          </Field>
          <Field label="Tagline">
            <input
              value={draft.tagline || ""}
              onChange={(e) => setDraft({ ...draft, tagline: e.target.value })}
              placeholder="e.g. Premium matrimony, made personal"
              style={inputStyle}
            />
          </Field>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle icon={Mail} title="Support contact" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Support email">
            <input
              type="email"
              value={draft.support_email || ""}
              onChange={(e) => setDraft({ ...draft, support_email: e.target.value })}
              placeholder="support@match4marriage.com"
              style={inputStyle}
            />
          </Field>
          <Field label="Support phone">
            <input
              value={draft.support_phone || ""}
              onChange={(e) => setDraft({ ...draft, support_phone: e.target.value })}
              placeholder="+91 ..."
              style={inputStyle}
            />
          </Field>
        </div>
      </GlassCard>

      <GlassCard>
        <SectionTitle icon={Globe} title="Locale & defaults" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field label="Timezone">
            <select
              value={draft.timezone}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              style={inputStyle}
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Default currency">
            <select
              value={draft.default_currency}
              onChange={(e) => setDraft({ ...draft, default_currency: e.target.value })}
              style={inputStyle}
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Default locale">
            <select
              value={draft.default_locale}
              onChange={(e) => setDraft({ ...draft, default_locale: e.target.value })}
              style={inputStyle}
            >
              {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
        </div>
      </GlassCard>

      {/* Sticky save bar */}
      <div style={{
        display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10,
        padding: "10px 0",
      }}>
        <span style={{ fontSize: 11, color: "#888" }}>
          {data?.updated_at ? `Last saved ${new Date(data.updated_at).toLocaleString()}` : "Not yet saved"}
        </span>
        <Button onClick={save} disabled={!isDirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: any; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 9,
        background: "rgba(220,30,60,0.08)",
        display: "grid", placeItems: "center",
      }}>
        <Icon style={{ width: 14, height: 14, color: "#dc1e3c" }} />
      </div>
      <h3 style={{
        fontSize: 12, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.08em", color: "#555", margin: 0,
      }}>{title}</h3>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: "#555",
        textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
      }}>{label}</div>
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "9px 12px", border: "1px solid rgba(220,30,60,0.18)", borderRadius: 8,
  fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
  color: "#1a0a14",
};

// ─── Coming soon stub ────────────────────────────────────────────────────────

function ComingSoon({ label }: { label: string }) {
  return (
    <GlassCard>
      <div style={{ padding: "40px 20px", textAlign: "center", color: "#999" }}>
        <Lock style={{ width: 32, height: 32, color: "#e5e5e5", margin: "0 auto 10px", display: "block" }} />
        <p style={{ fontSize: 13.5, color: "#888", margin: "0 0 4px", fontWeight: 600 }}>{label}</p>
        <p style={{ fontSize: 12, color: "#bbb", margin: 0 }}>Coming in a follow-up release.</p>
      </div>
    </GlassCard>
  );
}

// ─── Admins tab (lifted from previous standalone page) ───────────────────────

interface Me {
  user_id: string | null;
  email: string | null;
  roles: string[];
  is_admin: boolean;
  is_super_admin: boolean;
}

interface AdminUser {
  uid: string;
  email: string | null;
  display_name: string | null;
  disabled: boolean;
  email_verified: boolean;
  last_sign_in: number | null;
  created: number | null;
  roles: string[];
}

function AdminsTab() {
  const { toast } = useToast();

  const [me, setMe] = useState<Me | null>(null);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setError(null);
    try {
      const [meRes, adminsRes] = await Promise.all([
        adminApi.me(),
        adminApi.listAdmins(),
      ]);
      setMe((meRes.data as any)?.data);
      setAdmins(((adminsRes.data as any)?.data || []) as AdminUser[]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;
    if (create && newPassword.length < 8) {
      toast("warning", "Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      await adminApi.grantAdmin(newEmail.trim().toLowerCase(), create ? { create: true, password: newPassword } : {});
      toast("success", `Admin granted to ${newEmail}`);
      setNewEmail("");
      setNewPassword("");
      setCreate(false);
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to grant admin");
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (uid: string, email: string | null) => {
    if (!confirm(`Revoke admin from ${email || uid}? Active sessions will be terminated.`)) return;
    setBusy(true);
    try {
      await adminApi.revokeAdmin(uid);
      toast("success", `Revoked admin from ${email || uid}`);
      await load();
    } catch (e) {
      toast("error", e instanceof Error ? e.message : "Failed to revoke admin");
    } finally {
      setBusy(false);
    }
  };

  const canManage = !!me?.is_super_admin;

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="m4m-shimmer" style={{ height: 80, borderRadius: 16 }} />
        <div className="m4m-shimmer" style={{ height: 220, borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && (
        <div style={{
          padding: 14, background: "rgba(220,30,60,0.06)", color: "#a0153c",
          borderRadius: 12, fontSize: 13, border: "1px solid rgba(220,30,60,0.12)",
        }}>
          <AlertTriangle style={{ width: 14, height: 14, display: "inline", verticalAlign: "text-bottom", marginRight: 6 }} /> {error}
        </div>
      )}

      <GlassCard>
        <SectionTitle icon={ShieldCheck} title="Signed in as" />
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 14, color: "#1a0a14", fontWeight: 500 }}>{me?.email || "—"}</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(me?.roles || []).map((r) => (
              <span key={r} style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
                padding: "3px 8px", borderRadius: 999,
                background: r === "super_admin" ? "rgba(220,30,60,0.10)" : "rgba(30,75,200,0.06)",
                color: r === "super_admin" ? "#a0153c" : "#1e4bc8",
              }}>
                {r.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <SectionTitle icon={ShieldCheck} title="Admin accounts" />
          {!canManage && (
            <span style={{ fontSize: 11, color: "#888", display: "inline-flex", alignItems: "center", gap: 4 }}>
              <Lock style={{ width: 11, height: 11 }} /> super-admin only
            </span>
          )}
        </div>
        {admins.length === 0 ? (
          <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>No admins found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {admins.map((a) => (
              <div key={a.uid} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 0", borderBottom: "1px solid rgba(0,0,0,0.04)",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#1a0a14" }}>
                    {a.email || a.uid}
                    {a.roles.includes("super_admin") && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: "#a0153c", background: "rgba(220,30,60,0.08)", padding: "2px 7px", borderRadius: 999 }}>
                        Super
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {a.last_sign_in ? `Last sign-in ${new Date(a.last_sign_in).toLocaleString()}` : "Never signed in"}
                  </div>
                </div>
                {canManage && !a.roles.includes("super_admin") && (
                  <Button onClick={() => handleRevoke(a.uid, a.email)} disabled={busy} variant="danger">
                    <Trash2 style={{ width: 12, height: 12 }} /> Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {canManage && (
          <form onSubmit={handleGrant} style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#666", marginBottom: 10 }}>
              Grant admin
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              <input
                type="email"
                required
                placeholder="new-admin@match4marriage.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                style={smallInputStyle}
              />
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#555" }}>
                <input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} />
                Create if missing
              </label>
              {create && (
                <input
                  type="password"
                  required
                  placeholder="Initial password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={smallInputStyle}
                />
              )}
              <button
                type="submit"
                disabled={busy}
                style={{
                  padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  cursor: busy ? "not-allowed" : "pointer", opacity: busy ? 0.5 : 1,
                  background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff",
                  border: "1px solid transparent", display: "inline-flex", alignItems: "center", gap: 6,
                  boxShadow: "0 2px 10px rgba(220,30,60,0.2)",
                }}
              >
                <Plus style={{ width: 13, height: 13 }} /> Grant
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#888", marginTop: 8, marginBottom: 0 }}>
              The user will be able to sign in at /admin/login. Revoking terminates their active sessions immediately.
            </p>
          </form>
        )}
      </GlassCard>
    </div>
  );
}

const smallInputStyle: React.CSSProperties = {
  padding: "8px 12px", border: "1px solid rgba(220,30,60,0.15)", borderRadius: 8,
  fontSize: 13, fontFamily: "inherit", outline: "none", background: "#fff",
  minWidth: 220,
};

// ─── Mail templates tab ──────────────────────────────────────────────────────

interface MailTemplateRow {
  id: string;
  key: string;
  name: string;
  subject: string;
  body_html: string;
  body_text: string | null;
  is_active: boolean;
  updated_at: string | null;
}

interface MailBuiltin { key: string; name: string }

function MailTab() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<MailTemplateRow[]>([]);
  const [builtins, setBuiltins] = useState<MailBuiltin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ key: string; name: string; subject: string; body_html: string; body_text: string; is_active: boolean } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.listMailTemplates();
      const payload = (res.data as any)?.data;
      const list: MailTemplateRow[] = Array.isArray(payload?.templates) ? payload.templates : [];
      const builtIns: MailBuiltin[] = Array.isArray(payload?.builtins) ? payload.builtins : [];
      setTemplates(list);
      setBuiltins(builtIns);
      // Auto-select first row, or first built-in if no rows yet.
      if (!selectedKey) {
        const first = list[0]?.key || builtIns[0]?.key;
        if (first) selectKey(first, list, builtIns);
      } else {
        selectKey(selectedKey, list, builtIns);
      }
    } catch (e: any) {
      toast("error", e?.message || "Could not load templates");
    } finally {
      setLoading(false);
    }
  };
  // selectedKey not in deps — internal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const selectKey = (key: string, list = templates, builtIns = builtins) => {
    setSelectedKey(key);
    const existing = list.find((t) => t.key === key);
    const builtin = builtIns.find((b) => b.key === key);
    setDraft({
      key,
      name: existing?.name || builtin?.name || key,
      subject: existing?.subject || "",
      body_html: existing?.body_html || "",
      body_text: existing?.body_text || "",
      is_active: existing ? existing.is_active : true,
    });
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const body = {
        name: draft.name,
        subject: draft.subject,
        body_html: draft.body_html,
        body_text: draft.body_text || null,
        is_active: draft.is_active,
      };
      await adminApi.upsertMailTemplate(draft.key, body);
      toast("success", `Template '${draft.key}' saved`);
      await load();
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (e?.message || "Save failed");
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || saving) return;
    if (!confirm(`Delete template '${draft.key}'? You can recreate it later from the catalogue.`)) return;
    setSaving(true);
    try {
      await adminApi.deleteMailTemplate(draft.key);
      toast("success", `Template '${draft.key}' deleted`);
      setSelectedKey(null);
      setDraft(null);
      await load();
    } catch (e: any) {
      toast("error", e?.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="m4m-shimmer" style={{ height: 60, borderRadius: 12 }} />
        <div className="m4m-shimmer" style={{ height: 320, borderRadius: 16 }} />
      </div>
    );
  }

  // Build a unified catalogue list: each builtin key, marked configured/not.
  const allKeys = new Map<string, { name: string; configured: boolean; row?: MailTemplateRow }>();
  for (const b of builtins) allKeys.set(b.key, { name: b.name, configured: false });
  for (const t of templates) allKeys.set(t.key, { name: t.name, configured: true, row: t });

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)", gap: 14, alignItems: "start",
    }} className="cms-grid">
      <GlassCard padding={0}>
        <div style={{ padding: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#777", marginBottom: 8, paddingLeft: 4,
          }}>Catalogue</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {Array.from(allKeys.entries()).map(([key, meta]) => {
              const active = selectedKey === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => selectKey(key)}
                  style={{
                    position: "relative",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 10, border: "none",
                    background: active ? "rgba(220,30,60,0.06)" : "transparent",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,30,60,0.03)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {active && (
                    <motion.span
                      layoutId="mail-row-marker"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      style={{
                        position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
                        background: "linear-gradient(180deg, #dc1e3c, #a0153c)",
                        borderRadius: 2,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a0a14", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {meta.name}
                    </div>
                    <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>{key}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    background: meta.configured ? "rgba(92,122,82,0.12)" : "rgba(0,0,0,0.05)",
                    color: meta.configured ? "#3F5937" : "#aaa",
                    flexShrink: 0,
                  }}>
                    {meta.configured ? "Set" : "Empty"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        {!draft ? (
          <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>Pick a template from the catalogue.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div>
                <h3 style={{
                  fontFamily: "var(--font-playfair, serif)",
                  fontSize: 18, fontWeight: 700, color: "#1a0a14",
                  margin: "0 0 2px",
                }}>{draft.name}</h3>
                <div style={{ fontSize: 11, color: "#888", fontFamily: "monospace" }}>{draft.key}</div>
              </div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#555" }}>
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  style={{ accentColor: "#dc1e3c" }}
                />
                {draft.is_active ? "Active" : "Inactive"}
              </label>
            </div>

            <Field label="Subject">
              <input
                value={draft.subject}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Welcome to {{ site_name }}"
                style={inputStyle}
              />
            </Field>

            <Field label="HTML body">
              <textarea
                value={draft.body_html}
                onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
                placeholder="<p>Hi {{ first_name }}, …</p>"
                rows={8}
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.5, resize: "vertical" }}
              />
            </Field>

            <Field label="Plain text fallback (optional)">
              <textarea
                value={draft.body_text}
                onChange={(e) => setDraft({ ...draft, body_text: e.target.value })}
                placeholder="Hi {{ first_name }}, …"
                rows={4}
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5, lineHeight: 1.5, resize: "vertical" }}
              />
            </Field>

            {draft.body_html && (
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, color: "#555",
                  textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4,
                }}>Preview</div>
                <div
                  style={{
                    padding: 14, borderRadius: 10,
                    background: "#fdfbf9", border: "1px solid rgba(220,30,60,0.08)",
                    fontSize: 13.5, lineHeight: 1.6, color: "#444",
                    maxHeight: 240, overflow: "auto",
                  }}
                  // Preview rendering of admin-controlled content. This is admin-only,
                  // and the admin authors the HTML themselves — same trust model as
                  // any CMS template editor.
                  dangerouslySetInnerHTML={{ __html: draft.body_html }}
                />
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={remove}
                disabled={saving}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(220,30,60,0.2)",
                  background: "rgba(220,30,60,0.06)", color: "#a0153c",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Delete
              </button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save template"}
              </Button>
            </div>
          </div>
        )}
      </GlassCard>

      <style jsx>{`
        @media (max-width: 900px) {
          :global(.cms-grid) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

// ─── SEO tab ────────────────────────────────────────────────────────────────

interface SeoRow {
  id: string;
  path: string;
  title: string;
  description: string | null;
  og_image_url: string | null;
  robots: string;
  updated_at: string | null;
}
interface SeoBuiltin { path: string; label: string }

const ROBOTS_OPTIONS = ["index, follow", "index, nofollow", "noindex, follow", "noindex, nofollow"];

function SeoTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SeoRow[]>([]);
  const [builtins, setBuiltins] = useState<SeoBuiltin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ path: string; title: string; description: string; og_image_url: string; robots: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [newPath, setNewPath] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.listSeoSettings();
      const payload = (res.data as any)?.data;
      const list: SeoRow[] = Array.isArray(payload?.settings) ? payload.settings : [];
      const builtIns: SeoBuiltin[] = Array.isArray(payload?.builtins) ? payload.builtins : [];
      setSettings(list);
      setBuiltins(builtIns);
      if (!selectedPath) {
        const first = list[0]?.path || builtIns[0]?.path;
        if (first) selectPath(first, list);
      } else {
        selectPath(selectedPath, list);
      }
    } catch (e: any) {
      toast("error", e?.message || "Could not load SEO settings");
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const selectPath = (path: string, list = settings) => {
    setSelectedPath(path);
    const existing = list.find((s) => s.path === path);
    setDraft({
      path,
      title: existing?.title || "",
      description: existing?.description || "",
      og_image_url: existing?.og_image_url || "",
      robots: existing?.robots || "index, follow",
    });
  };

  const addCustomPath = () => {
    const p = newPath.trim();
    if (!p.startsWith("/")) {
      toast("warning", "Path must start with '/'");
      return;
    }
    selectPath(p);
    setNewPath("");
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await adminApi.upsertSeoSetting({
        path: draft.path,
        title: draft.title,
        description: draft.description || null,
        og_image_url: draft.og_image_url || null,
        robots: draft.robots,
      });
      toast("success", `SEO for ${draft.path} saved`);
      await load();
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      const msg = typeof detail === "string" ? detail : (e?.message || "Save failed");
      toast("error", msg);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || saving) return;
    if (!confirm(`Remove SEO settings for ${draft.path}?`)) return;
    setSaving(true);
    try {
      await adminApi.deleteSeoSetting(draft.path);
      toast("success", `Removed SEO for ${draft.path}`);
      setSelectedPath(null);
      setDraft(null);
      await load();
    } catch (e: any) {
      toast("error", e?.message || "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="m4m-shimmer" style={{ height: 60, borderRadius: 12 }} />
        <div className="m4m-shimmer" style={{ height: 280, borderRadius: 16 }} />
      </div>
    );
  }

  // Merge: builtins + any custom-set rows.
  const allPaths = new Map<string, { label: string; configured: boolean }>();
  for (const b of builtins) allPaths.set(b.path, { label: b.label, configured: false });
  for (const s of settings) allPaths.set(s.path, { label: allPaths.get(s.path)?.label || s.path, configured: true });

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "minmax(240px, 280px) minmax(0, 1fr)", gap: 14, alignItems: "start",
    }} className="cms-grid">
      <GlassCard padding={0}>
        <div style={{ padding: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: "uppercase",
            letterSpacing: "0.08em", color: "#777", marginBottom: 8, paddingLeft: 4,
          }}>Pages</div>
          <div style={{ display: "flex", flexDirection: "column", marginBottom: 10 }}>
            {Array.from(allPaths.entries()).map(([path, meta]) => {
              const active = selectedPath === path;
              return (
                <button
                  key={path}
                  type="button"
                  onClick={() => selectPath(path)}
                  style={{
                    position: "relative",
                    display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
                    padding: "10px 12px", borderRadius: 10, border: "none",
                    background: active ? "rgba(220,30,60,0.06)" : "transparent",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "rgba(220,30,60,0.03)"; }}
                  onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                >
                  {active && (
                    <motion.span
                      layoutId="seo-row-marker"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                      style={{
                        position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
                        background: "linear-gradient(180deg, #dc1e3c, #a0153c)",
                        borderRadius: 2,
                      }}
                    />
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1a0a14" }}>{meta.label}</div>
                    <div style={{ fontSize: 11, color: "#aaa", fontFamily: "monospace" }}>{path}</div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
                    background: meta.configured ? "rgba(92,122,82,0.12)" : "rgba(0,0,0,0.05)",
                    color: meta.configured ? "#3F5937" : "#aaa",
                    flexShrink: 0,
                  }}>
                    {meta.configured ? "Set" : "Empty"}
                  </span>
                </button>
              );
            })}
          </div>

          <div style={{
            paddingTop: 10, borderTop: "1px solid rgba(0,0,0,0.06)",
            display: "flex", gap: 6,
          }}>
            <input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomPath())}
              placeholder="/custom/path"
              style={{ ...smallInputStyle, minWidth: 0, flex: 1, fontFamily: "monospace" }}
            />
            <button
              type="button"
              onClick={addCustomPath}
              style={{
                padding: "8px 12px", borderRadius: 8, border: "none",
                background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff",
                fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              }}
            >Add</button>
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        {!draft ? (
          <p style={{ fontSize: 13, color: "#aaa", margin: 0 }}>Pick a page or add a custom path.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <h3 style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: 18, fontWeight: 700, color: "#1a0a14",
                margin: "0 0 2px",
              }}>SEO for <span style={{ fontFamily: "monospace", fontSize: 14, color: "#a0153c" }}>{draft.path}</span></h3>
              <p style={{ fontSize: 12, color: "#888", margin: 0 }}>
                Used in &lt;head&gt; on the public page.
              </p>
            </div>

            <Field label="Title">
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="e.g. Match4Marriage — Premium Matrimony"
                style={inputStyle}
              />
            </Field>

            <Field label="Meta description">
              <textarea
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                placeholder="Up to ~160 characters of descriptive text for search results."
                rows={3}
                style={{ ...inputStyle, lineHeight: 1.5, resize: "vertical" }}
              />
              <div style={{ fontSize: 11, color: draft.description.length > 160 ? "#a0153c" : "#aaa", marginTop: 4 }}>
                {draft.description.length} / 160 characters
              </div>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
              <Field label="Open Graph image URL">
                <input
                  value={draft.og_image_url}
                  onChange={(e) => setDraft({ ...draft, og_image_url: e.target.value })}
                  placeholder="https://…"
                  style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5 }}
                />
              </Field>
              <Field label="Robots">
                <select
                  value={draft.robots}
                  onChange={(e) => setDraft({ ...draft, robots: e.target.value })}
                  style={inputStyle}
                >
                  {ROBOTS_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                onClick={remove}
                disabled={saving}
                style={{
                  padding: "8px 14px", borderRadius: 8, border: "1px solid rgba(220,30,60,0.2)",
                  background: "rgba(220,30,60,0.06)", color: "#a0153c",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Remove
              </button>
              <Button onClick={save} disabled={saving}>
                {saving ? "Saving…" : "Save SEO settings"}
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
    </div>
  );
}

// ─── Appearance tab ──────────────────────────────────────────────────────────

interface AppearanceData {
  logo_url: string | null;
  favicon_url: string | null;
  brand_primary: string | null;
  brand_accent: string | null;
  updated_at: string | null;
}

const HEX_RE = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function AppearanceTab() {
  const { toast } = useToast();
  const [data, setData] = useState<AppearanceData | null>(null);
  const [draft, setDraft] = useState<AppearanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await adminApi.getAppearance();
        const payload = (res.data as any)?.data as AppearanceData;
        if (payload) {
          setData(payload);
          setDraft(payload);
        }
      } catch (e: any) {
        toast("error", e?.message || "Could not load appearance");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = data && draft && (
    (data.logo_url ?? "")      !== (draft.logo_url ?? "")     ||
    (data.favicon_url ?? "")   !== (draft.favicon_url ?? "")  ||
    (data.brand_primary ?? "") !== (draft.brand_primary ?? "") ||
    (data.brand_accent ?? "")  !== (draft.brand_accent ?? "")
  );

  const save = async () => {
    if (!draft || saving) return;
    if (draft.brand_primary && !HEX_RE.test(draft.brand_primary)) {
      toast("warning", "Primary color must be #RRGGBB or #RRGGBBAA");
      return;
    }
    if (draft.brand_accent && !HEX_RE.test(draft.brand_accent)) {
      toast("warning", "Accent color must be #RRGGBB or #RRGGBBAA");
      return;
    }
    setSaving(true);
    try {
      const res = await adminApi.updateAppearance({
        logo_url: draft.logo_url || null,
        favicon_url: draft.favicon_url || null,
        brand_primary: draft.brand_primary || null,
        brand_accent: draft.brand_accent || null,
      });
      const updated = (res.data as any)?.data as AppearanceData;
      setData(updated);
      setDraft(updated);
      toast("success", "Appearance saved");
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      toast("error", typeof detail === "string" ? detail : (e?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading || !draft) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="m4m-shimmer" style={{ height: 220, borderRadius: 16 }} />
      </div>
    );
  }

  const previewPrimary = draft.brand_primary && HEX_RE.test(draft.brand_primary) ? draft.brand_primary : "#dc1e3c";
  const previewAccent  = draft.brand_accent  && HEX_RE.test(draft.brand_accent)  ? draft.brand_accent  : "#c9954a";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <GlassCard>
        <SectionTitle icon={Palette} title="Logo & favicon" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Logo URL">
            <input
              value={draft.logo_url || ""}
              onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })}
              placeholder="https://res.cloudinary.com/…"
              style={inputStyle}
            />
          </Field>
          <Field label="Favicon URL">
            <input
              value={draft.favicon_url || ""}
              onChange={(e) => setDraft({ ...draft, favicon_url: e.target.value })}
              placeholder="https://…/favicon.ico"
              style={inputStyle}
            />
          </Field>
        </div>
        {draft.logo_url && (
          <div style={{
            marginTop: 12, padding: 14, borderRadius: 10,
            background: "#fdfbf9", border: "1px solid rgba(220,30,60,0.08)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.logo_url}
              alt="Logo preview"
              style={{ height: 40, maxWidth: 200, objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span style={{ fontSize: 11, color: "#888" }}>Live preview</span>
          </div>
        )}
      </GlassCard>

      <GlassCard>
        <SectionTitle icon={Palette} title="Brand colors" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Primary (#RRGGBB or #RRGGBBAA)">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="color"
                value={draft.brand_primary && HEX_RE.test(draft.brand_primary) ? draft.brand_primary.slice(0, 7) : "#dc1e3c"}
                onChange={(e) => setDraft({ ...draft, brand_primary: e.target.value })}
                style={{ width: 44, height: 38, padding: 2, border: "1px solid rgba(220,30,60,0.18)", borderRadius: 8, background: "#fff" }}
              />
              <input
                value={draft.brand_primary || ""}
                onChange={(e) => setDraft({ ...draft, brand_primary: e.target.value })}
                placeholder="#dc1e3c"
                style={{ ...inputStyle, fontFamily: "monospace" }}
              />
            </div>
          </Field>
          <Field label="Accent">
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="color"
                value={draft.brand_accent && HEX_RE.test(draft.brand_accent) ? draft.brand_accent.slice(0, 7) : "#c9954a"}
                onChange={(e) => setDraft({ ...draft, brand_accent: e.target.value })}
                style={{ width: 44, height: 38, padding: 2, border: "1px solid rgba(220,30,60,0.18)", borderRadius: 8, background: "#fff" }}
              />
              <input
                value={draft.brand_accent || ""}
                onChange={(e) => setDraft({ ...draft, brand_accent: e.target.value })}
                placeholder="#c9954a"
                style={{ ...inputStyle, fontFamily: "monospace" }}
              />
            </div>
          </Field>
        </div>

        {/* Live preview tile */}
        <div style={{
          marginTop: 14, padding: 16, borderRadius: 12,
          background: `linear-gradient(135deg, ${previewPrimary}10, ${previewAccent}10)`,
          border: `1px solid ${previewPrimary}30`,
        }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 12, marginBottom: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${previewPrimary}, ${previewAccent})`,
              boxShadow: `0 6px 16px ${previewPrimary}55`,
            }} />
            <div>
              <div style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 16, fontWeight: 700, color: "#1a0a14" }}>
                Brand preview
              </div>
              <div style={{ fontSize: 11, color: "#888" }}>
                Primary {previewPrimary} · Accent {previewAccent}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="button" disabled style={{
              padding: "8px 14px", borderRadius: 8, border: "none",
              background: previewPrimary, color: "#fff",
              fontSize: 12, fontWeight: 600, cursor: "default",
              boxShadow: `0 4px 12px ${previewPrimary}55`,
            }}>Primary action</button>
            <button type="button" disabled style={{
              padding: "8px 14px", borderRadius: 8,
              border: `1px solid ${previewAccent}`,
              background: "transparent", color: previewAccent,
              fontSize: 12, fontWeight: 600, cursor: "default",
            }}>Accent button</button>
          </div>
        </div>
      </GlassCard>

      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, padding: "10px 0" }}>
        <span style={{ fontSize: 11, color: "#888" }}>
          {data?.updated_at ? `Last saved ${new Date(data.updated_at).toLocaleString()}` : "Not yet saved"}
        </span>
        <Button onClick={save} disabled={!isDirty || saving}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

// ─── Payment gateway tab ─────────────────────────────────────────────────────

interface GatewayConfig {
  id: string;
  gateway: "razorpay" | "stripe" | "upi";
  publishable_key: string | null;
  secret_configured: boolean;
  secret_tail: string | null;
  webhook_configured: boolean;
  webhook_tail: string | null;
  is_test_mode: boolean;
  is_active: boolean;
  updated_at: string | null;
}

const GATEWAY_OPTIONS: Array<{ key: "razorpay" | "stripe" | "upi"; label: string; description: string }> = [
  { key: "razorpay", label: "Razorpay", description: "Indian cards, UPI, netbanking, wallets" },
  { key: "stripe",   label: "Stripe",   description: "International cards, wallets" },
  { key: "upi",      label: "UPI",      description: "Direct UPI VPA / collect-request flow" },
];

function PaymentGatewayTab() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<"razorpay" | "stripe" | "upi">("razorpay");
  const [draft, setDraft] = useState<{
    publishable_key: string;
    secret_key: string;
    webhook_secret: string;
    is_test_mode: boolean;
    is_active: boolean;
  }>({ publishable_key: "", secret_key: "", webhook_secret: "", is_test_mode: true, is_active: false });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.listPaymentGateways();
      const list = ((res.data as any)?.data || []) as GatewayConfig[];
      setConfigs(list);
      hydrateDraft(selected, list);
    } catch (e: any) {
      toast("error", e?.message || "Could not load gateways");
    } finally {
      setLoading(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  const hydrateDraft = (key: "razorpay" | "stripe" | "upi", list: GatewayConfig[] = configs) => {
    const existing = list.find((c) => c.gateway === key);
    setDraft({
      publishable_key: existing?.publishable_key || "",
      // Secret fields start empty — never echo back what's stored.
      secret_key: "",
      webhook_secret: "",
      is_test_mode: existing ? existing.is_test_mode : true,
      is_active: existing ? existing.is_active : false,
    });
  };

  const switchTo = (key: "razorpay" | "stripe" | "upi") => {
    setSelected(key);
    hydrateDraft(key);
  };

  const existing = configs.find((c) => c.gateway === selected);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Only send secret fields when the admin actually typed something — empty
      // string means "leave it alone", explicit null means "clear it". The UI
      // exposes a separate "Clear" action for the latter (see button below).
      const body: any = {
        publishable_key: draft.publishable_key || null,
        is_test_mode: draft.is_test_mode,
        is_active: draft.is_active,
      };
      if (draft.secret_key.length > 0) body.secret_key = draft.secret_key;
      if (draft.webhook_secret.length > 0) body.webhook_secret = draft.webhook_secret;
      await adminApi.upsertPaymentGateway(selected, body);
      toast("success", `${selected} gateway saved`);
      await load();
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      toast("error", typeof detail === "string" ? detail : (e?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const clearSecret = async (which: "secret_key" | "webhook_secret") => {
    if (!confirm(`Clear the stored ${which.replace("_", " ")}? You'll need to re-enter it before this gateway works.`)) return;
    setSaving(true);
    try {
      await adminApi.upsertPaymentGateway(selected, { [which]: null } as any);
      toast("success", `${which.replace("_", " ")} cleared`);
      await load();
    } catch (e: any) {
      toast("error", e?.message || "Clear failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="m4m-shimmer" style={{ height: 60, borderRadius: 12 }} />
        <div className="m4m-shimmer" style={{ height: 280, borderRadius: 16 }} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Gateway picker */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10,
      }}>
        {GATEWAY_OPTIONS.map(({ key, label, description }) => {
          const active = selected === key;
          const cfg = configs.find((c) => c.gateway === key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => switchTo(key)}
              style={{
                position: "relative",
                padding: 14, borderRadius: 12, textAlign: "left",
                border: `1px solid ${active ? "rgba(220,30,60,0.4)" : "rgba(220,30,60,0.10)"}`,
                background: active
                  ? "linear-gradient(135deg, rgba(220,30,60,0.06), rgba(160,21,60,0.04))"
                  : "#fff",
                cursor: "pointer", fontFamily: "inherit",
                boxShadow: active ? "0 4px 14px rgba(220,30,60,0.12)" : "0 2px 8px rgba(0,0,0,0.03)",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#1a0a14" }}>{label}</div>
                  <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{description}</div>
                </div>
                {cfg && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em",
                    padding: "2px 7px", borderRadius: 999,
                    background: cfg.is_active ? "rgba(92,122,82,0.12)" : "rgba(0,0,0,0.06)",
                    color: cfg.is_active ? "#3F5937" : "#888",
                  }}>
                    {cfg.is_active ? "Active" : cfg.is_test_mode ? "Test" : "Live (off)"}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <GlassCard>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Publishable / public key">
            <input
              value={draft.publishable_key}
              onChange={(e) => setDraft({ ...draft, publishable_key: e.target.value })}
              placeholder={selected === "razorpay" ? "rzp_test_…" : selected === "stripe" ? "pk_test_…" : "vpa@bank"}
              style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5 }}
            />
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Secret key">
              <input
                type="password"
                value={draft.secret_key}
                onChange={(e) => setDraft({ ...draft, secret_key: e.target.value })}
                placeholder={existing?.secret_configured ? `Currently set (${existing.secret_tail}). Type to replace.` : "Enter to set"}
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5 }}
                autoComplete="off"
              />
              {existing?.secret_configured && (
                <button
                  type="button"
                  onClick={() => clearSecret("secret_key")}
                  style={{
                    marginTop: 6,
                    background: "transparent", border: "none", padding: 0,
                    fontSize: 11, color: "#a0153c", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Clear stored secret
                </button>
              )}
            </Field>
            <Field label="Webhook secret">
              <input
                type="password"
                value={draft.webhook_secret}
                onChange={(e) => setDraft({ ...draft, webhook_secret: e.target.value })}
                placeholder={existing?.webhook_configured ? `Currently set (${existing.webhook_tail}). Type to replace.` : "Enter to set"}
                style={{ ...inputStyle, fontFamily: "monospace", fontSize: 12.5 }}
                autoComplete="off"
              />
              {existing?.webhook_configured && (
                <button
                  type="button"
                  onClick={() => clearSecret("webhook_secret")}
                  style={{
                    marginTop: 6,
                    background: "transparent", border: "none", padding: 0,
                    fontSize: 11, color: "#a0153c", fontWeight: 600,
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Clear stored webhook secret
                </button>
              )}
            </Field>
          </div>

          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 10,
              background: draft.is_test_mode ? "rgba(200,144,32,0.10)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${draft.is_test_mode ? "rgba(200,144,32,0.30)" : "rgba(0,0,0,0.06)"}`,
              cursor: "pointer", fontSize: 13, color: "#1a0a14",
            }}>
              <input
                type="checkbox"
                checked={draft.is_test_mode}
                onChange={(e) => setDraft({ ...draft, is_test_mode: e.target.checked })}
                style={{ accentColor: "#c89020" }}
              />
              <span style={{ fontWeight: 500 }}>Test mode</span>
            </label>
            <label style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 10,
              background: draft.is_active ? "rgba(92,122,82,0.10)" : "rgba(0,0,0,0.04)",
              border: `1px solid ${draft.is_active ? "rgba(92,122,82,0.30)" : "rgba(0,0,0,0.06)"}`,
              cursor: "pointer", fontSize: 13, color: "#1a0a14",
            }}>
              <input
                type="checkbox"
                checked={draft.is_active}
                onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                style={{ accentColor: "#3F5937" }}
              />
              <span style={{ fontWeight: 500 }}>Active (accept payments)</span>
            </label>
          </div>

          <div style={{
            padding: "10px 12px", borderRadius: 8,
            background: "rgba(220,30,60,0.04)", border: "1px solid rgba(220,30,60,0.10)",
            fontSize: 11.5, color: "#666", lineHeight: 1.55,
          }}>
            <strong style={{ color: "#a0153c" }}>Security:</strong> secret values are write-only.
            We never echo back what&apos;s stored — leaving the field blank keeps the existing value.
            Use <em>Clear</em> to remove a secret intentionally.
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={save} disabled={saving}>
              {saving ? "Saving…" : `Save ${selected}`}
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
