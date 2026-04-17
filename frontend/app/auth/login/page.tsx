"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { firebaseAuth, rememberSessionUid } from "@/lib/firebase";
import { profileApi } from "@/lib/api";
import {
  Heart, Phone, Mail, Eye, EyeOff, ArrowRight, AlertCircle,
  CheckCircle2, Sparkles, Loader2,
} from "lucide-react";

type Mode = "email" | "phone";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("email");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [countryCode, setCountryCode] = useState("+44");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Welcome home";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Welcome home";
  }, []);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      if (user) {
        rememberSessionUid(user.uid);
        router.replace("/dashboard");
      }
    });
    return unsub;
  }, [router]);

  const clearMsgs = () => { setError(""); setInfo(""); };

  const routeAfterAuth = async () => {
    try {
      const res = await profileApi.me();
      const p = (res.data as any)?.data;
      if (p?.first_name?.trim()) { router.replace("/dashboard"); return; }
    } catch { /* new user */ }
    router.replace("/onboarding");
  };

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
      if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password")) setError("Email or password is incorrect.");
      else if (code.includes("too-many-requests")) setError("Too many attempts. Please try again later.");
      else setError(e?.message || "Login failed.");
    } finally { setLoading(false); }
  };

  const handleReset = async () => {
    clearMsgs();
    if (!email.includes("@")) return setError("Enter your email first, then click reset.");
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setInfo("Password reset email sent. Check your inbox.");
    } catch (e: any) { setError(e?.message || "Could not send reset email."); }
  };

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
      setInfo("Code sent. Check your SMS.");
    } catch (e: any) { setError(e?.message || "Could not send OTP."); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    clearMsgs();
    if (!confirmationRef.current) return setError("Session expired. Resend the code.");
    if (otp.replace(/\D/g, "").length < 6) return setError("Enter the 6-digit code.");
    setLoading(true);
    try {
      await confirmationRef.current.confirm(otp.trim());
      await routeAfterAuth();
    } catch { setError("Incorrect code. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div className="m4m-userlogin-root" style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.05fr) minmax(420px, 500px)",
      background: "#0c050a",
      position: "relative",
      overflow: "hidden",
      color: "#fff",
      fontFamily: "var(--font-poppins, sans-serif)",
    }}>
      <div id="recaptcha-login" />

      {/* ═══ LEFT: STORY HERO ═══════════════════════════════════════════ */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="m4m-userlogin-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #2a0c18 0%, #4a1528 30%, #7a2a40 60%, #4a1528 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "48px 60px",
          isolation: "isolate",
        }}
      >
        {/* Aurora */}
        <span className="u-aurora u-aurora-rose" />
        <span className="u-aurora u-aurora-gold" />
        <span className="u-aurora u-aurora-plum" />

        {/* Grain + dots */}
        <span className="u-grain" />
        <span className="u-dots" />

        {/* Mandala */}
        <Mandala />

        {/* Floating hearts + sparkles */}
        <FloatingDecor />

        {/* Vignette */}
        <span className="u-vignette" />

        {/* Brand header */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            position: "relative", zIndex: 5,
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: "linear-gradient(135deg, #ff4d79, #a0153c)",
              display: "grid", placeItems: "center",
              boxShadow: "0 8px 24px rgba(220,30,60,0.48), inset 0 0 0 1px rgba(255,255,255,0.12)",
            }}>
              <Heart style={{ width: 20, height: 20, color: "#fff" }} fill="#fff" />
            </div>
            <span style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 22, fontWeight: 700, color: "#fff",
              letterSpacing: "-0.01em",
            }}>
              Match<span style={{ color: "#ffb9c8" }}>4</span>Marriage
            </span>
          </Link>
        </motion.header>

        {/* Centre: testimonial + stats */}
        <div style={{
          flex: 1, position: "relative", zIndex: 5,
          display: "flex", flexDirection: "column", justifyContent: "center",
          maxWidth: 560,
          paddingTop: 40,
        }}>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 14px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 999,
              marginBottom: 22, alignSelf: "flex-start",
              backdropFilter: "blur(10px)",
            }}
          >
            <Sparkles style={{ width: 12, height: 12, color: "#ffc8a8" }} />
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.82)",
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              A place for forever
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: "clamp(42px, 5vw, 68px)",
              fontWeight: 500,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: "-0.028em",
              color: "#ffffff",
            }}
          >
            Every great story<br />
            begins with a{" "}
            <span style={{ position: "relative", whiteSpace: "nowrap" }}>
              <em style={{
                fontStyle: "italic", fontWeight: 400,
                color: "#ffb9c8", position: "relative", zIndex: 1,
              }}>hello</em>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.0, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute", left: 0, right: 0, bottom: -4,
                  height: 4, borderRadius: 2,
                  background: "linear-gradient(90deg, transparent, #ff98ae 30%, #ffc8a8 70%, transparent)",
                  transformOrigin: "left center",
                  boxShadow: "0 0 20px rgba(255,152,174,0.5)",
                }}
              />
            </span>
            .
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.55 }}
            style={{
              fontSize: 16,
              lineHeight: 1.65,
              color: "rgba(255,255,255,0.68)",
              marginTop: 22, maxWidth: 480,
              fontWeight: 400,
            }}
          >
            Verified profiles, real families, and the warmth of a community that believes in forever.
            Sign in to pick up where you left off.
          </motion.p>

          {/* Testimonial card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            whileHover={{ y: -2 }}
            style={{
              marginTop: 36,
              padding: "20px 22px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              backdropFilter: "saturate(140%) blur(14px)",
              maxWidth: 480,
              position: "relative",
              boxShadow: "0 14px 40px rgba(0,0,0,0.25)",
            }}
          >
            {/* Open-quote mark */}
            <span style={{
              position: "absolute", top: 10, left: 18,
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 68, lineHeight: 0.8,
              color: "rgba(255,152,174,0.35)",
              pointerEvents: "none",
            }}>“</span>
            <p style={{
              fontSize: 15, lineHeight: 1.55,
              color: "rgba(255,255,255,0.85)",
              margin: "0 0 14px",
              fontStyle: "italic",
              paddingLeft: 26,
            }}>
              We met here in 2024 and got married the next spring. Match4Marriage made us
              feel safe from the very first message.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: 26 }}>
              <div style={{
                width: 34, height: 34, borderRadius: "50%",
                background: "linear-gradient(135deg, #ff7a9a, #a0153c)",
                display: "grid", placeItems: "center",
                color: "#fff", fontSize: 13, fontWeight: 700,
                border: "2px solid rgba(255,255,255,0.2)",
                flexShrink: 0,
              }}>P</div>
              <div style={{ fontSize: 12.5 }}>
                <div style={{ color: "#fff", fontWeight: 600 }}>Priya &amp; Arjun</div>
                <div style={{ color: "rgba(255,255,255,0.5)" }}>Married · London · 2025</div>
              </div>
            </div>
          </motion.div>

          {/* Mini stats row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9, duration: 0.5 }}
            style={{ display: "flex", gap: 28, marginTop: 28, flexWrap: "wrap" }}
          >
            {[
              { n: "50K+",   label: "Verified members" },
              { n: "1,200+", label: "Happy couples" },
              { n: "4.9★",   label: "Average rating" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{
                  fontFamily: "var(--font-playfair, serif)",
                  fontSize: 26, fontWeight: 600, color: "#fff",
                  letterSpacing: "-0.01em",
                }}>{s.n}</div>
                <div style={{
                  fontSize: 11, fontWeight: 500,
                  color: "rgba(255,255,255,0.5)",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                  marginTop: 2,
                }}>{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          style={{
            position: "relative", zIndex: 5,
            fontSize: 11, color: "rgba(255,255,255,0.35)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            flexWrap: "wrap", gap: 10,
            paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span style={{ letterSpacing: "0.04em" }}>© {new Date().getFullYear()} Match4Marriage</span>
          <span style={{ display: "flex", gap: 16, alignItems: "center" }}>
            <Link href="/privacy" style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms"   style={{ color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>Terms</Link>
            <span style={{ color: "rgba(255,255,255,0.4)" }}>🇬🇧 UK</span>
          </span>
        </motion.div>
      </motion.aside>

      {/* ═══ RIGHT: FORM ═══════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "48px 44px", background: "#fdfbf9",
          position: "relative",
        }}
      >
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 25%, rgba(220,30,60,0.04), transparent 65%)",
          pointerEvents: "none",
        }} />

        <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{ marginBottom: 32 }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "4px 10px 4px 8px",
              background: "rgba(220,30,60,0.06)",
              border: "1px solid rgba(220,30,60,0.14)",
              borderRadius: 999,
              marginBottom: 18,
            }}>
              <Heart style={{ width: 11, height: 11, color: "#dc1e3c" }} fill="#dc1e3c" />
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#a0153c",
                letterSpacing: "0.12em", textTransform: "uppercase",
              }}>
                Sign in
              </span>
            </div>
            <h2 style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 34, fontWeight: 500, color: "#1a0a14",
              margin: 0, letterSpacing: "-0.02em", lineHeight: 1.1,
            }}>
              {greeting}.
            </h2>
            <p style={{ fontSize: 14, color: "#777", margin: "8px 0 0", lineHeight: 1.5 }}>
              Sign in to continue your journey to forever.
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              display: "flex", gap: 2,
              padding: 3,
              background: "rgba(220,30,60,0.04)",
              border: "1px solid rgba(220,30,60,0.1)",
              borderRadius: 12,
              marginBottom: 22,
            }}
          >
            {([
              { k: "email", label: "Email", icon: Mail },
              { k: "phone", label: "Phone", icon: Phone },
            ] as const).map(({ k, label, icon: Icon }) => {
              const active = mode === k;
              return (
                <button
                  key={k}
                  onClick={() => { setMode(k); clearMsgs(); setOtpSent(false); setOtp(""); }}
                  style={{
                    position: "relative", flex: 1,
                    padding: "10px 14px", border: "none", background: "transparent",
                    fontSize: 13, fontWeight: active ? 600 : 500,
                    color: active ? "#fff" : "#666",
                    cursor: "pointer", fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    zIndex: 1,
                  }}
                >
                  {active && (
                    <motion.span
                      layoutId="auth-tab-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 28 }}
                      style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                        borderRadius: 9,
                        boxShadow: "0 4px 12px rgba(220,30,60,0.3), inset 0 0 0 1px rgba(255,255,255,0.08)",
                        zIndex: -1,
                      }}
                    />
                  )}
                  <Icon style={{ width: 13, height: 13 }} />
                  {label}
                </button>
              );
            })}
          </motion.div>

          {/* Messages */}
          <AnimatePresence mode="wait">
            {error && (
              <MessageBanner key="err" tone="error">{error}</MessageBanner>
            )}
            {!error && info && (
              <MessageBanner key="info" tone="info">{info}</MessageBanner>
            )}
          </AnimatePresence>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {mode === "email" ? (
              <motion.div
                key="email-form"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.25 }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <Field icon={Mail} label="Email">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && handleEmailLogin()}
                    placeholder="you@example.com"
                    autoComplete="username"
                    required
                    style={inputStyle}
                  />
                </Field>

                <Field icon={null} label="Password" right={
                  <button
                    type="button"
                    onClick={handleReset}
                    style={{ background: "none", border: "none", padding: 0, cursor: "pointer",
                      fontSize: 11, fontWeight: 600, color: "#dc1e3c", fontFamily: "inherit" }}
                  >
                    Forgot?
                  </button>
                }>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !loading && handleEmailLogin()}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                    style={{ ...inputStyle, paddingLeft: 14, paddingRight: 42 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    style={eyeBtnStyle}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#1a0a14")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#aaa")}
                  >
                    {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
                  </button>
                </Field>

                <SubmitButton loading={loading} onClick={handleEmailLogin}>
                  Sign in
                </SubmitButton>
              </motion.div>
            ) : !otpSent ? (
              <motion.div
                key="phone-form"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.25 }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <Field icon={Phone} label="Mobile number">
                  <div style={{
                    display: "flex", gap: 8,
                    padding: 4,
                    background: "rgba(255,255,255,0.95)",
                    border: "1px solid rgba(26,10,20,0.1)",
                    borderRadius: 12,
                    paddingLeft: 36,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.03), inset 0 1px 2px rgba(0,0,0,0.02)",
                  }}>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      style={{
                        border: "none", background: "transparent", fontSize: 13,
                        color: "#1a0a14", outline: "none", cursor: "pointer",
                        padding: "8px 4px", fontFamily: "inherit", fontWeight: 600,
                      }}
                    >
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+971">🇦🇪 +971</option>
                      <option value="+61">🇦🇺 +61</option>
                      <option value="+65">🇸🇬 +65</option>
                    </select>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d\s]/g, ""))}
                      onKeyDown={(e) => e.key === "Enter" && !loading && handleSendOtp()}
                      placeholder="7700 900000"
                      autoComplete="tel"
                      style={{
                        flex: 1, border: "none", outline: "none",
                        fontSize: 14, color: "#1a0a14", background: "transparent",
                        fontFamily: "inherit", padding: "9px 8px",
                      }}
                    />
                  </div>
                </Field>

                <SubmitButton loading={loading} onClick={handleSendOtp}>
                  Send verification code
                </SubmitButton>

                <p style={{
                  fontSize: 11.5, color: "#999", textAlign: "center", margin: "4px 0 0", lineHeight: 1.5,
                }}>
                  We&apos;ll text you a 6-digit code. Standard rates may apply.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="otp-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div style={{
                  padding: "14px 16px",
                  background: "rgba(92,122,82,0.06)",
                  border: "1px solid rgba(92,122,82,0.15)",
                  borderRadius: 12,
                  display: "flex", alignItems: "center", gap: 10,
                }}>
                  <CheckCircle2 style={{ width: 17, height: 17, color: "#5C7A52", flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: "#3F5937", lineHeight: 1.4 }}>
                    Code sent to <strong>{countryCode} {phone}</strong>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>
                    6-digit code
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                    onKeyDown={(e) => e.key === "Enter" && !loading && handleVerifyOtp()}
                    placeholder="••••••"
                    autoComplete="one-time-code"
                    style={{
                      width: "100%",
                      padding: "18px 16px",
                      background: "rgba(255,255,255,0.95)",
                      border: "1px solid rgba(26,10,20,0.1)",
                      borderRadius: 12,
                      fontSize: 26, fontWeight: 600,
                      color: "#1a0a14",
                      outline: "none",
                      textAlign: "center",
                      letterSpacing: "0.5em",
                      fontFamily: "ui-monospace, 'SF Mono', monospace",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.03), inset 0 1px 2px rgba(0,0,0,0.02)",
                    }}
                  />
                </div>

                <SubmitButton loading={loading} onClick={handleVerifyOtp}>
                  Verify &amp; continue
                </SubmitButton>

                <button
                  type="button"
                  onClick={() => { setOtpSent(false); setOtp(""); clearMsgs(); }}
                  style={{
                    background: "none", border: "none", padding: "6px 0",
                    fontSize: 12, fontWeight: 600, color: "#666",
                    cursor: "pointer", fontFamily: "inherit",
                    textAlign: "center",
                  }}
                >
                  ← Use a different number
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer link */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            style={{
              marginTop: 28, paddingTop: 24,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              fontSize: 13, color: "#777", textAlign: "center", lineHeight: 1.6,
            }}
          >
            New to Match4Marriage?{" "}
            <Link href="/onboarding" style={{
              color: "#dc1e3c", fontWeight: 600, textDecoration: "none",
              display: "inline-flex", alignItems: "center", gap: 4,
            }}>
              Create an account <ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </motion.div>
        </div>
      </motion.section>

      <GlobalStyles />
    </div>
  );
}

