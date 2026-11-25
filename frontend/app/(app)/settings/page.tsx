"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithEmailAndPassword,
  updatePassword,
  updatePhoneNumber,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  AlertCircle, Bell, CheckCircle, ChevronRight, Download, ExternalLink, Eye, FileText,
  Image as ImageIcon, KeyRound, Loader2, Lock, LogOut, Mail, MonitorSmartphone, PauseCircle,
  Phone, Shield, Trash2, User as UserIcon,
} from "lucide-react";
import {
  authErrorMessage, firebaseAuth, hasPasswordSignIn, reauthenticateWithPassword,
  rememberSessionUid, signOutAndClear,
} from "@/lib/firebase";
import {
  accountApi, api, apiErrorMessage, isReauthRequired, type NotificationPrefs,
} from "@/lib/api";

/* ─────────────────────────────────────────────────────────────────────────
   Settings — Account & Security · Notifications · Privacy & Safety ·
   Data & Privacy. Every control here is wired to the backend
   (routers/auth.py) or Firebase Auth; nothing is decorative.
   ───────────────────────────────────────────────────────────────────────── */

type Section = "account" | "notifications" | "privacy" | "data";

const NAV: { key: Section; icon: React.ReactNode; label: string }[] = [
  { key: "account",       icon: <Shield className="w-4 h-4" />,   label: "Account & Security" },
  { key: "notifications", icon: <Bell className="w-4 h-4" />,     label: "Notifications"      },
  { key: "privacy",       icon: <Eye className="w-4 h-4" />,      label: "Privacy & Safety"   },
  { key: "data",          icon: <Download className="w-4 h-4" />, label: "Data & Privacy"     },
];

const PLAN_NAME: Record<string, string> = { free: "Basic", silver: "Basic", gold: "Premium", platinum: "Elite" };

const COUNTRY_CODES = [
  { code: "+44", label: "UK · +44" },
  { code: "+91", label: "IN · +91" },
  { code: "+1", label: "US · +1" },
  { code: "+971", label: "UAE · +971" },
  { code: "+61", label: "AU · +61" },
  { code: "+65", label: "SG · +65" },
];

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
// Unicode letters (José, Anaïs, Ó Briain) — built via RegExp because the TS target predates the `u` flag literal.
const NAME_RE = new RegExp("^\\p{L}+(?:[ '\u2019\\-.]+\\p{L}+)*\\.?$", "u");
const FONT = "var(--font-poppins, sans-serif)";

type AccountInfo = {
  email: string | null;
  phone: string | null;
  is_email_verified: boolean;
  is_phone_verified: boolean;
  membership_number: string | null;
  first_name: string | null;
  last_name: string | null;
  subscription_tier: string | null;
};

type Msg = { tone: "info" | "error" | "success"; text: string } | null;

/* ── Small building blocks ─────────────────────────────────────────────── */

function Switch({ on, onToggle, labelledBy, describedBy, disabled }: {
  on: boolean; onToggle: () => void; labelledBy: string; describedBy?: string; disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={onToggle}
      className="m4m-set-switch"
      style={{ background: on ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "rgba(255,255,255,0.12)" }}
    >
      <span aria-hidden style={{ left: on ? 20 : 2 }} />
    </button>
  );
}

function Card({ title, desc, aside, children, tone = "default" }: {
  title?: string; desc?: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode;
  tone?: "default" | "danger";
}) {
  const danger = tone === "danger";
  return (
    <section
      style={{
        background: danger ? "rgba(239,68,68,0.04)" : "rgba(255,255,255,0.04)",
        border: `1px solid ${danger ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.10)"}`,
        borderRadius: 16,
        padding: "18px 20px 6px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.28)",
      }}
    >
      {(title || aside) && (
        <header style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          <div>
            {title && (
              <h2 style={{ fontFamily: FONT, fontSize: 15, fontWeight: 600, color: danger ? "#f87171" : "#f4eef0", margin: 0 }}>
                {title}
              </h2>
            )}
            {desc && <p style={{ fontFamily: FONT, fontSize: 12.5, color: "rgba(255,255,255,0.55)", margin: "4px 0 0", lineHeight: 1.55 }}>{desc}</p>}
          </div>
          {aside}
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

function Row({ icon, label, labelId, desc, descId, children, last }: {
  icon?: React.ReactNode; label: React.ReactNode; labelId?: string; desc?: React.ReactNode; descId?: string;
  children?: React.ReactNode; last?: boolean;
}) {
  return (
    <div
      className="m4m-set-row"
      style={{ borderBottom: last ? "none" : "1px solid rgba(255,255,255,0.07)" }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0, flex: 1 }}>
        {icon && <span aria-hidden style={{ color: "rgba(255,255,255,0.45)", marginTop: 2, flexShrink: 0 }}>{icon}</span>}
        <div style={{ minWidth: 0 }}>
          <p id={labelId} style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.88)", margin: 0 }}>{label}</p>
          {desc && (
            <div id={descId} style={{ fontFamily: FONT, fontSize: 12.5, color: "rgba(255,255,255,0.55)", margin: "3px 0 0", lineHeight: 1.5, overflowWrap: "anywhere" }}>
              {desc}
            </div>
          )}
        </div>
      </div>
      {children && <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>{children}</div>}
    </div>
  );
}

function Btn({ kind = "ghost", loading, children, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  kind?: "primary" | "ghost" | "danger" | "danger-ghost"; loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...rest}
      disabled={rest.disabled || loading}
      aria-busy={loading || undefined}
      className={`m4m-set-btn m4m-set-btn--${kind} ${rest.className ?? ""}`}
    >
      {loading && <Loader2 className="m4m-set-spin" style={{ width: 13, height: 13 }} aria-hidden />}
      {children}
    </button>
  );
}

function Field({ label, error, hint, id: idProp, className, ...input }: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string; error?: string; hint?: string;
}) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <label htmlFor={id} className="m4m-set-label">{label}</label>
      <input
        id={id}
        {...input}
        aria-invalid={!!error || undefined}
        aria-describedby={error || hint ? `${id}-msg` : undefined}
        className={"m4m-set-input" + (error ? " is-invalid" : "") + (className ? ` ${className}` : "")}
      />
      {(error || hint) && (
        <p id={`${id}-msg`} className={"m4m-set-help" + (error ? " is-error" : "")}>{error || hint}</p>
      )}
    </div>
  );
}

