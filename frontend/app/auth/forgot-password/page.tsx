"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { ArrowLeft, MailCheck } from "lucide-react";
import { authActionSettings, firebaseAuth } from "@/lib/firebase";
import { accountApi, apiErrorMessage } from "@/lib/api";
import { AuthLayout, Banner, SubmitButton, TextField } from "../_components/AuthShell";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const RESEND_COOLDOWN_SEC = 60;

/**
 * Ask the backend to email a reset link (branded, sent via Resend, link lands
 * on /auth/reset-password). If the backend's mailer isn't configured it
 * answers 503 `reset_email_unavailable`, and we fall back to Firebase's own
 * mailer with a continue URL back to the app. Either way the copy never
 * reveals whether an account exists for the address.
 */
async function requestReset(email: string): Promise<void> {
  try {
    await accountApi.forgotPassword(email);
    return;
  } catch (e: any) {
    const backendUnavailable =
      (e?.status === 503 && e?.detail?.code === "reset_email_unavailable") || e?.status === 0 || e?.status === 404;
    if (!backendUnavailable) throw e;
  }
  try {
    await sendPasswordResetEmail(firebaseAuth, email, authActionSettings());
  } catch (fe: any) {
    const code: string = fe?.code || "";
    // Don't reveal account existence.
    if (code.includes("user-not-found")) return;
    // Continue URL rejected (domain not on Firebase's authorised list) — retry
    // without one so the member still gets a working link.
    if (code.includes("unauthorized-continue-uri") || code.includes("invalid-continue-uri")) {
      await sendPasswordResetEmail(firebaseAuth, email);
      return;
    }
    throw fe;
  }
}

function ForgotPasswordInner() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const pre = params.get("email");
    if (pre) setEmail(pre);
  }, [params]);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SEC);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1 && timer.current) { clearInterval(timer.current); timer.current = null; }
        return Math.max(0, c - 1);
      });
    }, 1000);
  };

  const trimmed = email.trim().toLowerCase();
  const emailError = touched && !EMAIL_RE.test(trimmed) ? "Enter the email address you signed up with." : "";

  const submit = async () => {
    setTouched(true);
    setError("");
    if (!EMAIL_RE.test(trimmed)) return;
    setLoading(true);
    try {
      await requestReset(trimmed);
      setSentTo(trimmed);
      startCooldown();
    } catch (e: any) {
      const code: string = e?.code || "";
      if (e?.status === 429 || code.includes("too-many-requests")) {
        setError("Too many requests. Please wait a few minutes and try again.");
      } else if (code.includes("invalid-email")) {
        setError("That email address doesn't look right.");
      } else {
        setError(apiErrorMessage(e, "We couldn't send the email just now. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <AuthLayout
        eyebrow="Check your inbox"
        title="We've sent you a link."
        subtitle={
          <>If an account exists for <strong style={{ color: "#1a0a14", fontWeight: 600 }}>{sentTo}</strong>, you&apos;ll
          receive an email with a link to choose a new password.</>
        }
        footer={
          <Link href={`/auth/login?email=${encodeURIComponent(sentTo)}`} className="m4m-auth-link">
            <ArrowLeft style={{ width: 13, height: 13 }} aria-hidden /> Back to sign in
          </Link>
        }
      >
        {error && <Banner tone="error">{error}</Banner>}
        <div style={{
          display: "flex", gap: 14, alignItems: "flex-start",
          padding: "16px 18px", borderRadius: 14,
          background: "rgba(92,122,82,0.06)", border: "1px solid rgba(92,122,82,0.15)",
        }}>
          <MailCheck style={{ width: 20, height: 20, color: "#5C7A52", flexShrink: 0, marginTop: 1 }} aria-hidden />
          <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13, color: "#3F5937", lineHeight: 1.6 }}>
            <li>The link works once and expires in 1 hour.</li>
            <li>Can&apos;t see it? Check your spam or promotions folder.</li>
          </ul>
        </div>
        <p style={{ fontSize: 13, color: "#78686e", margin: "20px 0 0", lineHeight: 1.6 }} aria-live="polite">
          Didn&apos;t get it?{" "}
          <button type="button" className="m4m-auth-textbtn" disabled={cooldown > 0 || loading} onClick={submit}>
            {loading ? "Sending…" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend the email"}
          </button>
          {" "}or{" "}
          <button type="button" className="m4m-auth-textbtn" onClick={() => { setSentTo(null); setError(""); }}>
            use a different email
          </button>.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Password help"
      title="Forgot your password?"
      subtitle="Enter the email you use for Match4Marriage and we'll send you a secure link to choose a new one."
      footer={
        <>Remembered it?{" "}
          <Link href="/auth/login" className="m4m-auth-link">Back to sign in</Link>
        </>
      }
    >
      {error && <Banner tone="error">{error}</Banner>}
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email && setTouched(true)}
          error={emailError}
        />
        <SubmitButton type="submit" loading={loading}>Send reset link</SubmitButton>
      </form>
      <p style={{ fontSize: 12, color: "#78686e", margin: "18px 0 0", lineHeight: 1.6 }}>
        You can also sign in with the mobile number on your account from the{" "}
        <Link href="/auth/login" className="m4m-auth-link">sign-in page</Link>.
      </p>
    </AuthLayout>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordInner />
    </Suspense>
  );
}