// ─── Small components ────────────────────────────────────────────────────────

function Field({ icon: Icon, label, right, children }: {
  icon: any; label: string; right?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block", position: "relative" }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 7,
      }}>
        <span style={{
          fontSize: 11, fontWeight: 700, color: "#555",
          textTransform: "uppercase", letterSpacing: "0.1em",
        }}>{label}</span>
        {right}
      </div>
      <div style={{ position: "relative" }}>
        {Icon && (
          <Icon style={{
            position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
            width: 15, height: 15, color: "#bbb", pointerEvents: "none", zIndex: 1,
          }} />
        )}
        {children}
      </div>
    </label>
  );
}

function MessageBanner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  const isError = tone === "error";
  return (
    <motion.div
      initial={{ opacity: 0, y: -8, height: 0 }}
      animate={{ opacity: 1, y: 0, height: "auto" }}
      exit={{ opacity: 0, y: -4, height: 0 }}
      transition={{ duration: 0.25 }}
      style={{
        display: "flex", alignItems: "flex-start", gap: 9,
        background: isError ? "rgba(220,30,60,0.06)" : "rgba(92,122,82,0.06)",
        color: isError ? "#a0153c" : "#3F5937",
        fontSize: 13,
        padding: "12px 14px",
        borderRadius: 10,
        marginBottom: 16,
        border: `1px solid ${isError ? "rgba(220,30,60,0.14)" : "rgba(92,122,82,0.15)"}`,
        overflow: "hidden",
      }}
    >
      {isError ? <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
               : <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />}
      <span>{children}</span>
    </motion.div>
  );
}