function InlineMsg({ msg }: { msg: Msg }) {
  if (!msg) return null;
  const c = msg.tone === "error" ? "#ff8aa3" : msg.tone === "success" ? "#8DB870" : "rgba(255,255,255,0.75)";
  const bg = msg.tone === "error" ? "rgba(220,30,60,0.10)" : msg.tone === "success" ? "rgba(141,184,112,0.10)" : "rgba(255,255,255,0.05)";
  return (
    <div
      role={msg.tone === "error" ? "alert" : "status"}
      style={{
        display: "flex", alignItems: "flex-start", gap: 8, padding: "10px 12px", borderRadius: 10,
        background: bg, color: c, fontFamily: FONT, fontSize: 12.5, lineHeight: 1.5,
      }}
    >
      {msg.tone === "error" ? <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} aria-hidden />
        : msg.tone === "success" ? <CheckCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} aria-hidden /> : null}
      <span>{msg.text}</span>
    </div>
  );
}

function Badge({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 8px", borderRadius: 999,
      fontFamily: FONT, fontSize: 11, fontWeight: 600,
      color: ok ? "#8DB870" : "#e9b872",
      background: ok ? "rgba(141,184,112,0.12)" : "rgba(201,149,74,0.14)",
    }}>
      {ok && <CheckCircle style={{ width: 11, height: 11 }} aria-hidden />}
      {children}
    </span>
  );
}

/** Inline edit panel that slides open beneath a row. */
function Panel({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form
      noValidate
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="m4m-set-panel"
    >
      {children}
    </form>
  );
}

/** Native <dialog> — focus is trapped and Escape closes it for free. */
function Dialog({ open, onClose, title, busy, children, danger }: {
  open: boolean; onClose: () => void; title: string; busy?: boolean; children: React.ReactNode; danger?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="m4m-set-dialog"
      onCancel={(e) => { e.preventDefault(); if (!busy) onClose(); }}
      onClick={(e) => { if (e.target === ref.current && !busy) onClose(); }}
    >
      <div style={{ padding: 24 }}>
        <h2 id={titleId} style={{
          fontFamily: "var(--font-playfair, serif)", fontSize: 22, fontWeight: 400,
          color: danger ? "#f87171" : "#f4eef0", margin: "0 0 12px",
        }}>
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}

function PasswordConfirm({ value, onChange, error, hasPassword, autoFocus }: {
  value: string; onChange: (v: string) => void; error?: string; hasPassword: boolean; autoFocus?: boolean;
}) {
  if (!hasPassword) {
    return (
      <p className="m4m-set-help">
        For your security this needs a recent sign-in. If you signed in more than 5 minutes ago,
        sign out and back in first.
      </p>
    );
  }
  return (
    <Field
      label="Current password"
      type="password"
      autoComplete="current-password"
      value={value}
      autoFocus={autoFocus}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      hint={error ? undefined : "We ask for this to confirm it's really you."}
    />
  );
}

function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Re-auth with password when the member has one; map errors to copy. */
async function confirmIdentity(hasPassword: boolean, password: string): Promise<string | null> {
  if (!hasPassword) return null;
  if (!password) return "Enter your current password.";
  try {
    await reauthenticateWithPassword(password);
    return null;
  } catch (e) {
    return authErrorMessage(e);
  }
}

function friendlyError(e: unknown, fallback?: string): string {
  if (isReauthRequired(e)) return "For your security, please confirm your password and try again.";
  const code = (e as any)?.code;
  if (typeof code === "string" && code.startsWith("auth/")) return authErrorMessage(e, fallback);
  return apiErrorMessage(e, fallback);
}

/* ── Page ─────────────────────────────────────────────────────────────── */

export default function SettingsPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("account");

  // Deep-link support: /settings?section=notifications
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("section");
    if (q && NAV.some((n) => n.key === q)) setSection(q as Section);
  }, []);
  const go = (s: Section) => {
    setSection(s);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("section", s);
      window.history.replaceState(null, "", url.toString());
    } catch { /* non-fatal */ }
  };

  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);
  const [info, setInfo] = useState<AccountInfo | null>(null);
  const [infoError, setInfoError] = useState("");

  const loadInfo = useCallback(async () => {
    try {
      const res = await accountApi.me();
      setInfo((res.data as any)?.data ?? null);
      setInfoError("");
    } catch (e) {
      setInfoError(apiErrorMessage(e, "We couldn't load your account details."));
    }
  }, []);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((u) => setFbUser(u));
    void loadInfo();
    return () => unsub();
  }, [loadInfo]);

  const hasPassword = hasPasswordSignIn(fbUser);
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    setSigningOut(true);
    await signOutAndClear();
    router.replace("/auth/login");
  };

  return (
    <div className="m4m-set px-4 py-6 sm:px-8 sm:py-8" style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)", minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -130, right: -90, width: 440, height: 440, borderRadius: "50%", background: "radial-gradient(circle, rgba(220,30,60,0.20), transparent 70%)", filter: "blur(50px)" }} />
        <div style={{ position: "absolute", bottom: -150, left: -110, width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,149,74,0.12), transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div style={{ maxWidth: 940, position: "relative" }}>
        <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 30, fontWeight: 300, color: "#f4eef0", margin: "0 0 6px" }}>
          Settings
        </h1>
        <p style={{ fontFamily: FONT, fontSize: 13.5, color: "rgba(255,255,255,0.55)", margin: "0 0 24px" }}>
          Manage your sign-in details, what we email you about, and your data.
        </p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-[210px_1fr]">
          {/* Nav — horizontal scroll on mobile, vertical rail on md+ */}
          <nav aria-label="Settings sections" className="flex flex-row gap-1 overflow-x-auto md:flex-col md:gap-1 md:overflow-visible" style={{ alignSelf: "start" }}>
            {NAV.map((n) => {
              const active = section === n.key;
              return (
                <button
                  key={n.key}
                  type="button"
                  onClick={() => go(n.key)}
                  aria-current={active ? "page" : undefined}
                  className="m4m-set-nav"
                  style={{
                    background: active ? "rgba(220,30,60,0.18)" : "transparent",
                    color: active ? "#ff8aa3" : "rgba(255,255,255,0.65)",
                  }}
                >
                  <span aria-hidden style={{ color: active ? "#ff8aa3" : "rgba(255,255,255,0.4)" }}>{n.icon}</span>
                  {n.label}
                </button>
              );
            })}
            <div className="flex-shrink-0 md:mt-4 md:pt-4 md:border-t md:border-[rgba(255,255,255,0.1)]">
              <button type="button" onClick={handleSignOut} disabled={signingOut} className="m4m-set-nav" style={{ color: "#f87171", width: "100%" }}>
                {signingOut ? <Loader2 className="w-4 h-4 m4m-set-spin" aria-hidden /> : <LogOut className="w-4 h-4" aria-hidden />}
                Sign out
              </button>
            </div>
          </nav>

          <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
            {infoError && (
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <InlineMsg msg={{ tone: "error", text: infoError }} />
                <Btn onClick={loadInfo}>Try again</Btn>
              </div>
            )}

            {section === "account" && (
              <AccountSection
                info={info}
                fbUser={fbUser}
                hasPassword={hasPassword}
                reload={loadInfo}
                onSignedOutEverywhere={() => router.replace("/auth/login?signedout=all")}
              />
            )}
            {section === "notifications" && <NotificationsSection />}
            {section === "privacy" && <PrivacySection goToData={() => go("data")} />}
            {section === "data" && <DataSection hasPassword={hasPassword} />}
          </div>
        </div>
      </div>

      <SettingsStyles />
    </div>
  );
}

