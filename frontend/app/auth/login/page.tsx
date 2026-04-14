"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { profileApi } from "@/lib/api";

type Mode = "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("email");

  // Email state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Phone state
  const [countryCode, setCountryCode] = useState("+44");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  // Shared UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  // If already signed in, go to dashboard
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      if (user) router.replace("/dashboard");
    });
    return unsub;
  }, [router]);

  const clearMsgs = () => {
    setError("");
    setInfo("");
  };

  // ---- Email flow ----
  const handleEmailLogin = async () => {
    clearMsgs();
    if (!email.includes("@")) return setError("Please enter a valid email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await routeAfterAuth();
    } catch (e: any) {
      const code = e?.code || "";
      if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password")) {
        setError("Email or password is incorrect.");
      } else if (code.includes("too-many-requests")) {
        setError("Too many attempts. Please try again later.");
      } else {
        setError(e?.message || "Login failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    clearMsgs();
    if (!email.includes("@")) return setError("Enter your email first, then click reset.");
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setInfo("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      setError(e?.message || "Could not send reset email.");
    }
  };

  // ---- Phone flow ----
  const getRecaptcha = () => {
    if (recaptchaRef.current) return recaptchaRef.current;
    const verifier = new RecaptchaVerifier(firebaseAuth, "recaptcha-login", { size: "invisible" });
    recaptchaRef.current = verifier;
    return verifier;
  };

  const handleSendOtp = async () => {
    clearMsgs();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 6) return setError("Enter a valid phone number.");
    setLoading(true);
    try {
      const full = `${countryCode}${digits}`;
      const result = await signInWithPhoneNumber(firebaseAuth, full, getRecaptcha());
      confirmationRef.current = result;
      setOtpSent(true);
      setInfo("OTP sent. Check your SMS.");
    } catch (e: any) {
      setError(e?.message || "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    clearMsgs();
    if (!confirmationRef.current) return setError("Session expired. Resend OTP.");
    if (otp.replace(/\D/g, "").length < 6) return setError("Enter the 6-digit code.");
    setLoading(true);
    try {
      await confirmationRef.current.confirm(otp.trim());
      await routeAfterAuth();
    } catch {
      setError("Incorrect code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ---- Routing: existing user → dashboard, new user → onboarding ----
  const routeAfterAuth = async () => {
    try {
      const res = await profileApi.me();
      const p = (res.data as any)?.data;
      if (p && p.first_name && p.first_name.trim().length > 0) {
        router.replace("/dashboard");
        return;
      }
    } catch {
      // no profile yet
    }
    router.replace("/onboarding");
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: 10,
    background: active ? "#7B2D3A" : "#f5f5f5",
    color: active ? "#fff" : "#333",
    border: "none",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ maxWidth: 420, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sign in</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>Welcome back to Match4Marriage.</p>

      <div style={{ display: "flex", marginBottom: 20, borderRadius: 6, overflow: "hidden" }}>
        <button style={tabBtn(mode === "email")} onClick={() => { setMode("email"); clearMsgs(); }}>Email</button>
        <button style={tabBtn(mode === "phone")} onClick={() => { setMode("phone"); clearMsgs(); }}>Phone</button>
      </div>

      {mode === "email" && (
        <>
          <label style={{ display: "block", marginBottom: 12 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Email</div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 4 }}>Password</div>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                placeholder="Your password"
                style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                style={{ position: "absolute", right: 8, top: 8, background: "none", border: "none", cursor: "pointer", color: "#666" }}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {error && <div style={{ color: "#c00", marginBottom: 12 }}>{error}</div>}
          {info && <div style={{ color: "#060", marginBottom: 12 }}>{info}</div>}

          <button
            onClick={handleEmailLogin}
            disabled={loading}
            style={{ width: "100%", padding: 12, background: "#7B2D3A", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 16 }}
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <div style={{ marginTop: 16, fontSize: 14 }}>
            <button type="button" onClick={handleReset} style={{ background: "none", border: "none", color: "#7B2D3A", cursor: "pointer", padding: 0 }}>
              Forgot password?
            </button>
          </div>
        </>
      )}

      {mode === "phone" && (
        <>
          {!otpSent && (
            <>
              <label style={{ display: "block", marginBottom: 12 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>Phone number</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    style={{ padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                  >
                    <option value="+44">UK +44</option>
                    <option value="+91">IN +91</option>
                    <option value="+1">US +1</option>
                    <option value="+971">AE +971</option>
                    <option value="+61">AU +61</option>
                    <option value="+65">SG +65</option>
                  </select>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="7700 900123"
                    style={{ flex: 1, padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
                  />
                </div>
              </label>

              {error && <div style={{ color: "#c00", marginBottom: 12 }}>{error}</div>}
              {info && <div style={{ color: "#060", marginBottom: 12 }}>{info}</div>}

              <button
                onClick={handleSendOtp}
                disabled={loading}
                style={{ width: "100%", padding: 12, background: "#7B2D3A", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 16 }}
              >
                {loading ? "Sending..." : "Send OTP"}
              </button>
            </>
          )}

          {otpSent && (
            <>
              <label style={{ display: "block", marginBottom: 16 }}>
                <div style={{ fontSize: 13, marginBottom: 4 }}>Enter 6-digit code</div>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                  placeholder="123456"
                  maxLength={6}
                  style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6, fontSize: 18, letterSpacing: 4 }}
                />
              </label>

              {error && <div style={{ color: "#c00", marginBottom: 12 }}>{error}</div>}
              {info && <div style={{ color: "#060", marginBottom: 12 }}>{info}</div>}

              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                style={{ width: "100%", padding: 12, background: "#7B2D3A", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 16 }}
              >
                {loading ? "Verifying..." : "Verify & continue"}
              </button>

              <button
                type="button"
                onClick={() => { setOtpSent(false); setOtp(""); clearMsgs(); }}
                style={{ width: "100%", marginTop: 10, padding: 10, background: "none", color: "#666", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}
              >
                Change number
              </button>
            </>
          )}

          <div id="recaptcha-login" />
        </>
      )}

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee", textAlign: "center", fontSize: 14 }}>
        New here? <Link href="/onboarding" style={{ color: "#7B2D3A" }}>Create an account</Link>
      </div>
    </div>
  );
}