function SubmitButton({ loading, onClick, children }: {
  loading: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={loading}
      whileHover={{ y: loading ? 0 : -1 }}
      whileTap={{ scale: loading ? 1 : 0.98 }}
      style={{
        marginTop: 6,
        padding: "14px 18px",
        background: loading
          ? "linear-gradient(135deg, rgba(220,30,60,0.35), rgba(160,21,60,0.35))"
          : "linear-gradient(135deg, #dc1e3c 0%, #a0153c 100%)",
        color: "#fff",
        border: "none",
        borderRadius: 12,
        fontSize: 14, fontWeight: 600,
        cursor: loading ? "wait" : "pointer",
        boxShadow: loading ? "none" : "0 10px 28px rgba(220,30,60,0.32), inset 0 0 0 1px rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        fontFamily: "inherit",
        transition: "background 0.2s, box-shadow 0.2s",
        letterSpacing: "0.01em",
      }}
    >
      {loading ? (
        <>
          <Loader2 style={{ width: 15, height: 15, animation: "u-spin 0.7s linear infinite" }} />
          Please wait…
        </>
      ) : (
        <>
          {children} <ArrowRight style={{ width: 15, height: 15 }} />
        </>
      )}
    </motion.button>
  );
}

// ─── Mandala (animated decorative SVG) ───────────────────────────────────────

