"use client";

/**
 * Shared shell + form primitives for the secondary auth pages
 * (/auth/forgot-password, /auth/reset-password). Mirrors the sign-in page's
 * visual language exactly — same ivory canvas, Playfair headline, Poppins
 * body, crimson gradient CTA — in a calmer single-column layout.
 */
import { useId, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, Heart, Loader2 } from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="m4m-auth">
      <header className="m4m-auth-top">
        <Link href="/" aria-label="Match4Marriage home" className="m4m-auth-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/logo.png" alt="Match4Marriage" style={{ height: 34, width: "auto", display: "block" }} />
        </Link>
      </header>

      <main className="m4m-auth-main">
        <motion.section
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="m4m-auth-card"
          aria-labelledby="auth-title"
        >
          <div className="m4m-auth-eyebrow">
            <Heart style={{ width: 10, height: 10, color: "#dc1e3c" }} fill="#dc1e3c" aria-hidden />
            <span>{eyebrow}</span>
          </div>
          <h1 id="auth-title" className="m4m-auth-title">{title}</h1>
          {subtitle && <p className="m4m-auth-sub">{subtitle}</p>}
          <div style={{ marginTop: 28 }}>{children}</div>
          {footer && <div className="m4m-auth-footer">{footer}</div>}
        </motion.section>
      </main>

      <AuthStyles />
    </div>
  );
}

export function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  const isError = tone === "error";
  return (
      <motion.div
        role={isError ? "alert" : "status"}
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        style={{
          display: "flex", alignItems: "flex-start", gap: 9,
          background: isError ? "rgba(220,30,60,0.06)" : "rgba(92,122,82,0.06)",
          color: isError ? "#a0153c" : "#3F5937",
          fontSize: 13, lineHeight: 1.5,
          padding: "12px 14px",
          borderRadius: 10,
          marginBottom: 16,
          border: `1px solid ${isError ? "rgba(220,30,60,0.14)" : "rgba(92,122,82,0.15)"}`,
        }}
      >
        {isError ? <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} aria-hidden />
                 : <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0, marginTop: 2 }} aria-hidden />}
        <span>{children}</span>
      </motion.div>
  );
}

export function TextField({
  label, error, hint, id: idProp, ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const auto = useId();
  const id = idProp || auto;
  const msgId = `${id}-msg`;
  return (
    <div>
      <label htmlFor={id} className="m4m-auth-label">{label}</label>
      <input
        id={id}
        {...input}
        aria-invalid={!!error || undefined}
        aria-describedby={error || hint ? msgId : undefined}
        className={"m4m-auth-input" + (error ? " is-invalid" : "")}
      />
      {(error || hint) && (
        <p id={msgId} className={"m4m-auth-help" + (error ? " is-error" : "")}>{error || hint}</p>
      )}
    </div>
  );
}

export function PasswordField({
  label, error, hint, value, onChange, autoComplete = "new-password", onEnter, autoFocus,
}: {
  label: string; error?: string; hint?: string; value: string;
  onChange: (v: string) => void; autoComplete?: string; onEnter?: () => void; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const msgId = `${id}-msg`;
  return (
    <div>
      <label htmlFor={id} className="m4m-auth-label">{label}</label>
      <div style={{ position: "relative" }}>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && onEnter) onEnter(); }}
          autoComplete={autoComplete}
          aria-invalid={!!error || undefined}
          aria-describedby={error || hint ? msgId : undefined}
          className={"m4m-auth-input" + (error ? " is-invalid" : "")}
          style={{ paddingRight: 46 }}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="m4m-auth-eye"
        >
          {show ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
        </button>
      </div>
      {(error || hint) && (
        <p id={msgId} className={"m4m-auth-help" + (error ? " is-error" : "")}>{error || hint}</p>
      )}
    </div>
  );
}

/** Four-segment strength bar. Score 0–4. */
export function passwordScore(pw: string): number {
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  return pw.length < 8 ? Math.min(s, 1) : s;
}

export function StrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const score = passwordScore(password);
  const label = ["Too short", "Weak", "Fair", "Good", "Strong"][score];
  const color = score <= 1 ? "#dc1e3c" : score === 2 ? "#c9954a" : "#5C7A52";
  return (
    <div style={{ marginTop: 8 }} aria-live="polite">
      <div style={{ display: "flex", gap: 4 }} aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < score ? color : "rgba(26,10,20,0.08)",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: 11.5, color: "#78686e" }}>
        Password strength: <strong style={{ color }}>{label}</strong>
      </p>
    </div>
  );
}

export function SubmitButton({
  loading, disabled, onClick, children, type = "button", withArrow = true,
}: {
  loading?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode;
  type?: "button" | "submit"; withArrow?: boolean;
}) {
  const off = !!loading || !!disabled;
  return (
    <button type={type} onClick={onClick} disabled={off} aria-busy={loading || undefined} className="m4m-auth-submit">
      {loading ? (
        <><Loader2 style={{ width: 15, height: 15 }} className="m4m-auth-spin" aria-hidden /> Please wait…</>
      ) : (
        <>{children}{withArrow && <ArrowRight style={{ width: 15, height: 15 }} aria-hidden />}</>
      )}
    </button>
  );
}