/* ── Account & Security ───────────────────────────────────────────────── */

type Editing = null | "name" | "email" | "phone" | "password";

function AccountSection({ info, fbUser, hasPassword, reload, onSignedOutEverywhere }: {
  info: AccountInfo | null; fbUser: FirebaseUser | null; hasPassword: boolean;
  reload: () => Promise<void>; onSignedOutEverywhere: () => void;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const [flash, setFlash] = useState<Msg>(null);
  const done = async (text: string) => {
    setEditing(null);
    setFlash({ tone: "success", text });
    await reload();
  };

  const fullName = [info?.first_name, info?.last_name].filter(Boolean).join(" ");
  const email = info?.email || fbUser?.email || null;
  const phoneDisplay = fbUser?.phoneNumber || info?.phone || null;
  const plan = PLAN_NAME[(info?.subscription_tier || "free").toLowerCase()] || "Basic";
  const loading = info === null;

  return (
    <>
      <InlineMsg msg={flash} />

      <Card
        title="Your account"
        desc={info?.membership_number ? <>Membership number <strong style={{ color: "rgba(255,255,255,0.85)", fontWeight: 600, letterSpacing: "0.04em" }}>{info.membership_number}</strong></> : undefined}
        aside={
          <Link href="/subscription" className="m4m-set-link" aria-label={`Current plan: ${plan}. Manage plan`}>
            {plan} plan <ChevronRight style={{ width: 14, height: 14 }} aria-hidden />
          </Link>
        }
      >
        <Row
          icon={<UserIcon className="w-4 h-4" />}
          label="Name"
          desc={loading ? <span className="m4m-set-skel" style={{ width: 140 }} /> : (fullName || "Not set yet")}
          last={editing !== "name"}
        >
          {editing !== "name" && (
            <Btn onClick={() => { setFlash(null); setEditing("name"); }} disabled={loading} aria-label="Edit name">Edit</Btn>
          )}
        </Row>
        {editing === "name" && info && (
          <NameEditor info={info} onCancel={() => setEditing(null)} onDone={() => done("Your name has been updated.")} />
        )}
        <Row
          icon={<FileText className="w-4 h-4" />}
          label="Profile & partner preferences"
          desc="Edit your profile details, photos and the partner you're looking for."
          last
        >
          <Link href="/profile/me" className="m4m-set-btn m4m-set-btn--ghost">Open profile</Link>
        </Row>
      </Card>

      <Card title="Sign-in & contact" desc="These are private — they're never shown on your profile.">
        {/* Email */}
        <Row
          icon={<Mail className="w-4 h-4" />}
          label={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>Email {info && email && <Badge ok={info.is_email_verified}>{info.is_email_verified ? "Verified" : "Not verified"}</Badge>}</span>}
          desc={loading ? <span className="m4m-set-skel" style={{ width: 190 }} /> : (email || "No email on file")}
          last={editing === "email" ? false : undefined}
        >
          {editing !== "email" && (
            <Btn onClick={() => { setFlash(null); setEditing("email"); }} disabled={loading} aria-label="Change email">Change</Btn>
          )}
        </Row>
        {info && !info.is_email_verified && email && editing !== "email" && (
          <VerifyEmailInline email={email} onVerified={() => done("Email verified. Thank you for confirming your address.")} />
        )}
        {editing === "email" && (
          <EmailEditor
            current={email}
            hasPassword={hasPassword}
            onCancel={() => setEditing(null)}
            onDone={() => done("Your email address has been updated. Use it next time you sign in.")}
          />
        )}

        {/* Phone */}
        <Row
          icon={<Phone className="w-4 h-4" />}
          label={<span style={{ display: "inline-flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>Mobile number {phoneDisplay && <Badge ok={!!fbUser?.phoneNumber || !!info?.is_phone_verified}>{fbUser?.phoneNumber || info?.is_phone_verified ? "Verified" : "Not verified"}</Badge>}</span>}
          desc={loading ? <span className="m4m-set-skel" style={{ width: 130 }} /> : (phoneDisplay || "No number on file")}
        >
          {editing !== "phone" && (
            <Btn onClick={() => { setFlash(null); setEditing("phone"); }} disabled={loading} aria-label="Change mobile number">
              {phoneDisplay ? "Change" : "Add"}
            </Btn>
          )}
        </Row>
        {editing === "phone" && (
          <PhoneEditor
            hasPassword={hasPassword}
            onCancel={() => setEditing(null)}
            onDone={() => done("Your mobile number has been updated.")}
          />
        )}

        {/* Password */}
        <Row
          icon={<KeyRound className="w-4 h-4" />}
          label="Password"
          desc={hasPassword ? "Use at least 8 characters. Changing it signs you out on other devices." : "You sign in with your mobile number."}
          last={editing !== "password"}
        >
          {hasPassword && editing !== "password" && (
            <Btn onClick={() => { setFlash(null); setEditing("password"); }} aria-label="Change password">Change</Btn>
          )}
        </Row>
        {editing === "password" && (
          <PasswordEditor
            email={fbUser?.email || email}
            onCancel={() => setEditing(null)}
            onDone={() => done("Your password has been changed.")}
          />
        )}
      </Card>

      <SessionsCard onDone={onSignedOutEverywhere} />
    </>
  );
}

function NameEditor({ info, onCancel, onDone }: { info: AccountInfo; onCancel: () => void; onDone: () => void }) {
  const [first, setFirst] = useState(info.first_name || "");
  const [last, setLast] = useState(info.last_name || "");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const v = (s: string) => {
    const t = s.trim();
    if (!t) return "Required";
    if (t.length > 100) return "Keep it under 100 characters";
    if (!NAME_RE.test(t)) return "Letters, spaces, hyphens and apostrophes only";
    return "";
  };
  const fErr = touched ? v(first) : "";
  const lErr = touched ? v(last) : "";
  const submit = async () => {
    setTouched(true);
    if (v(first) || v(last)) return;
    setBusy(true); setMsg(null);
    try {
      await accountApi.updateName({ first_name: first.trim(), last_name: last.trim() });
      try { localStorage.setItem("user_name", `${first.trim()} ${last.trim()}`.trim()); } catch {}
      onDone();
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't save your name.") });
    } finally { setBusy(false); }
  };
  return (
    <Panel onSubmit={submit}>
      <div className="m4m-set-grid2">
        <Field label="First name" autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} error={fErr} autoFocus />
        <Field label="Last name" autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} error={lErr} />
      </div>
      <InlineMsg msg={msg} />
      <PanelActions busy={busy} onCancel={onCancel} submitLabel="Save name" />
    </Panel>
  );
}

function PanelActions({ busy, onCancel, submitLabel, disabled }: {
  busy: boolean; onCancel: () => void; submitLabel: string; disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
      <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
      <Btn kind="primary" type="submit" loading={busy} disabled={disabled}>{submitLabel}</Btn>
    </div>
  );
}

function VerifyEmailInline({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [stage, setStage] = useState<"idle" | "sending" | "code" | "verifying">("idle");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const send = async () => {
    setMsg(null); setStage("sending");
    try {
      const res = await api.post<any>("/api/v1/auth/send-verification-email");
      const d = (res.data as any)?.data;
      if (d?.email_verified) { onVerified(); return; }
      setStage("code");
      setMsg({ tone: "info", text: `We've sent a 6-digit code to ${d?.email ?? email}. It expires in 10 minutes.` });
    } catch (e) {
      setStage("idle");
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't send the email. Try again.") });
    }
  };
  const verify = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) { setMsg({ tone: "error", text: "Enter the 6-digit code from the email." }); return; }
    setStage("verifying");
    try {
      await api.get(`/api/v1/auth/verify-email?token=${c}`);
      try { await firebaseAuth.currentUser?.getIdToken(true); } catch {}
      onVerified();
    } catch (e) {
      setStage("code");
      const t = friendlyError(e, "We couldn't verify the code.");
      setMsg({ tone: "error", text: /expired|invalid/i.test(t) ? "That code is invalid or expired. Send a new one." : t });
    }
  };
  return (
    <div className="m4m-set-panel" style={{ background: "rgba(201,149,74,0.06)", borderColor: "rgba(201,149,74,0.2)" }}>
      <p className="m4m-set-help" style={{ margin: 0 }}>
        Confirm this address so we can reach you about your account. It takes a few seconds.
      </p>
      {stage === "code" || stage === "verifying" ? (
        <form noValidate onSubmit={(e) => { e.preventDefault(); void verify(); }} style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: "1 0 160px" }}>
            <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus className="m4m-set-code" />
          </div>
          <Btn kind="primary" type="submit" loading={stage === "verifying"}>Verify</Btn>
          <Btn onClick={send} disabled={stage === "verifying"}>Resend</Btn>
        </form>
      ) : (
        <div><Btn kind="primary" onClick={send} loading={stage === "sending"}>Send verification code</Btn></div>
      )}
      <InlineMsg msg={msg} />
    </div>
  );
}