function Mandala() {
  return (
    <div aria-hidden style={{
      position: "absolute",
      top: "50%", right: "-10%",
      transform: "translateY(-50%)",
      width: "70%",
      maxWidth: 720,
      aspectRatio: "1",
      pointerEvents: "none",
      zIndex: 2,
      opacity: 0.55,
    }}>
      <motion.svg
        viewBox="0 0 600 600"
        animate={{ rotate: 360 }}
        transition={{ duration: 120, ease: "linear", repeat: Infinity }}
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <defs>
          <linearGradient id="m-grad-rose" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb9c8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#a0153c" stopOpacity="0.6" />
          </linearGradient>
          <linearGradient id="m-grad-gold" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffc8a8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#c89020" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Outer ring of petals */}
        {Array.from({ length: 24 }).map((_, i) => (
          <g key={`outer-${i}`} transform={`rotate(${i * 15} 300 300)`}>
            <ellipse cx="300" cy="80" rx="6" ry="42" fill="url(#m-grad-rose)" />
          </g>
        ))}

        {/* Middle ring of dots */}
        {Array.from({ length: 16 }).map((_, i) => (
          <g key={`mid-${i}`} transform={`rotate(${i * 22.5} 300 300)`}>
            <circle cx="300" cy="150" r="4" fill="#ffb9c8" opacity="0.7" />
          </g>
        ))}

        {/* Inner ring of long petals */}
        {Array.from({ length: 12 }).map((_, i) => (
          <g key={`inner-${i}`} transform={`rotate(${i * 30} 300 300)`}>
            <path
              d="M 300,200 Q 310,250 300,290 Q 290,250 300,200 Z"
              fill="url(#m-grad-gold)"
              opacity="0.85"
            />
          </g>
        ))}

        {/* 6-pointed star inner */}
        {Array.from({ length: 6 }).map((_, i) => (
          <g key={`star-${i}`} transform={`rotate(${i * 60} 300 300)`}>
            <path
              d="M 300,240 L 310,300 L 300,310 L 290,300 Z"
              fill="rgba(255,152,174,0.85)"
            />
          </g>
        ))}

        {/* Centre ring */}
        <circle cx="300" cy="300" r="20" fill="none" stroke="rgba(255,200,168,0.7)" strokeWidth="1.5" />
        <circle cx="300" cy="300" r="10" fill="rgba(255,152,174,0.6)" />
      </motion.svg>

      {/* Counter-rotating inner ring on top */}
      <motion.svg
        viewBox="0 0 600 600"
        animate={{ rotate: -360 }}
        transition={{ duration: 180, ease: "linear", repeat: Infinity }}
        style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <g key={`count-${i}`} transform={`rotate(${i * 45} 300 300)`}>
            <circle cx="300" cy="230" r="3" fill="#ffc8a8" opacity="0.5" />
          </g>
        ))}
      </motion.svg>
    </div>
  );
}

