"use client";

/**
 * Firebase email-action handler for Match4Marriage.
 *
 * Reset links emailed by the backend (/auth/forgot-password) land here with
 * `?mode=resetPassword&oobCode=…`. Set this page as the custom action URL in
 * Firebase Console → Authentication → Templates → (pencil) → "Customise action
 * URL" = https://<your-domain>/auth/reset-password, and Firebase's own emails
 * (reset, verify email, email-change recovery) land here too.
 */
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  signInWithEmailAndPassword,
  verifyPasswordResetCode,
} from "firebase/auth";
import { ArrowLeft, CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
import { authErrorMessage, firebaseAuth, rememberSessionUid } from "@/lib/firebase";
import {
  AuthLayout, Banner, PasswordField, StrengthMeter, SubmitButton, passwordScore,
} from "../_components/AuthShell";

type Phase =
  | { kind: "checking" }
  | { kind: "form"; email: string }
  | { kind: "done"; email: string; signingIn: boolean }
  | { kind: "applied"; title: string; body: string }
  | { kind: "invalid"; reason: string };

const MIN_LEN = 8;

function ResetPasswordInner() {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode") || "resetPassword";
  const oobCode = params.get("oobCode") || "";

  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!oobCode) {
        setPhase({ kind: "invalid", reason: "This link is incomplete. Please request a new one." });
        return;
      }
      try {
        if (mode === "resetPassword") {
          const email = await verifyPasswordResetCode(firebaseAuth, oobCode);
          if (!cancelled) setPhase({ kind: "form", email });
        } else if (mode === "verifyEmail") {
          await applyActionCode(firebaseAuth, oobCode);
          try { await firebaseAuth.currentUser?.reload(); } catch {}
          if (!cancelled) setPhase({ kind: "applied", title: "Email verified.", body: "Thank you — your email address is confirmed." });
        } else if (mode === "verifyAndChangeEmail") {
          const info = await checkActionCode(firebaseAuth, oobCode);
          await applyActionCode(firebaseAuth, oobCode);
          if (!cancelled) setPhase({
            kind: "applied",
            title: "Email address updated.",
            body: `You can now sign in with ${info.data.email ?? "your new email address"}.`,
          });
        } else if (mode === "recoverEmail") {
          const info = await checkActionCode(firebaseAuth, oobCode);
          await applyActionCode(firebaseAuth, oobCode);
          if (!cancelled) setPhase({
            kind: "applied",
            title: "Email address restored.",
            body: `Your sign-in email is back to ${info.data.email ?? "your previous address"}. If you didn't request the change, reset your password now to secure your account.`,
          });
        } else {
          setPhase({ kind: "invalid", reason: "We don't recognise this link. Please request a new one." });
        }
      } catch (e: any) {
        if (cancelled) return;
        const code: string = e?.code || "";
        setPhase({
          kind: "invalid",
          reason: code.includes("expired")
            ? "This link has expired. Reset links last 1 hour — request a fresh one below."
            : code.includes("invalid-action-code")
              ? "This link has already been used or isn't valid any more. Request a fresh one below."
              : authErrorMessage(e, "We couldn't open this link. Please request a new one."),
        });
      }
    })();
    return () => { cancelled = true; };
  }, [mode, oobCode]);

  const lenError = touched && pw.length < MIN_LEN ? `Use at least ${MIN_LEN} characters.` : "";
  const matchError = touched && pw2.length > 0 && pw !== pw2 ? "The passwords don't match." : "";
  const canSubmit = pw.length >= MIN_LEN && pw === pw2 && passwordScore(pw) >= 1;

  const submit = async () => {
    if (phase.kind !== "form") return;
    setTouched(true);
    setError("");
    if (!canSubmit) {
      if (pw2.length === 0 && pw.length >= MIN_LEN) setError("Please re-enter your new password to confirm it.");
      return;
    }
    setLoading(true);
    try {
      await confirmPasswordReset(firebaseAuth, oobCode, pw);
      setPhase({ kind: "done", email: phase.email, signingIn: true });
      // Sign them straight in — the sign-in page then routes to the right place.
      try {
        const cred = await signInWithEmailAndPassword(firebaseAuth, phase.email, pw);
        rememberSessionUid(cred.user.uid);
        router.replace("/auth/login");
      } catch {
        setPhase({ kind: "done", email: phase.email, signingIn: false });
      }
    } catch (e: any) {
      const code: string = e?.code || "";
      if (code.includes("expired") || code.includes("invalid-action-code")) {
        setPhase({ kind: "invalid", reason: "This link expired while you were choosing a password. Request a fresh one below." });
      } else {
        setError(authErrorMessage(e, "We couldn't update your password. Please try again."));
      }
    } finally {
      setLoading(false);
    }
  };

  const backToSignIn = (
    <Link href="/auth/login" className="m4m-auth-link">
      <ArrowLeft style={{ width: 13, height: 13 }} aria-hidden /> Back to sign in
    </Link>
  );

  if (phase.kind === "checking") {
    return (
      <AuthLayout eyebrow="Password help" title="Checking your link…">
        <p role="status" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#78686e", margin: 0 }}>
          <Loader2 style={{ width: 16, height: 16 }} className="m4m-auth-spin" aria-hidden />
          One moment while we verify this link.
        </p>
      </AuthLayout>
    );
  }

  if (phase.kind === "invalid") {
    return (
      <AuthLayout eyebrow="Password help" title="This link can't be used." footer={backToSignIn}>
        <div role="alert" style={{
          display: "flex", gap: 12, alignItems: "flex-start", padding: "16px 18px", borderRadius: 14,
          background: "rgba(220,30,60,0.05)", border: "1px solid rgba(220,30,60,0.14)",
          fontSize: 13.5, color: "#a0153c", lineHeight: 1.55, marginBottom: 20,
        }}>
          <ShieldAlert style={{ width: 18, height: 18, flexShrink: 0, marginTop: 1 }} aria-hidden />
          <span>{phase.reason}</span>
        </div>
        <Link href="/auth/forgot-password" className="m4m-auth-submit" style={{ textDecoration: "none" }}>
          Send a new reset link
        </Link>
      </AuthLayout>
    );
  }

  if (phase.kind === "applied") {
    return (
      <AuthLayout eyebrow="All set" title={phase.title} subtitle={phase.body} footer={backToSignIn}>
        <Link href="/auth/login" className="m4m-auth-submit" style={{ textDecoration: "none" }}>
          Continue to sign in
        </Link>
      </AuthLayout>
    );
  }

  if (phase.kind === "done") {
    return (
      <AuthLayout
        eyebrow="Password updated"
        title="You're all set."
        subtitle={phase.signingIn
          ? "Your new password is saved. Signing you in…"
          : "Your new password is saved. Sign in with it to continue."}
      >
        <div role="status" style={{
          display: "flex", gap: 12, alignItems: "center", padding: "14px 16px", borderRadius: 12,
          background: "rgba(92,122,82,0.06)", border: "1px solid rgba(92,122,82,0.15)",
          fontSize: 13, color: "#3F5937", marginBottom: 18,
        }}>
          {phase.signingIn
            ? <Loader2 style={{ width: 16, height: 16 }} className="m4m-auth-spin" aria-hidden />
            : <CheckCircle2 style={{ width: 16, height: 16 }} aria-hidden />}
          <span>Password changed for <strong>{phase.email}</strong></span>
        </div>
        {!phase.signingIn && (
          <Link href={`/auth/login?email=${encodeURIComponent(phase.email)}`} className="m4m-auth-submit" style={{ textDecoration: "none" }}>
            Sign in
          </Link>
        )}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      eyebrow="Password help"
      title="Choose a new password."
      subtitle={<>For <strong style={{ color: "#1a0a14", fontWeight: 600 }}>{phase.email}</strong>. Use at least {MIN_LEN} characters — a short phrase is easier to remember and harder to guess.</>}
      footer={backToSignIn}
    >
      {error && <Banner tone="error">{error}</Banner>}
      <form
        noValidate
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        style={{ display: "flex", flexDirection: "column", gap: 16 }}
      >
        {/* Hidden username field so password managers save against the right account. */}
        <input type="email" name="username" autoComplete="username" value={phase.email} readOnly hidden />
        <div>
          <PasswordField
            label="New password"
            value={pw}
            onChange={setPw}
            autoFocus
            error={lenError}
          />
          <StrengthMeter password={pw} />
        </div>
        <PasswordField
          label="Confirm new password"
          value={pw2}
          onChange={(v) => { setPw2(v); if (v.length >= pw.length) setTouched(true); }}
          onEnter={submit}
          error={matchError}
        />
        <SubmitButton type="submit" loading={loading} disabled={!canSubmit && touched}>
          Save new password
        </SubmitButton>
      </form>
    </AuthLayout>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