function EmailEditor({ current, hasPassword, onCancel, onDone }: {
  current: string | null; hasPassword: boolean; onCancel: () => void; onDone: () => void;
}) {
  const [step, setStep] = useState<"form" | "code">("form");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const target = newEmail.trim().toLowerCase();
  const emailErr = !touched ? "" : !EMAIL_RE.test(target) ? "Enter a valid email address"
    : current && target === current.toLowerCase() ? "That's already your email" : "";

  const request = async () => {
    setTouched(true); setMsg(null); setPwErr("");
    if (!EMAIL_RE.test(target) || (current && target === current.toLowerCase())) return;
    setBusy(true);
    try {
      const err = await confirmIdentity(hasPassword, password);
      if (err) { setPwErr(err); return; }
      const res = await accountApi.changeEmail(target);
      setStep("code");
      setMsg({ tone: "info", text: (res.data as any)?.message || `We've sent a 6-digit code to ${target}.` });
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't start the change.") });
    } finally { setBusy(false); }
  };

  const confirm = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6) { setMsg({ tone: "error", text: "Enter the 6-digit code we emailed you." }); return; }
    setBusy(true); setMsg(null);
    try {
      await accountApi.confirmEmailChange(c);
      // Changing the sign-in email ends the old Firebase session, so sign
      // straight back in with the new address to keep the member logged in.
      let resumed = false;
      if (hasPassword && password) {
        try {
          const cred = await signInWithEmailAndPassword(firebaseAuth, target, password);
          rememberSessionUid(cred.user.uid);
          resumed = true;
        } catch { /* fall through */ }
      }
      if (!resumed) {
        try { await firebaseAuth.currentUser?.reload(); await firebaseAuth.currentUser?.getIdToken(true); resumed = true; } catch {}
      }
      setPassword("");
      if (!resumed) {
        await signOutAndClear();
        window.location.assign(`/auth/login?email=${encodeURIComponent(target)}`);
        return;
      }
      onDone();
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't confirm the code.") });
    } finally { setBusy(false); }
  };

  if (step === "code") {
    return (
      <Panel onSubmit={confirm}>
        <p className="m4m-set-help" style={{ margin: 0 }}>
          Enter the code sent to <strong style={{ color: "rgba(255,255,255,0.85)" }}>{target}</strong> to finish.
        </p>
        <div style={{ maxWidth: 220 }}>
          <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus className="m4m-set-code" />
        </div>
        <InlineMsg msg={msg} />
        <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
          <Btn onClick={() => { setStep("form"); setCode(""); setMsg(null); }} disabled={busy}>Use a different email</Btn>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
            <Btn kind="primary" type="submit" loading={busy}>Confirm change</Btn>
          </div>
        </div>
      </Panel>
    );
  }

  return (
    <Panel onSubmit={request}>
      <Field label="New email address" type="email" inputMode="email" autoComplete="email" value={newEmail}
        onChange={(e) => setNewEmail(e.target.value)} onBlur={() => newEmail && setTouched(true)} error={emailErr} autoFocus
        hint="We'll send a code to this address to confirm it's yours." />
      <PasswordConfirm value={password} onChange={setPassword} error={pwErr} hasPassword={hasPassword} />
      <InlineMsg msg={msg} />
      <PanelActions busy={busy} onCancel={onCancel} submitLabel="Send code" />
    </Panel>
  );
}