// ─── Floating decor (hearts + sparkles) ──────────────────────────────────────

function FloatingDecor() {
  const hearts = [
    { left: "8%",  top: "18%", size: 16, delay: 0,   dur: 8, color: "#ffb9c8" },
    { left: "14%", top: "70%", size: 20, delay: 2.5, dur: 10, color: "#ffc8a8" },
    { left: "48%", top: "12%", size: 13, delay: 1.2, dur: 9, color: "#ffb9c8" },
    { left: "3%",  top: "45%", size: 11, delay: 4,   dur: 11, color: "#ffd4a8" },
  ];
  const sparkles = [
    { left: "20%", top: "28%", delay: 0.5 },
    { left: "40%", top: "62%", delay: 2.1 },
    { left: "12%", top: "32%", delay: 3.4 },
  ];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none" }}>
      {hearts.map((h, i) => (
        <Heart
          key={i}
          fill={h.color}
          className="u-heart"
          style={{
            position: "absolute",
            left: h.left, top: h.top,
            width: h.size, height: h.size,
            color: h.color,
            animationDelay: `${h.delay}s`,
            animationDuration: `${h.dur}s`,
            opacity: 0.5,
          }}
        />
      ))}
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="u-sparkle"
          style={{
            position: "absolute",
            left: s.left, top: s.top,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Global styles ───────────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style jsx global>{`
      /* Aurora */
      .u-aurora {
        position: absolute; border-radius: 50%;
        filter: blur(130px); pointer-events: none; will-change: transform;
      }
      .u-aurora-rose {
        width: 540px; height: 540px;
        top: -130px; left: -110px;
        background: radial-gradient(circle, rgba(255,77,121,0.75), transparent 60%);
        animation: u-aurora-rose 24s ease-in-out infinite alternate;
        opacity: 0.55;
      }
      .u-aurora-gold {
        width: 580px; height: 580px;
        bottom: -170px; right: -140px;
        background: radial-gradient(circle, rgba(255,166,77,0.65), transparent 60%);
        animation: u-aurora-gold 30s ease-in-out infinite alternate;
        opacity: 0.3;
      }
      .u-aurora-plum {
        width: 420px; height: 420px;
        top: 48%; left: 35%;
        background: radial-gradient(circle, rgba(155,80,180,0.55), transparent 60%);
        animation: u-aurora-plum 34s ease-in-out infinite alternate;
        opacity: 0.3;
      }
      @keyframes u-aurora-rose {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(160px, 110px) scale(1.18); }
      }
      @keyframes u-aurora-gold {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(-160px, -90px) scale(0.92); }
      }
      @keyframes u-aurora-plum {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(90px, -60px) scale(1.1); }
      }

      /* Grain */
      .u-grain {
        position: absolute; inset: 0; pointer-events: none; z-index: 2;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0.05 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
        mix-blend-mode: overlay; opacity: 0.5;
      }

      /* Dots */
      .u-dots {
        position: absolute; inset: 0; pointer-events: none; z-index: 2;
        background-image: radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px);
        background-size: 28px 28px;
        opacity: 0.1;
        mask-image: radial-gradient(ellipse at 25% 50%, black 5%, transparent 75%);
        -webkit-mask-image: radial-gradient(ellipse at 25% 50%, black 5%, transparent 75%);
      }

      /* Vignette */
      .u-vignette {
        position: absolute; inset: 0; z-index: 4; pointer-events: none;
        background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.5) 100%);
      }

      /* Floating hearts */
      .u-heart {
        animation-name: u-float;
        animation-iteration-count: infinite;
        animation-timing-function: ease-in-out;
      }
      @keyframes u-float {
        0%, 100% { transform: translate(0,0) rotate(0deg); opacity: 0.35; }
        50%      { transform: translate(20px, -30px) rotate(15deg); opacity: 0.85; }
      }

      /* Sparkles */
      .u-sparkle {
        width: 4px; height: 4px; border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 10px rgba(255,200,170,0.9);
        animation: u-sparkle 4.5s ease-in-out infinite;
        opacity: 0;
      }
      @keyframes u-sparkle {
        0%, 100% { opacity: 0; transform: scale(0.5); }
        45%      { opacity: 1; transform: scale(1.2); }
        60%      { opacity: 1; transform: scale(1.2); }
      }

      /* Spinner */
      @keyframes u-spin { to { transform: rotate(360deg); } }

      /* Input focus */
      .m4m-userlogin-root input:focus,
      .m4m-userlogin-root select:focus {
        border-color: #dc1e3c !important;
        background: #fff !important;
        box-shadow: 0 0 0 4px rgba(220, 30, 60, 0.08) !important;
      }
      .m4m-userlogin-root input:focus-within {
        border-color: #dc1e3c !important;
      }

      /* Responsive */
      @media (max-width: 1024px) {
        .m4m-userlogin-root {
          grid-template-columns: 1fr !important;
        }
        .m4m-userlogin-hero {
          padding: 40px 32px !important;
          min-height: 540px;
        }
      }
      @media (max-width: 640px) {
        .m4m-userlogin-hero {
          padding: 32px 24px !important;
          min-height: 440px;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .u-aurora, .u-heart, .u-sparkle { animation: none !important; }
      }
    `}</style>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px 13px 40px",
  background: "rgba(255,255,255,0.95)",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  fontSize: 14,
  color: "#1a0a14",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03), inset 0 1px 2px rgba(0,0,0,0.02)",
};

const eyeBtnStyle: React.CSSProperties = {
  position: "absolute",
  right: 10, top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer",
  color: "#aaa", padding: 6, display: "grid", placeItems: "center",
  borderRadius: 6, transition: "color 0.15s",
};