function AuthStyles() {
  return (
    <style jsx global>{`
      .m4m-auth {
        min-height: 100vh;
        background: #fdfbf9;
        font-family: var(--font-poppins, sans-serif);
        display: flex; flex-direction: column;
        position: relative; overflow: hidden;
      }
      .m4m-auth::before {
        content: ""; position: absolute; inset: auto -120px -180px auto;
        width: 520px; height: 520px; border-radius: 50%;
        background: radial-gradient(circle, rgba(220,30,60,0.07), transparent 70%);
        pointer-events: none;
      }
      .m4m-auth-top { padding: 28px 32px 0; position: relative; z-index: 1; }
      .m4m-auth-logo { display: inline-flex; border-radius: 10px; }
      .m4m-auth-logo:focus-visible { outline: 2px solid #dc1e3c; outline-offset: 4px; }
      .m4m-auth-main {
        flex: 1; display: flex; align-items: center; justify-content: center;
        padding: 40px 20px 64px; position: relative; z-index: 1;
      }
      .m4m-auth-card { width: 100%; max-width: 420px; }
      .m4m-auth-eyebrow {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 4px 11px 4px 8px; margin-bottom: 22px;
        background: rgba(220,30,60,0.055); border: 1px solid rgba(220,30,60,0.12);
        border-radius: 999px; font-size: 9.5px; font-weight: 700; color: #a0153c; letter-spacing: 0.14em;
      }
      .m4m-auth-title {
        font-family: var(--font-playfair, serif);
        font-size: 36px; font-weight: 500; color: #1a0a14;
        margin: 0; letter-spacing: -0.025em; line-height: 1.1; text-wrap: balance;
      }
      .m4m-auth-sub { font-size: 14.5px; color: #78686e; margin: 12px 0 0; line-height: 1.6; }
      .m4m-auth-label {
        display: block; margin-bottom: 7px;
        font-size: 10.5px; font-weight: 700; color: #555; letter-spacing: 0.12em;
      }
      .m4m-auth-input {
        width: 100%; padding: 14px; background: rgba(255,255,255,0.98);
        border: 1px solid rgba(26,10,20,0.1); border-radius: 12px;
        font-size: 14px; color: #1a0a14; outline: none; font-family: inherit;
        transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        box-shadow: 0 1px 3px rgba(0,0,0,0.03), inset 0 1px 2px rgba(0,0,0,0.02);
      }
      .m4m-auth-input::placeholder { color: #9a8b90; }
      .m4m-auth-input:focus { border-color: #dc1e3c; background: #fff; box-shadow: 0 0 0 4px rgba(220,30,60,0.07); }
      .m4m-auth-input.is-invalid { border-color: rgba(220,30,60,0.55); }
      .m4m-auth-input:disabled { background: rgba(26,10,20,0.03); color: #78686e; }
      .m4m-auth-help { margin: 7px 0 0; font-size: 12px; color: #78686e; line-height: 1.45; }
      .m4m-auth-help.is-error { color: #a0153c; }
      .m4m-auth-eye {
        position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
        background: none; border: none; cursor: pointer; color: #8a7a80;
        padding: 8px; display: grid; place-items: center; border-radius: 8px; transition: color 0.15s;
      }
      .m4m-auth-eye:hover { color: #1a0a14; }
      .m4m-auth-eye:focus-visible { outline: 2px solid #dc1e3c; outline-offset: 0; }
      .m4m-auth-submit {
        width: 100%; margin-top: 6px; padding: 15px 18px;
        background: linear-gradient(135deg, #dc1e3c 0%, #a0153c 100%);
        color: #fff; border: none; border-radius: 12px;
        font-size: 14px; font-weight: 600; font-family: inherit; letter-spacing: 0.015em;
        display: flex; align-items: center; justify-content: center; gap: 8px;
        cursor: pointer; box-shadow: 0 10px 28px rgba(220,30,60,0.32), inset 0 0 0 1px rgba(255,255,255,0.1);
        transition: transform 0.18s cubic-bezier(0.22,1,0.36,1), box-shadow 0.2s, opacity 0.2s;
      }
      .m4m-auth-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 32px rgba(220,30,60,0.38), inset 0 0 0 1px rgba(255,255,255,0.1); }
      .m4m-auth-submit:active:not(:disabled) { transform: scale(0.985); }
      .m4m-auth-submit:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
      .m4m-auth-submit[aria-busy="true"] { cursor: wait; }
      .m4m-auth-submit:focus-visible { outline: 2px solid #1a0a14; outline-offset: 3px; }
      .m4m-auth-link {
        color: #dc1e3c; font-weight: 600; text-decoration: none;
        display: inline-flex; align-items: center; gap: 6px; border-radius: 6px;
      }
      .m4m-auth-link:hover { text-decoration: underline; text-underline-offset: 3px; }
      .m4m-auth-link:focus-visible { outline: 2px solid #dc1e3c; outline-offset: 3px; }
      .m4m-auth-textbtn {
        background: none; border: none; padding: 0; font: inherit; cursor: pointer;
        color: #dc1e3c; font-weight: 600;
      }
      .m4m-auth-textbtn:disabled { color: #9a8b90; cursor: default; }
      .m4m-auth-textbtn:focus-visible { outline: 2px solid #dc1e3c; outline-offset: 3px; border-radius: 4px; }
      .m4m-auth-footer {
        margin-top: 32px; padding-top: 22px; border-top: 1px solid rgba(26,10,20,0.07);
        font-size: 13px; color: #78686e; text-align: center; line-height: 1.6;
      }
      .m4m-auth-spin { animation: m4m-auth-spin 0.7s linear infinite; }
      @keyframes m4m-auth-spin { to { transform: rotate(360deg); } }
      @media (max-width: 640px) {
        .m4m-auth-top { padding: 20px 16px 0; }
        .m4m-auth-main { padding: 28px 16px 48px; align-items: flex-start; }
        .m4m-auth-title { font-size: 30px; }
        .m4m-auth-input { font-size: 16px; }
      }
      @media (prefers-reduced-motion: reduce) {
        .m4m-auth-submit, .m4m-auth-input { transition: none; }
        .m4m-auth-spin { animation-duration: 1.6s; }
      }
    `}</style>
  );
}