function PhoneEditor({ hasPassword, onCancel, onDone }: { hasPassword: boolean; onCancel: () => void; onDone: () => void }) {
  const [step, setStep] = useState<"form" | "code">("form");
  const [cc, setCc] = useState("+44");
  const [num, setNum] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pwErr, setPwErr] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const verificationId = useRef<string | null>(null);
  const recaptchaHost = useRef<HTMLDivElement | null>(null);
  const verifier = useRef<RecaptchaVerifier | null>(null);
  const ccId = useId();

  useEffect(() => () => { try { verifier.current?.clear(); } catch {} }, []);

  const digits = num.replace(/\D/g, "").replace(/^0+/, "");
  const e164 = `${cc}${digits}`;
  const numErr = touched && (digits.length < 6 || digits.length > 13) ? "Enter a valid mobile number" : "";

  const freshVerifier = () => {
    try { verifier.current?.clear(); } catch {}
    const el = document.createElement("div");
    if (recaptchaHost.current) { recaptchaHost.current.innerHTML = ""; recaptchaHost.current.appendChild(el); }
    verifier.current = new RecaptchaVerifier(firebaseAuth, el, { size: "invisible" });
    return verifier.current;
  };

  const sendCode = async () => {
    const user = firebaseAuth.currentUser;
    if (!user) throw Object.assign(new Error("Please sign in again."), { code: "auth/requires-recent-login" });
    const provider = new PhoneAuthProvider(firebaseAuth);
    verificationId.current = await provider.verifyPhoneNumber(e164, freshVerifier());
  };

  const request = async () => {
    setTouched(true); setMsg(null); setPwErr("");
    if (digits.length < 6 || digits.length > 13) return;
    setBusy(true);
    try {
      const err = await confirmIdentity(hasPassword, password);
      if (err) { setPwErr(err); return; }
      await accountApi.requestPhoneChange(e164);
      await sendCode();
      setStep("code");
      setMsg({ tone: "info", text: `We've texted a 6-digit code to ${cc} ${num.trim()}.` });
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't send the code.") });
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setMsg(null);
    try { await sendCode(); setMsg({ tone: "info", text: "A new code is on its way." }); }
    catch (e) { setMsg({ tone: "error", text: friendlyError(e, "We couldn't resend the code.") }); }
    finally { setBusy(false); }
  };

  const confirm = async () => {
    const c = code.replace(/\D/g, "");
    if (c.length !== 6 || !verificationId.current) { setMsg({ tone: "error", text: "Enter the 6-digit code from the SMS." }); return; }
    const user = firebaseAuth.currentUser;
    if (!user) return;
    setBusy(true); setMsg(null);
    try {
      await updatePhoneNumber(user, PhoneAuthProvider.credential(verificationId.current, c));
      await user.getIdToken(true);
      await accountApi.confirmPhoneChange();
      try { await user.reload(); } catch {}
      onDone();
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't update your number.") });
    } finally { setBusy(false); }
  };

  return (
    <Panel onSubmit={step === "form" ? request : confirm}>
      <div ref={recaptchaHost} aria-hidden style={{ position: "absolute", left: -9999 }} />
      {step === "form" ? (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label htmlFor={`${ccId}-num`} className="m4m-set-label">New mobile number</label>
            <div style={{ display: "flex", gap: 8 }}>
              <select aria-label="Country code" id={ccId} value={cc} onChange={(e) => setCc(e.target.value)} className="m4m-set-input" style={{ width: "auto", flexShrink: 0 }}>
                {COUNTRY_CODES.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
              <input
                id={`${ccId}-num`}
                type="tel" inputMode="tel" autoComplete="tel-national" placeholder="7700 900123"
                value={num} onChange={(e) => setNum(e.target.value.replace(/[^\d\s]/g, ""))}
                onBlur={() => num && setTouched(true)} autoFocus
                aria-invalid={!!numErr || undefined} aria-describedby={`${ccId}-msg`}
                className={"m4m-set-input" + (numErr ? " is-invalid" : "")} style={{ flex: 1, minWidth: 0 }}
              />
            </div>
            <p id={`${ccId}-msg`} className={"m4m-set-help" + (numErr ? " is-error" : "")}>
              {numErr || "We'll text a code to this number to confirm it's yours."}
            </p>
          </div>
          <PasswordConfirm value={password} onChange={setPassword} error={pwErr} hasPassword={hasPassword} />
          <InlineMsg msg={msg} />
          <PanelActions busy={busy} onCancel={onCancel} submitLabel="Send code" />
        </>
      ) : (
        <>
          <div style={{ maxWidth: 220 }}>
            <Field label="6-digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} autoFocus className="m4m-set-code" />
          </div>
          <InlineMsg msg={msg} />
          <div style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
            <Btn onClick={resend} disabled={busy}>Resend code</Btn>
            <div style={{ display: "flex", gap: 8 }}>
              <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
              <Btn kind="primary" type="submit" loading={busy}>Confirm number</Btn>
            </div>
          </div>
        </>
      )}
    </Panel>
  );
}

function PasswordEditor({ email, onCancel, onDone }: { email: string | null; onCancel: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [curErr, setCurErr] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const nextErr = touched && next.length < 8 ? "Use at least 8 characters" : touched && next === current && next ? "Choose a password you haven't just used" : "";
  const confErr = touched && confirm !== next ? "Passwords don't match" : "";

  const submit = async () => {
    setTouched(true); setMsg(null); setCurErr("");
    if (!current) { setCurErr("Enter your current password."); return; }
    if (next.length < 8 || next === current || confirm !== next) return;
    setBusy(true);
    try {
      const err = await confirmIdentity(true, current);
      if (err) { setCurErr(err); return; }
      const user = firebaseAuth.currentUser;
      if (!user) throw Object.assign(new Error(""), { code: "auth/requires-recent-login" });
      await updatePassword(user, next);
      try { await accountApi.passwordChanged(); } catch { /* notice email is best-effort */ }
      onDone();
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't change your password.") });
    } finally { setBusy(false); }
  };

  return (
    <Panel onSubmit={submit}>
      <input type="email" name="username" autoComplete="username" value={email || ""} readOnly hidden />
      <Field label="Current password" type="password" autoComplete="current-password" value={current}
        onChange={(e) => setCurrent(e.target.value)} error={curErr} autoFocus />
      <div className="m4m-set-grid2">
        <Field label="New password" type="password" autoComplete="new-password" value={next}
          onChange={(e) => setNext(e.target.value)} error={nextErr} hint={nextErr ? undefined : "At least 8 characters"} />
        <Field label="Confirm new password" type="password" autoComplete="new-password" value={confirm}
          onChange={(e) => setConfirm(e.target.value)} error={confErr} />
      </div>
      <InlineMsg msg={msg} />
      <div style={{ display: "flex", gap: 8, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <Link href={`/auth/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="m4m-set-link">
          Forgotten your current password?
        </Link>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn onClick={onCancel} disabled={busy}>Cancel</Btn>
          <Btn kind="primary" type="submit" loading={busy}>Update password</Btn>
        </div>
      </div>
    </Panel>
  );
}

function SessionsCard({ onDone }: { onDone: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  const run = async () => {
    setBusy(true); setMsg(null);
    try {
      await accountApi.signOutEverywhere();
      await signOutAndClear();
      onDone();
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't sign you out everywhere.") });
      setBusy(false);
    }
  };
  return (
    <Card title="Sessions">
      <Row
        icon={<MonitorSmartphone className="w-4 h-4" />}
        label="Sign out of all devices"
        desc="Lost a phone or signed in somewhere public? This ends every session, including this one."
        last
      >
        {!confirming ? (
          <Btn onClick={() => setConfirming(true)}>Sign out everywhere</Btn>
        ) : (
          <>
            <Btn onClick={() => setConfirming(false)} disabled={busy}>Cancel</Btn>
            <Btn kind="danger" onClick={run} loading={busy}>Yes, sign out</Btn>
          </>
        )}
      </Row>
      {msg && <div style={{ paddingBottom: 14 }}><InlineMsg msg={msg} /></div>}
    </Card>
  );
}

/* ── Notifications ─────────────────────────────────────────────────────── */

const NOTIF_ROWS: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
  { key: "email_interests", label: "Interests",           desc: "When someone sends you an interest, or accepts yours." },
  { key: "email_messages",  label: "Messages",            desc: "When you receive a new message while you're away." },
  { key: "email_matches",   label: "Match suggestions",   desc: "New profiles we think you'll want to see." },
  { key: "email_marketing", label: "News & offers",       desc: "Occasional updates about events and membership offers." },
];

function NotificationsSection() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loadErr, setLoadErr] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErr, setSaveErr] = useState("");
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const baseId = useId();

  const load = useCallback(async () => {
    setLoadErr("");
    try {
      const res = await accountApi.getSettings();
      setPrefs((res.data as any)?.data?.notifications ?? null);
    } catch (e) {
      setLoadErr(apiErrorMessage(e, "We couldn't load your preferences."));
    }
  }, []);
  useEffect(() => { void load(); return () => { if (savedTimer.current) clearTimeout(savedTimer.current); }; }, [load]);

  const toggle = async (key: keyof NotificationPrefs) => {
    if (!prefs) return;
    const prev = prefs;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next); // optimistic
    setStatus("saving"); setSaveErr("");
    try {
      const res = await accountApi.updateNotifications({ [key]: next[key] });
      const server = (res.data as any)?.data?.notifications;
      if (server) setPrefs(server);
      setStatus("saved");
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => setStatus("idle"), 2200);
    } catch (e) {
      setPrefs(prev);
      setStatus("error");
      setSaveErr(apiErrorMessage(e, "That change didn't save. Please try again."));
    }
  };

  const statusEl = (
    <span aria-live="polite" style={{ fontFamily: FONT, fontSize: 12, color: status === "error" ? "#ff8aa3" : "rgba(255,255,255,0.55)", display: "inline-flex", alignItems: "center", gap: 6, minHeight: 18 }}>
      {status === "saving" && <><Loader2 className="m4m-set-spin" style={{ width: 12, height: 12 }} aria-hidden /> Saving…</>}
      {status === "saved" && <><CheckCircle style={{ width: 12, height: 12, color: "#8DB870" }} aria-hidden /> Saved</>}
    </span>
  );

  return (
    <>
      <Card title="Email notifications" desc="Choose what we email you about. Changes save automatically." aside={statusEl}>
        {loadErr ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "12px 0 16px" }}>
            <InlineMsg msg={{ tone: "error", text: loadErr }} />
            <Btn onClick={load}>Try again</Btn>
          </div>
        ) : (
          NOTIF_ROWS.map((r, i) => (
            <Row key={r.key} label={r.label} labelId={`${baseId}-${r.key}`} desc={r.desc} descId={`${baseId}-${r.key}-d`} last={i === NOTIF_ROWS.length - 1}>
              {prefs ? (
                <Switch on={prefs[r.key]} onToggle={() => toggle(r.key)} labelledBy={`${baseId}-${r.key}`} describedBy={`${baseId}-${r.key}-d`} />
              ) : (
                <span className="m4m-set-skel" style={{ width: 40, height: 22, borderRadius: 999 }} aria-hidden />
              )}
            </Row>
          ))
        )}
        {status === "error" && saveErr && <div style={{ paddingBottom: 14 }}><InlineMsg msg={{ tone: "error", text: saveErr }} /></div>}
      </Card>
      <p style={{ fontFamily: FONT, fontSize: 12.5, color: "rgba(255,255,255,0.5)", margin: "0 4px", lineHeight: 1.55 }}>
        We&apos;ll always email you about your account&apos;s security — like password resets and sign-in changes —
        even if everything above is off. In-app alerts appear in your{" "}
        <Link href="/notifications" className="m4m-set-link">notifications</Link>.
      </p>
    </>
  );
}

/* ── Privacy & Safety ──────────────────────────────────────────────────── */

function PrivacySection({ goToData }: { goToData: () => void }) {
  return (
    <>
      <Card title="Who can see what" desc="How your profile appears to other members.">
        <Row
          icon={<Lock className="w-4 h-4" />}
          label="Contact details"
          desc="Your phone number and email are never shown on your profile. Members reach you through interests and messages on Match4Marriage."
        >
          <Badge ok>Always private</Badge>
        </Row>
        <Row
          icon={<ImageIcon className="w-4 h-4" />}
          label="Photo privacy"
          desc="Mark any photo as Premium so only Premium and Elite members can see it. Your main photo stays visible to all members."
        >
          <Link href="/profile/me" className="m4m-set-btn m4m-set-btn--ghost">Manage photos</Link>
        </Row>
        <Row
          icon={<Eye className="w-4 h-4" />}
          label="Profile visibility"
          desc="Your approved profile appears in Browse and Matches. To hide it, deactivate your account — sign in again any time to come back."
          last
        >
          <Btn onClick={goToData}>Hide profile</Btn>
        </Row>
      </Card>

      <div
        style={{
          borderRadius: 16, padding: 16, display: "flex", alignItems: "flex-start", gap: 12,
          background: "rgba(141,184,112,0.06)", border: "1px solid rgba(141,184,112,0.18)",
        }}
      >
        <Shield style={{ width: 20, height: 20, color: "#8DB870", flexShrink: 0, marginTop: 2 }} aria-hidden />
        <div>
          <p style={{ fontFamily: FONT, fontSize: 14, fontWeight: 600, color: "#8DB870", margin: "0 0 4px" }}>Your data is protected</p>
          <p style={{ fontFamily: FONT, fontSize: 12.5, color: "rgba(141,184,112,0.85)", margin: 0, lineHeight: 1.55 }}>
            We handle your information under UK GDPR. ID documents you upload for verification are seen only by our
            verification team, and all messages are end-to-end encrypted.
          </p>
        </div>
      </div>
    </>
  );
}

/* ── Data & Privacy ────────────────────────────────────────────────────── */

const DELETE_REASONS = [
  "I've found my match",
  "I'm taking a break",
  "I'm not finding suitable matches",
  "Privacy concerns",
  "Something else",
];

function DataSection({ hasPassword }: { hasPassword: boolean }) {
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<Msg>(null);
  const [dialog, setDialog] = useState<null | "deactivate" | "delete">(null);

  const exportData = async () => {
    setExporting(true); setExportMsg(null);
    try {
      const res = await accountApi.exportData();
      const data = (res.data as any)?.data;
      downloadJson(data, `match4marriage-my-data-${new Date().toISOString().slice(0, 10)}.json`);
      setExportMsg({ tone: "success", text: "Your data has downloaded as a JSON file." });
    } catch (e) {
      const err = e as any;
      setExportMsg({
        tone: "error",
        text: err?.status === 429 ? "You've requested several exports recently. Please try again in an hour."
          : friendlyError(e, "We couldn't prepare your data. Please try again."),
      });
    } finally { setExporting(false); }
  };

  return (
    <>
      <Card title="Your data" desc="See and take a copy of the personal data we hold about you.">
        <Row
          icon={<Download className="w-4 h-4" />}
          label="Download my data"
          desc="Your account, profile, interests, matches, message history (dates only — not message content), subscriptions and notifications, as a JSON file."
        >
          <Btn kind="primary" onClick={exportData} loading={exporting}>{exporting ? "Preparing…" : "Download"}</Btn>
        </Row>
        {exportMsg && <div style={{ padding: "12px 0" }}><InlineMsg msg={exportMsg} /></div>}
        <Row icon={<Shield className="w-4 h-4" />} label="Privacy Policy" desc="How we use and protect your data.">
          <Link href="/privacy" className="m4m-set-link">Read <ExternalLink style={{ width: 12, height: 12 }} aria-hidden /></Link>
        </Row>
        <Row icon={<FileText className="w-4 h-4" />} label="Terms of Service" desc="The terms of your membership." last>
          <Link href="/terms" className="m4m-set-link">Read <ExternalLink style={{ width: 12, height: 12 }} aria-hidden /></Link>
        </Row>
      </Card>

      <Card title="Leave Match4Marriage" tone="danger">
        <Row
          icon={<PauseCircle className="w-4 h-4" />}
          label="Deactivate account"
          desc="Hide your profile and pause your account. Nothing is deleted — sign in again any time to reactivate."
        >
          <Btn kind="danger-ghost" onClick={() => setDialog("deactivate")}>Deactivate</Btn>
        </Row>
        <Row
          icon={<Trash2 className="w-4 h-4" />}
          label="Delete account"
          desc="Remove your profile and close your account. You'll lose your matches, interests and messages."
          last
        >
          <Btn kind="danger" onClick={() => setDialog("delete")}>Delete account</Btn>
        </Row>
      </Card>

      <DeactivateDialog open={dialog === "deactivate"} onClose={() => setDialog(null)} hasPassword={hasPassword} />
      <DeleteDialog open={dialog === "delete"} onClose={() => setDialog(null)} hasPassword={hasPassword} onExport={exportData} exporting={exporting} />
    </>
  );
}

function DeactivateDialog({ open, onClose, hasPassword }: { open: boolean; onClose: () => void; hasPassword: boolean }) {
  const [password, setPassword] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setPassword(""); setPwErr(""); setMsg(null); } }, [open]);

  const submit = async () => {
    setPwErr(""); setMsg(null);
    setBusy(true);
    try {
      const err = await confirmIdentity(hasPassword, password);
      if (err) { setPwErr(err); return; }
      await accountApi.deactivate();
      await signOutAndClear();
      window.location.assign("/auth/login?deactivated=1");
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't deactivate your account.") });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Deactivate your account?" busy={busy}>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ul className="m4m-set-list">
          <li>Your profile is hidden from Browse and Matches straight away.</li>
          <li>You&apos;ll be signed out on every device.</li>
          <li>Everything is kept. Sign in again whenever you&apos;re ready and your account reactivates.</li>
        </ul>
        <PasswordConfirm value={password} onChange={setPassword} error={pwErr} hasPassword={hasPassword} autoFocus />
        <InlineMsg msg={msg} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Btn onClick={onClose} disabled={busy}>Keep my account active</Btn>
          <Btn kind="danger" type="submit" loading={busy} disabled={hasPassword && !password}>Deactivate</Btn>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteDialog({ open, onClose, hasPassword, onExport, exporting }: {
  open: boolean; onClose: () => void; hasPassword: boolean; onExport: () => void; exporting: boolean;
}) {
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  useEffect(() => { if (!open) { setReason(""); setTyped(""); setPassword(""); setPwErr(""); setMsg(null); } }, [open]);

  const confirmed = typed.trim() === "DELETE";
  const submit = async () => {
    setPwErr(""); setMsg(null);
    if (!confirmed) { setMsg({ tone: "error", text: "Type DELETE in capitals to confirm." }); return; }
    setBusy(true);
    try {
      const err = await confirmIdentity(hasPassword, password);
      if (err) { setPwErr(err); return; }
      await accountApi.deleteAccount(reason || undefined);
      await signOutAndClear();
      window.location.assign("/auth/login?deleted=1");
    } catch (e) {
      setMsg({ tone: "error", text: friendlyError(e, "We couldn't delete your account.") });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Delete your account?" busy={busy} danger>
      <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <ul className="m4m-set-list">
          <li>Your profile is removed and no one can find or contact you.</li>
          <li>Your matches, interests and conversations will be gone for you.</li>
          <li>If you just need a break, <strong>deactivating</strong> keeps everything for when you return.</li>
        </ul>
        <div>
          <Btn onClick={onExport} loading={exporting}><Download style={{ width: 13, height: 13 }} aria-hidden /> Download my data first</Btn>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label htmlFor={reasonId} className="m4m-set-label">Why are you leaving? <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
          <select id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} className="m4m-set-input">
            <option value="">Choose a reason</option>
            {DELETE_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <Field
          label="Type DELETE to confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          autoFocus
        />
        <PasswordConfirm value={password} onChange={setPassword} error={pwErr} hasPassword={hasPassword} />
        <InlineMsg msg={msg} />
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Btn onClick={onClose} disabled={busy}>Cancel</Btn>
          <Btn kind="danger" type="submit" loading={busy} disabled={!confirmed || (hasPassword && !password)}>
            <Trash2 style={{ width: 13, height: 13 }} aria-hidden /> Delete my account
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}

/* ── Styles ────────────────────────────────────────────────────────────── */

function SettingsStyles() {
  return (
    <style jsx global>{`
      .m4m-set-nav {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; border-radius: 12px; border: none; cursor: pointer;
        font-family: var(--font-poppins, sans-serif); font-size: 14px; font-weight: 500;
        text-align: left; white-space: nowrap; flex-shrink: 0;
        transition: background 0.15s, color 0.15s;
      }
      .m4m-set-nav:hover:not([aria-current="page"]) { background: rgba(255,255,255,0.05) !important; color: rgba(255,255,255,0.85) !important; }
      .m4m-set-nav:focus-visible, .m4m-set-btn:focus-visible, .m4m-set-link:focus-visible, .m4m-set-switch:focus-visible {
        outline: 2px solid #ff8aa3; outline-offset: 2px;
      }
      .m4m-set-row {
        display: flex; align-items: center; justify-content: space-between; gap: 16px;
        padding: 14px 0;
      }
      @media (max-width: 560px) {
        .m4m-set-row { flex-wrap: wrap; }
        .m4m-set-row > div:last-child { margin-left: 28px; }
      }
      .m4m-set-switch {
        position: relative; width: 40px; height: 22px; border-radius: 999px; border: none;
        cursor: pointer; flex-shrink: 0; padding: 0; transition: background 0.2s;
      }
      .m4m-set-switch > span {
        position: absolute; top: 2px; width: 18px; height: 18px; border-radius: 50%;
        background: white; box-shadow: 0 1px 4px rgba(0,0,0,0.2); transition: left 0.2s cubic-bezier(0.22,1,0.36,1);
      }
      .m4m-set-switch:disabled { opacity: 0.5; cursor: not-allowed; }
      .m4m-set-btn {
        display: inline-flex; align-items: center; justify-content: center; gap: 6px;
        padding: 8px 14px; border-radius: 10px; min-height: 36px;
        font-family: var(--font-poppins, sans-serif); font-size: 13px; font-weight: 600;
        cursor: pointer; text-decoration: none; white-space: nowrap;
        transition: background 0.15s, border-color 0.15s, transform 0.15s, opacity 0.15s;
      }
      .m4m-set-btn:active:not(:disabled) { transform: scale(0.98); }
      .m4m-set-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .m4m-set-btn[aria-busy="true"] { cursor: wait; opacity: 0.8; }
      .m4m-set-btn--ghost { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: rgba(255,255,255,0.85); }
      .m4m-set-btn--ghost:hover:not(:disabled) { background: rgba(255,255,255,0.09); border-color: rgba(255,255,255,0.2); }
      .m4m-set-btn--primary { background: linear-gradient(135deg, #dc1e3c, #a0153c); border: none; color: #fff; box-shadow: 0 6px 18px -6px rgba(220,30,60,0.6); }
      .m4m-set-btn--primary:hover:not(:disabled) { box-shadow: 0 10px 24px -6px rgba(220,30,60,0.7); }
      .m4m-set-btn--danger { background: #ef4444; border: none; color: #fff; }
      .m4m-set-btn--danger:hover:not(:disabled) { background: #dc2626; }
      .m4m-set-btn--danger-ghost { background: transparent; border: 1px solid rgba(239,68,68,0.3); color: #f87171; }
      .m4m-set-btn--danger-ghost:hover:not(:disabled) { background: rgba(239,68,68,0.08); }
      .m4m-set-link {
        display: inline-flex; align-items: center; gap: 4px; border-radius: 6px;
        font-family: var(--font-poppins, sans-serif); font-size: 13px; font-weight: 600;
        color: #ff8aa3; text-decoration: none;
      }
      .m4m-set-link:hover { text-decoration: underline; text-underline-offset: 3px; }
      .m4m-set-panel {
        display: flex; flex-direction: column; gap: 14px; position: relative;
        margin: 0 0 14px; padding: 16px; border-radius: 12px;
        background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
        animation: m4m-set-in 0.22s cubic-bezier(0.22,1,0.36,1);
      }
      @keyframes m4m-set-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
      .m4m-set-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      @media (max-width: 560px) { .m4m-set-grid2 { grid-template-columns: 1fr; } }
      .m4m-set-label {
        font-family: var(--font-poppins, sans-serif); font-size: 11px; font-weight: 600;
        color: rgba(255,255,255,0.6); letter-spacing: 0.06em; text-transform: uppercase;
      }
      .m4m-set-input {
        width: 100%; padding: 10px 12px; border-radius: 10px;
        background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12);
        font-family: var(--font-poppins, sans-serif); font-size: 16px; color: #f4eef0; outline: none;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .m4m-set-input::placeholder { color: rgba(255,255,255,0.35); }
      .m4m-set-input:focus { border-color: rgba(255,138,163,0.6); box-shadow: 0 0 0 3px rgba(220,30,60,0.18); }
      .m4m-set-input.is-invalid { border-color: rgba(255,138,163,0.7); }
      .m4m-set-input option { color: #1a0a14; }
      .m4m-set-code { font-family: ui-monospace, 'SF Mono', monospace; letter-spacing: 0.3em; }
      .m4m-set-help { margin: 0; font-family: var(--font-poppins, sans-serif); font-size: 12px; line-height: 1.5; color: rgba(255,255,255,0.55); }
      .m4m-set-help.is-error { color: #ff8aa3; }
      .m4m-set-list {
        margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px;
        font-family: var(--font-poppins, sans-serif); font-size: 13px; line-height: 1.55; color: rgba(255,255,255,0.75);
      }
      .m4m-set-skel {
        display: inline-block; height: 12px; border-radius: 6px; vertical-align: middle;
        background: linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06));
        background-size: 200% 100%; animation: m4m-set-shimmer 1.4s ease-in-out infinite;
      }
      @keyframes m4m-set-shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
      .m4m-set-spin { animation: m4m-set-spin 0.7s linear infinite; }
      @keyframes m4m-set-spin { to { transform: rotate(360deg); } }
      .m4m-set-dialog {
        width: min(480px, calc(100vw - 32px)); max-height: calc(100vh - 48px); overflow: auto;
        padding: 0; border-radius: 18px; border: 1px solid rgba(255,255,255,0.12);
        background: linear-gradient(165deg, #220c1a 0%, #170811 100%); color: #f4eef0;
        box-shadow: 0 30px 80px rgba(0,0,0,0.55);
      }
      .m4m-set-dialog[open] { animation: m4m-set-pop 0.2s cubic-bezier(0.22,1,0.36,1); }
      .m4m-set-dialog::backdrop { background: rgba(11,5,9,0.72); backdrop-filter: blur(3px); }
      @keyframes m4m-set-pop { from { opacity: 0; transform: translateY(8px) scale(0.98); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) {
        .m4m-set-panel, .m4m-set-dialog[open], .m4m-set-skel { animation: none; }
        .m4m-set-switch > span, .m4m-set-btn { transition: none; }
      }
    `}</style>
  );
}
