"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle, ShieldCheck, Plus, Trash2, Lock,
  Globe, Search as SearchIcon, Mail, Palette, CreditCard, FileText, KeyRound,
} from "lucide-react";
import { PageShell, Button } from "@/components/admin/PageShell";
import { Segmented, Skeleton, Pill, EmptyState, Panel, formatDateTime, relTime } from "@/components/admin/primitives";
import ConfirmModal from "@/components/admin/ConfirmModal";
import { adminApi, ApiError } from "@/lib/api";
import { useToast } from "@/components/admin/Toast";
import { usePersistentState, oneOf } from "../_lib/view-state";

// ─── Shared form styling ─────────────────────────────────────────────────────

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-[13px] text-foreground outline-none " +
  "placeholder:text-muted2-foreground/70 focus:border-primary/40 focus:ring-2 focus:ring-primary/15 disabled:opacity-60";
const textareaCls =
  "w-full resize-y rounded-lg border border-border bg-card px-3 py-2 text-[13px] leading-relaxed text-foreground outline-none " +
  "placeholder:text-muted2-foreground/70 focus:border-primary/40 focus:ring-2 focus:ring-primary/15";
const monoCls = "font-mono text-[12.5px]";

/** Promise-based confirm dialog so destructive actions never use window.confirm. */
function useConfirm() {
  const [state, setState] = useState<{ title: string; message: string; confirmLabel: string } | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const ask = useCallback((title: string, message: string, confirmLabel = "Confirm") => {
    setState({ title, message, confirmLabel });
    return new Promise<boolean>((resolve) => { resolver.current = resolve; });
  }, []);
  const close = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setState(null);
  };
  const modal = (
    <ConfirmModal
      open={!!state}
      title={state?.title || ""}
      message={state?.message || ""}
      confirmLabel={state?.confirmLabel}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  );
  return { ask, modal };
}

// ─── Tabbed shell ────────────────────────────────────────────────────────────

const TAB_KEYS = ["site", "admins", "seo", "mail", "appearance", "payment-gateway"] as const;
type TabKey = (typeof TAB_KEYS)[number];

const TABS: Array<{ key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { key: "site",            label: "Site",            icon: Globe },
  { key: "admins",          label: "Admins",          icon: ShieldCheck },
  { key: "seo",             label: "SEO",             icon: SearchIcon },
  { key: "mail",            label: "Mail templates",  icon: Mail },
  { key: "appearance",      label: "Appearance",      icon: Palette },
  { key: "payment-gateway", label: "Payment gateway", icon: CreditCard },
];

export default function AdminSettingsPage() {
  const [tab, setTab] = usePersistentState<TabKey>("settings.tab", "site", oneOf(TAB_KEYS));

  // Deep link: /admin/settings?tab=admins wins over the remembered tab.
  useEffect(() => {
    try {
      const t = new URLSearchParams(window.location.search).get("tab");
      if (t && (TAB_KEYS as readonly string[]).includes(t)) setTab(t as TabKey);
    } catch { /* ignore */ }
  }, [setTab]);

  return (
    <PageShell
      title="Settings"
      subtitle="Site configuration, admin access, and platform-wide options."
      toolbar={
        <div className="max-w-full overflow-x-auto">
          <Segmented<TabKey>
            ariaLabel="Settings sections"
            layoutId="settings-tab-pill"
            value={tab}
            onChange={setTab}
            options={TABS.map(({ key, label, icon: Icon }) => ({
              value: key,
              label: <span className="inline-flex items-center gap-1.5"><Icon className="h-3.5 w-3.5" />{label}</span>,
            }))}
          />
        </div>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
        >
          {tab === "site"            && <SiteTab />}
          {tab === "admins"          && <AdminsTab />}
          {tab === "seo"             && <SeoTab />}
          {tab === "mail"            && <MailTab />}
          {tab === "appearance"      && <AppearanceTab />}
          {tab === "payment-gateway" && <PaymentGatewayTab />}
        </motion.div>
      </AnimatePresence>
    </PageShell>
  );
}

// ─── Small building blocks ───────────────────────────────────────────────────

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="flex items-center gap-2 rounded-lg border border-[#F7CCD5] bg-[#FDECEF] px-3 py-2.5 text-[13px] text-[#9F1239]">
      <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden /> {children}
    </div>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-[12px] font-medium text-muted2-foreground">{label}</label>
      {children}
      {hint && <div className="mt-1 text-[11.5px] text-muted2-foreground">{hint}</div>}
    </div>
  );
}

function SaveBar({ updatedAt, dirty, saving, onSave }: { updatedAt: string | null | undefined; dirty: boolean; saving: boolean; onSave: () => void }) {
  return (
    <div className="sticky bottom-3 z-10 flex items-center justify-end gap-3 rounded-xl border border-border/70 bg-card/95 px-4 py-2.5 shadow-[0_4px_16px_rgba(26,10,20,0.06)]">
      <span className="text-[12px] text-muted2-foreground" title={updatedAt ? formatDateTime(updatedAt) : undefined}>
        {dirty ? "Unsaved changes" : updatedAt ? `Saved ${relTime(updatedAt)}` : "Not yet saved"}
      </span>
      <Button variant="primary" size="sm" onClick={onSave} disabled={!dirty} loading={saving}>
        Save changes
      </Button>
    </div>
  );
}

function TabSkeleton({ heights }: { heights: number[] }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true">
      {heights.map((h, i) => (
        <div key={i} style={{ height: h }}><Skeleton className="h-full rounded-xl" /></div>
      ))}
    </div>
  );
}

/** Two-pane catalogue list item (mail templates, SEO pages). */
function CatalogueItem({ active, title, sub, configured, onClick }: {
  active: boolean; title: string; sub: string; configured: boolean; onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={active || undefined}
        className={`relative flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
          active ? "bg-primary/[0.06]" : "hover:bg-secondary/50"
        }`}
      >
        {active && <span aria-hidden className="absolute bottom-2 left-0 top-2 w-[2px] rounded-full bg-primary" />}
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
          <div className="truncate font-mono text-[11px] text-muted2-foreground">{sub}</div>
        </div>
        <Pill tone={configured ? "good" : "neutral"}>{configured ? "Set" : "Empty"}</Pill>
      </button>
    </li>
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
  "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Dubai", "Asia/Singapore",
  "America/New_York", "America/Los_Angeles", "Australia/Sydney", "UTC",
];
const CURRENCIES = ["GBP", "USD", "EUR", "INR", "AED", "SGD", "AUD", "CAD"];
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

  const isDirty = !!(data && draft && (
    data.site_name        !== draft.site_name        ||
    (data.tagline ?? "")  !== (draft.tagline ?? "")  ||
    (data.support_email ?? "") !== (draft.support_email ?? "") ||
    (data.support_phone ?? "") !== (draft.support_phone ?? "") ||
    data.timezone         !== draft.timezone         ||
    data.default_currency !== draft.default_currency ||
    data.default_locale   !== draft.default_locale
  ));

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

  if (loading) return <TabSkeleton heights={[120, 120, 120]} />;
  if (!draft) return <ErrorBanner>{error || "Site settings could not be loaded."}</ErrorBanner>;

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel title="Brand" description="Shown in the site header, emails and browser titles.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Site name" htmlFor="site-name">
            <input id="site-name" value={draft.site_name} onChange={(e) => setDraft({ ...draft, site_name: e.target.value })} placeholder="e.g. Match4Marriage" className={inputCls} />
          </Field>
          <Field label="Tagline" htmlFor="site-tagline">
            <input id="site-tagline" value={draft.tagline || ""} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="e.g. Premium matrimony, made personal" className={inputCls} />
          </Field>
        </div>
      </Panel>

      <Panel title="Support contact" description="Where members are told to reach the bureau.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Support email" htmlFor="site-email">
            <input id="site-email" type="email" value={draft.support_email || ""} onChange={(e) => setDraft({ ...draft, support_email: e.target.value })} placeholder="support@match4marriage.com" className={inputCls} />
          </Field>
          <Field label="Support phone" htmlFor="site-phone">
            <input id="site-phone" type="tel" value={draft.support_phone || ""} onChange={(e) => setDraft({ ...draft, support_phone: e.target.value })} placeholder="+44 …" className={inputCls} />
          </Field>
        </div>
      </Panel>

      <Panel title="Locale & defaults">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="Timezone" htmlFor="site-tz">
            <select id="site-tz" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} className={inputCls}>
              {(TIMEZONES.includes(draft.timezone) ? TIMEZONES : [draft.timezone, ...TIMEZONES]).map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </Field>
          <Field label="Default currency" htmlFor="site-currency">
            <select id="site-currency" value={draft.default_currency} onChange={(e) => setDraft({ ...draft, default_currency: e.target.value })} className={inputCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Default locale" htmlFor="site-locale">
            <select id="site-locale" value={draft.default_locale} onChange={(e) => setDraft({ ...draft, default_locale: e.target.value })} className={inputCls}>
              {LOCALES.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>
        </div>
      </Panel>

      <SaveBar updatedAt={data?.updated_at} dirty={isDirty} saving={saving} onSave={save} />
    </div>
  );
}

// ─── Admins tab ──────────────────────────────────────────────────────────────

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
  const { ask, modal } = useConfirm();

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
      const [meRes, adminsRes] = await Promise.all([adminApi.me(), adminApi.listAdmins()]);
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
    const ok = await ask(`Revoke admin from ${email || uid}?`, "Their console access ends and active sessions are signed out immediately.", "Revoke admin");
    if (!ok) return;
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

  if (loading) return <TabSkeleton heights={[80, 240]} />;

  return (
    <div className="flex flex-col gap-3">
      {error && <ErrorBanner>{error}</ErrorBanner>}

      <Panel title="Signed in as">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[14px] font-medium text-foreground">{me?.email || "—"}</span>
          {(me?.roles || []).map((r) => (
            <Pill key={r} tone={r === "super_admin" ? "brand" : "info"}>{r.replace(/_/g, " ")}</Pill>
          ))}
        </div>
      </Panel>

      <Panel
        title="Admin accounts"
        description={`${admins.length} ${admins.length === 1 ? "person has" : "people have"} console access.`}
        actions={!canManage ? <span className="inline-flex items-center gap-1 text-[11.5px] text-muted2-foreground"><Lock className="h-3 w-3" aria-hidden /> Super-admin only</span> : undefined}
      >
        {admins.length === 0 ? (
          <EmptyState compact icon={ShieldCheck} title="No admins found" />
        ) : (
          <ul className="divide-y divide-border/50">
            {admins.map((a) => (
              <li key={a.uid} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-foreground">
                    <span className="truncate">{a.email || a.uid}</span>
                    {a.roles.includes("super_admin") && <Pill tone="brand">Super admin</Pill>}
                    {a.disabled && <Pill tone="neutral">Disabled</Pill>}
                  </div>
                  <div className="text-[11.5px] text-muted2-foreground" title={a.last_sign_in ? new Date(a.last_sign_in).toLocaleString("en-GB") : undefined}>
                    {a.last_sign_in ? `Last sign-in ${relTime(new Date(a.last_sign_in).toISOString())}` : "Never signed in"}
                  </div>
                </div>
                {canManage && !a.roles.includes("super_admin") && (
                  <Button size="sm" onClick={() => handleRevoke(a.uid, a.email)} disabled={busy} variant="danger">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canManage && (
          <form onSubmit={handleGrant} className="mt-4 border-t border-border/60 pt-4">
            <div className="mb-2 text-[12px] font-medium text-foreground">Grant admin</div>
            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="grant-email" className="sr-only">Email</label>
              <input
                id="grant-email"
                type="email"
                required
                placeholder="new-admin@match4marriage.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={`${inputCls} w-full sm:w-72`}
              />
              <label className="inline-flex items-center gap-2 text-[13px] text-foreground">
                <input type="checkbox" checked={create} onChange={(e) => setCreate(e.target.checked)} className="h-4 w-4 accent-[#DC1E3C]" />
                Create account if missing
              </label>
              {create && (
                <>
                  <label htmlFor="grant-password" className="sr-only">Initial password</label>
                  <input
                    id="grant-password"
                    type="password"
                    required
                    placeholder="Initial password (8+ chars)"
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoComplete="new-password"
                    className={`${inputCls} w-full sm:w-60`}
                  />
                </>
              )}
              <Button type="submit" variant="primary" size="sm" loading={busy}>
                <Plus className="h-3.5 w-3.5" aria-hidden /> Grant
              </Button>
            </div>
            <p className="mt-2 text-[11.5px] text-muted2-foreground">
              They sign in at /admin/login. Revoking ends their active sessions immediately.
            </p>
          </form>
        )}
      </Panel>
      {modal}
    </div>
  );
}

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
  const { ask, modal } = useConfirm();
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
      await adminApi.upsertMailTemplate(draft.key, {
        name: draft.name,
        subject: draft.subject,
        body_html: draft.body_html,
        body_text: draft.body_text || null,
        is_active: draft.is_active,
      });
      toast("success", `Template '${draft.key}' saved`);
      await load();
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      toast("error", typeof detail === "string" ? detail : (e?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || saving) return;
    const ok = await ask(`Delete template '${draft.key}'?`, "The default email is used until you configure it again from the catalogue.", "Delete template");
    if (!ok) return;
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

  if (loading) return <TabSkeleton heights={[360]} />;

  const allKeys = new Map<string, { name: string; configured: boolean }>();
  for (const b of builtins) allKeys.set(b.key, { name: b.name, configured: false });
  for (const t of templates) allKeys.set(t.key, { name: t.name, configured: true });
  const configured = templates.length;

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
      <Panel title="Catalogue" description={`${configured} of ${allKeys.size} customised`} bodyClassName="px-2 pb-2">
        {allKeys.size === 0 ? (
          <EmptyState compact icon={Mail} title="No templates available" />
        ) : (
          <ul className="flex flex-col">
            {Array.from(allKeys.entries()).map(([key, meta]) => (
              <CatalogueItem key={key} active={selectedKey === key} title={meta.name} sub={key} configured={meta.configured} onClick={() => selectKey(key)} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel>
        {!draft ? (
          <EmptyState compact icon={FileText} title="Pick a template" description="Choose an email from the catalogue to edit it." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-[16px] font-semibold text-foreground">{draft.name}</h3>
                <div className="font-mono text-[11.5px] text-muted2-foreground">{draft.key}</div>
              </div>
              <label className="inline-flex items-center gap-2 text-[12.5px] text-foreground">
                <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4 accent-[#DC1E3C]" />
                {draft.is_active ? "Active" : "Inactive"}
              </label>
            </div>

            <Field label="Subject" htmlFor="mail-subject">
              <input id="mail-subject" value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} placeholder="Welcome to {{ site_name }}" className={inputCls} />
            </Field>

            <Field label="HTML body" htmlFor="mail-html" hint="Use {{ first_name }}, {{ site_name }} and other placeholders supported by the template.">
              <textarea id="mail-html" value={draft.body_html} onChange={(e) => setDraft({ ...draft, body_html: e.target.value })} placeholder="<p>Hi {{ first_name }}, …</p>" rows={8} className={`${textareaCls} ${monoCls}`} />
            </Field>

            <Field label="Plain-text fallback (optional)" htmlFor="mail-text">
              <textarea id="mail-text" value={draft.body_text} onChange={(e) => setDraft({ ...draft, body_text: e.target.value })} placeholder="Hi {{ first_name }}, …" rows={4} className={`${textareaCls} ${monoCls}`} />
            </Field>

            {draft.body_html && (
              <div>
                <div className="mb-1 text-[12px] font-medium text-muted2-foreground">Preview</div>
                <div
                  className="max-h-60 overflow-auto rounded-lg border border-border/70 bg-secondary/30 p-3.5 text-[13.5px] leading-relaxed text-foreground"
                  // Admin-only preview of admin-authored HTML — same trust model as any CMS template editor.
                  dangerouslySetInnerHTML={{ __html: draft.body_html }}
                />
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="danger" onClick={remove} disabled={saving || !templates.some((t) => t.key === draft.key)} title="Only customised templates can be deleted">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
              </Button>
              <Button variant="primary" size="sm" onClick={save} loading={saving}>Save template</Button>
            </div>
          </div>
        )}
      </Panel>
      {modal}
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
  const { ask, modal } = useConfirm();
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
      toast("error", typeof detail === "string" ? detail : (e?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!draft || saving) return;
    const ok = await ask(`Remove SEO settings for ${draft.path}?`, "The page falls back to the site-wide defaults.", "Remove");
    if (!ok) return;
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

  if (loading) return <TabSkeleton heights={[320]} />;

  const allPaths = new Map<string, { label: string; configured: boolean }>();
  for (const b of builtins) allPaths.set(b.path, { label: b.label, configured: false });
  for (const s of settings) allPaths.set(s.path, { label: allPaths.get(s.path)?.label || s.path, configured: true });
  const descLen = draft?.description.length ?? 0;
  const titleLen = draft?.title.length ?? 0;

  return (
    <div className="grid items-start gap-3 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)]">
      <Panel title="Pages" description={`${settings.length} customised`} bodyClassName="px-2 pb-2">
        <ul className="mb-2 flex flex-col">
          {Array.from(allPaths.entries()).map(([path, meta]) => (
            <CatalogueItem key={path} active={selectedPath === path} title={meta.label} sub={path} configured={meta.configured} onClick={() => selectPath(path)} />
          ))}
        </ul>
        <div className="flex gap-1.5 border-t border-border/60 px-1 pt-2">
          <label htmlFor="seo-new-path" className="sr-only">Custom path</label>
          <input
            id="seo-new-path"
            value={newPath}
            onChange={(e) => setNewPath(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomPath(); } }}
            placeholder="/custom/path"
            className={`${inputCls} ${monoCls} flex-1`}
          />
          <Button size="sm" onClick={addCustomPath} disabled={!newPath.trim()}>Add</Button>
        </div>
      </Panel>

      <Panel>
        {!draft ? (
          <EmptyState compact icon={SearchIcon} title="Pick a page" description="Or add a custom path to set its search appearance." />
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <h3 className="text-[16px] font-semibold text-foreground">
                SEO for <span className="font-mono text-[14px] text-primary">{draft.path}</span>
              </h3>
              <p className="text-[12px] text-muted2-foreground">Used in &lt;head&gt; on the public page.</p>
            </div>

            <Field label="Title" htmlFor="seo-title" hint={<span className={titleLen > 60 ? "text-[#9F1239]" : ""}>{titleLen} / 60 characters</span>}>
              <input id="seo-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="e.g. Match4Marriage: Premium Matrimony" className={inputCls} />
            </Field>

            <Field label="Meta description" htmlFor="seo-desc" hint={<span className={descLen > 160 ? "text-[#9F1239]" : ""}>{descLen} / 160 characters</span>}>
              <textarea id="seo-desc" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="Up to ~160 characters of descriptive text for search results." rows={3} className={textareaCls} />
            </Field>

            {/* Search-result preview */}
            <div className="rounded-lg border border-border/70 bg-secondary/30 p-3">
              <div className="mb-1 text-[11.5px] font-medium text-muted2-foreground">Search preview</div>
              <div className="truncate text-[15px] text-[#1a0dab]">{draft.title || "Page title"}</div>
              <div className="truncate text-[12px] text-[#006621]">match4marriage.com{draft.path}</div>
              <div className="line-clamp-2 text-[12.5px] text-foreground/80">{draft.description || "Meta description appears here."}</div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label="Open Graph image URL" htmlFor="seo-og">
                <input id="seo-og" value={draft.og_image_url} onChange={(e) => setDraft({ ...draft, og_image_url: e.target.value })} placeholder="https://…" className={`${inputCls} ${monoCls}`} />
              </Field>
              <Field label="Robots" htmlFor="seo-robots">
                <select id="seo-robots" value={draft.robots} onChange={(e) => setDraft({ ...draft, robots: e.target.value })} className={inputCls}>
                  {ROBOTS_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="danger" onClick={remove} disabled={saving || !settings.some((s) => s.path === draft.path)} title="Only customised pages can be removed">
                <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
              </Button>
              <Button variant="primary" size="sm" onClick={save} loading={saving}>Save SEO settings</Button>
            </div>
          </div>
        )}
      </Panel>
      {modal}
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDirty = !!(data && draft && (
    (data.logo_url ?? "")      !== (draft.logo_url ?? "")     ||
    (data.favicon_url ?? "")   !== (draft.favicon_url ?? "")  ||
    (data.brand_primary ?? "") !== (draft.brand_primary ?? "") ||
    (data.brand_accent ?? "")  !== (draft.brand_accent ?? "")
  ));

  const save = async () => {
    if (!draft || saving) return;
    if (draft.brand_primary && !HEX_RE.test(draft.brand_primary)) {
      toast("warning", "Primary colour must be #RRGGBB or #RRGGBBAA");
      return;
    }
    if (draft.brand_accent && !HEX_RE.test(draft.brand_accent)) {
      toast("warning", "Accent colour must be #RRGGBB or #RRGGBBAA");
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

  if (loading) return <TabSkeleton heights={[160, 220]} />;
  if (!draft) return <ErrorBanner>Appearance settings could not be loaded.</ErrorBanner>;

  const previewPrimary = draft.brand_primary && HEX_RE.test(draft.brand_primary) ? draft.brand_primary : "#dc1e3c";
  const previewAccent  = draft.brand_accent  && HEX_RE.test(draft.brand_accent)  ? draft.brand_accent  : "#c9954a";
  const primaryInvalid = !!draft.brand_primary && !HEX_RE.test(draft.brand_primary);
  const accentInvalid = !!draft.brand_accent && !HEX_RE.test(draft.brand_accent);

  return (
    <div className="flex flex-col gap-3">
      <Panel title="Logo & favicon">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Logo URL" htmlFor="app-logo">
            <input id="app-logo" value={draft.logo_url || ""} onChange={(e) => setDraft({ ...draft, logo_url: e.target.value })} placeholder="https://res.cloudinary.com/…" className={inputCls} />
          </Field>
          <Field label="Favicon URL" htmlFor="app-favicon">
            <input id="app-favicon" value={draft.favicon_url || ""} onChange={(e) => setDraft({ ...draft, favicon_url: e.target.value })} placeholder="https://…/favicon.ico" className={inputCls} />
          </Field>
        </div>
        {draft.logo_url && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-border/70 bg-secondary/30 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={draft.logo_url}
              alt="Logo preview"
              className="h-10 max-w-[200px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
            <span className="text-[11.5px] text-muted2-foreground">Live preview</span>
          </div>
        )}
      </Panel>

      <Panel title="Brand colours">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Primary" htmlFor="app-primary" hint={primaryInvalid ? <span className="text-[#9F1239]">Use #RRGGBB or #RRGGBBAA</span> : "Buttons, links and highlights."}>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Pick primary colour"
                value={draft.brand_primary && HEX_RE.test(draft.brand_primary) ? draft.brand_primary.slice(0, 7) : "#dc1e3c"}
                onChange={(e) => setDraft({ ...draft, brand_primary: e.target.value })}
                className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-border bg-card p-0.5"
              />
              <input id="app-primary" value={draft.brand_primary || ""} onChange={(e) => setDraft({ ...draft, brand_primary: e.target.value })} placeholder="#dc1e3c" aria-invalid={primaryInvalid} className={`${inputCls} font-mono`} />
            </div>
          </Field>
          <Field label="Accent" htmlFor="app-accent" hint={accentInvalid ? <span className="text-[#9F1239]">Use #RRGGBB or #RRGGBBAA</span> : "Secondary highlights and badges."}>
            <div className="flex gap-2">
              <input
                type="color"
                aria-label="Pick accent colour"
                value={draft.brand_accent && HEX_RE.test(draft.brand_accent) ? draft.brand_accent.slice(0, 7) : "#c9954a"}
                onChange={(e) => setDraft({ ...draft, brand_accent: e.target.value })}
                className="h-9 w-11 shrink-0 cursor-pointer rounded-lg border border-border bg-card p-0.5"
              />
              <input id="app-accent" value={draft.brand_accent || ""} onChange={(e) => setDraft({ ...draft, brand_accent: e.target.value })} placeholder="#c9954a" aria-invalid={accentInvalid} className={`${inputCls} font-mono`} />
            </div>
          </Field>
        </div>

        {/* Live preview — swatches use the chosen colours; the text stays in ink. */}
        <div className="mt-4 rounded-lg border border-border/70 bg-secondary/30 p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="h-9 w-9 rounded-lg" style={{ background: previewPrimary }} aria-hidden />
            <span className="h-9 w-9 rounded-lg" style={{ background: previewAccent }} aria-hidden />
            <div>
              <div className="text-[14px] font-semibold text-foreground">Brand preview</div>
              <div className="font-mono text-[11.5px] text-muted2-foreground">Primary {previewPrimary} · Accent {previewAccent}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-lg px-3 text-[12.5px] font-medium text-white" style={{ background: previewPrimary }}>Primary action</span>
            <span className="inline-flex h-8 items-center rounded-lg border bg-card px-3 text-[12.5px] font-medium text-foreground" style={{ borderColor: previewAccent }}>Accent outline</span>
          </div>
        </div>
      </Panel>

      <SaveBar updatedAt={data?.updated_at} dirty={isDirty} saving={saving} onSave={save} />
    </div>
  );
}

// ─── Payment gateway tab ─────────────────────────────────────────────────────

interface GatewayConfig {
  id: string;
  gateway: "paypal";
  publishable_key: string | null;
  secret_configured: boolean;
  secret_tail: string | null;
  webhook_configured: boolean;
  webhook_tail: string | null;
  is_test_mode: boolean;
  is_active: boolean;
  updated_at: string | null;
}

const GATEWAY_OPTIONS: Array<{ key: "paypal"; label: string; description: string }> = [
  { key: "paypal", label: "PayPal", description: "PayPal balance & cards. Use Test mode for sandbox." },
];

// Per-gateway field labels. PayPal's three slots map to Client ID /
// Client Secret / Webhook ID rather than the generic key names.
function gatewayFieldLabels(g: string) {
  if (g === "paypal") {
    return {
      publishable: "Client ID",
      secret: "Client secret",
      webhook: "Webhook ID",
      publishablePlaceholder: "PayPal REST app Client ID",
    };
  }
  return {
    publishable: "Publishable / public key",
    secret: "Secret key",
    webhook: "Webhook secret",
    publishablePlaceholder:
      g === "razorpay" ? "rzp_test_…" : g === "stripe" ? "pk_test_…" : "vpa@bank",
  };
}

function PaymentGatewayTab() {
  const { toast } = useToast();
  const { ask, modal } = useConfirm();
  const [configs, setConfigs] = useState<GatewayConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<"paypal">("paypal");
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

  const hydrateDraft = (key: "paypal", list: GatewayConfig[] = configs) => {
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

  const switchTo = (key: "paypal") => {
    setSelected(key);
    hydrateDraft(key);
  };

  const existing = configs.find((c) => c.gateway === selected);
  const labels = gatewayFieldLabels(selected);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Only send secret fields when the admin typed something — empty string
      // means "leave it alone"; the separate Clear action sends null.
      const body: any = {
        publishable_key: draft.publishable_key || null,
        is_test_mode: draft.is_test_mode,
        is_active: draft.is_active,
      };
      if (draft.secret_key.length > 0) body.secret_key = draft.secret_key;
      if (draft.webhook_secret.length > 0) body.webhook_secret = draft.webhook_secret;
      await adminApi.upsertPaymentGateway(selected, body);
      toast("success", `${GATEWAY_OPTIONS.find((g) => g.key === selected)?.label || selected} gateway saved`);
      await load();
    } catch (e: any) {
      const detail = (e as any)?.detail ?? e?.response?.data?.detail;
      toast("error", typeof detail === "string" ? detail : (e?.message || "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const clearSecret = async (which: "secret_key" | "webhook_secret") => {
    const label = which === "secret_key" ? labels.secret : labels.webhook;
    const ok = await ask(`Clear the stored ${label.toLowerCase()}?`, "Payments through this gateway stop working until you enter it again.", "Clear");
    if (!ok) return;
    setSaving(true);
    try {
      await adminApi.upsertPaymentGateway(selected, { [which]: null } as any);
      toast("success", `${label} cleared`);
      await load();
    } catch (e: any) {
      toast("error", e?.message || "Clear failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <TabSkeleton heights={[72, 300]} />;

  return (
    <div className="flex flex-col gap-3">
      {/* Gateway picker */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5" role="radiogroup" aria-label="Payment gateway">
        {GATEWAY_OPTIONS.map(({ key, label, description }) => {
          const active = selected === key;
          const cfg = configs.find((c) => c.gateway === key);
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => switchTo(key)}
              className={`rounded-xl border bg-card p-3.5 text-left transition-[border-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${
                active ? "border-primary/40 shadow-[0_2px_10px_rgba(26,10,20,0.06)]" : "border-border/70 hover:border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-semibold text-foreground">{label}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted2-foreground">{description}</div>
                </div>
                {cfg ? (
                  <Pill tone={cfg.is_active ? "good" : cfg.is_test_mode ? "warn" : "neutral"}>
                    {cfg.is_active ? (cfg.is_test_mode ? "Active · test" : "Active · live") : cfg.is_test_mode ? "Test" : "Off"}
                  </Pill>
                ) : <Pill tone="neutral">Not set up</Pill>}
              </div>
            </button>
          );
        })}
      </div>

      <Panel
        title={`${GATEWAY_OPTIONS.find((g) => g.key === selected)?.label} credentials`}
        description={existing?.updated_at ? `Last updated ${relTime(existing.updated_at)}` : "Not configured yet"}
      >
        <div className="flex flex-col gap-4">
          <Field label={labels.publishable} htmlFor="gw-public">
            <input id="gw-public" value={draft.publishable_key} onChange={(e) => setDraft({ ...draft, publishable_key: e.target.value })} placeholder={labels.publishablePlaceholder} className={`${inputCls} ${monoCls}`} autoComplete="off" />
          </Field>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label={labels.secret}
              htmlFor="gw-secret"
              hint={existing?.secret_configured ? (
                <button type="button" onClick={() => clearSecret("secret_key")} className="rounded font-medium text-[#9F1239] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  Clear stored secret
                </button>
              ) : undefined}
            >
              <input
                id="gw-secret"
                type="password"
                value={draft.secret_key}
                onChange={(e) => setDraft({ ...draft, secret_key: e.target.value })}
                placeholder={existing?.secret_configured ? `Set (…${existing.secret_tail}). Type to replace.` : "Enter to set"}
                className={`${inputCls} ${monoCls}`}
                autoComplete="off"
              />
            </Field>
            <Field
              label={labels.webhook}
              htmlFor="gw-webhook"
              hint={existing?.webhook_configured ? (
                <button type="button" onClick={() => clearSecret("webhook_secret")} className="rounded font-medium text-[#9F1239] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
                  Clear stored webhook value
                </button>
              ) : undefined}
            >
              <input
                id="gw-webhook"
                type="password"
                value={draft.webhook_secret}
                onChange={(e) => setDraft({ ...draft, webhook_secret: e.target.value })}
                placeholder={existing?.webhook_configured ? `Set (…${existing.webhook_tail}). Type to replace.` : "Enter to set"}
                className={`${inputCls} ${monoCls}`}
                autoComplete="off"
              />
            </Field>
          </div>

          <div className="flex flex-wrap gap-2">
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] text-foreground ${draft.is_test_mode ? "border-[#EEDBB0] bg-[#FBF0DA]/70" : "border-border bg-secondary/40"}`}>
              <input type="checkbox" checked={draft.is_test_mode} onChange={(e) => setDraft({ ...draft, is_test_mode: e.target.checked })} className="h-4 w-4 accent-[#B07D35]" />
              <span className="font-medium">Test mode (sandbox)</span>
            </label>
            <label className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] text-foreground ${draft.is_active ? "border-[#CFE0D3] bg-[#EAF2EB]/70" : "border-border bg-secondary/40"}`}>
              <input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} className="h-4 w-4 accent-[#3F6B4A]" />
              <span className="font-medium">Active (accept payments)</span>
            </label>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-border/70 bg-secondary/30 px-3 py-2.5 text-[12px] leading-relaxed text-muted2-foreground">
            <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-foreground" aria-hidden />
            <span>
              <strong className="font-medium text-foreground">Secrets are write-only.</strong> Stored values are never shown again.
              Leave a field blank to keep the current value; use Clear to remove one on purpose.
            </span>
          </div>

          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={save} loading={saving}>
              Save {GATEWAY_OPTIONS.find((g) => g.key === selected)?.label}
            </Button>
          </div>
        </div>
      </Panel>
      {modal}
    </div>
  );
}
