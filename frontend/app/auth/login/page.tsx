"use client";

import {
  useEffect, useMemo, useRef, useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  motion, AnimatePresence,
  useMotionValue, useSpring, useTransform,
  type Variants,
} from "framer-motion";
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
  CheckCircle2, Loader2, ArrowLeft,
} from "lucide-react";

// ─── Easing tokens ────────────────────────────────────────────────────────────

const EASE = [0.22, 1, 0.36, 1] as const;          // ease-out-quart: gentle finish
const SPRING_SOFT = { type: "spring" as const, stiffness: 260, damping: 26 };
const SPRING_SNAP = { type: "spring" as const, stiffness: 420, damping: 28 };

type Mode = "email" | "phone";

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    if (h < 5)  return "Welcome home";
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
    <div className="m4m-login" style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(560px, 1fr) minmax(0, 480px)",
      background: "#fdfbf9",
      position: "relative",
      overflow: "hidden",
      color: "#fff",
      fontFamily: "var(--font-poppins, sans-serif)",
    }}>
      <div id="recaptcha-login" style={{ position: "absolute", left: -9999, top: -9999 }} />

      {/* ═══ LEFT — Cinematic hero ═══════════════════════════════════════ */}
      <Hero greeting={greeting} />

      {/* ═══ RIGHT — Form ═══════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15, ease: EASE }}
        className="m4m-login-form"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "48px 44px", background: "#fdfbf9",
          position: "relative", overflow: "hidden",
        }}
      >
        {/* whisper of colour so cream doesn't feel sterile */}
        <div aria-hidden style={{
          position: "absolute", top: -120, right: -120, width: 360, height: 360,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220,30,60,0.08), transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ width: "100%", maxWidth: 380, position: "relative" }}>
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            style={{ marginBottom: 34 }}
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
              fontSize: 36, fontWeight: 500, color: "#1a0a14",
              margin: 0, letterSpacing: "-0.022em", lineHeight: 1.08,
            }}>
              {greeting}.
            </h2>
            <p style={{ fontSize: 14, color: "#777", margin: "10px 0 0", lineHeight: 1.5 }}>
              Continue your journey to forever.
            </p>
          </motion.div>

          {/* Tabs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              display: "flex",
              padding: 3,
              background: "rgba(220,30,60,0.035)",
              border: "1px solid rgba(220,30,60,0.08)",
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
                      transition={SPRING_SNAP}
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
            {error && <Banner key="err" tone="error">{error}</Banner>}
            {!error && info && <Banner key="info" tone="info">{info}</Banner>}
          </AnimatePresence>

          {/* Forms */}
          <AnimatePresence mode="wait">
            {mode === "email" ? (
              <motion.div
                key="email-form"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.25, ease: EASE }}
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

                <Field
                  icon={null}
                  label="Password"
                  right={
                    <button
                      type="button"
                      onClick={handleReset}
                      style={{
                        background: "none", border: "none", padding: 0, cursor: "pointer",
                        fontSize: 11, fontWeight: 600, color: "#dc1e3c", fontFamily: "inherit",
                      }}
                    >
                      Forgot?
                    </button>
                  }
                >
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
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.25, ease: EASE }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <Field icon={Phone} label="Mobile number">
                  <div style={phoneShell}>
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      style={countrySelect}
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
                      style={phoneNumberInput}
                    />
                  </div>
                </Field>

                <SubmitButton loading={loading} onClick={handleSendOtp}>
                  Send verification code
                </SubmitButton>

                <p style={helperText}>
                  We&apos;ll text you a 6-digit code. Standard rates may apply.
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="otp-form"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.28, ease: EASE }}
                style={{ display: "flex", flexDirection: "column", gap: 14 }}
              >
                <div style={otpConfirmBanner}>
                  <CheckCircle2 style={{ width: 17, height: 17, color: "#5C7A52", flexShrink: 0 }} />
                  <div style={{ fontSize: 13, color: "#3F5937", lineHeight: 1.4 }}>
                    Code sent to <strong>{countryCode} {phone}</strong>
                  </div>
                </div>

                <div>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: "#555",
                    textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8,
                  }}>
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
                    style={otpInput}
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
                    cursor: "pointer", fontFamily: "inherit", textAlign: "center",
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                  }}
                >
                  <ArrowLeft style={{ width: 12, height: 12 }} />
                  Use a different number
                </button>
              </motion.div>
            )}
          </AnimatePresence>

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
            <Link href="/onboarding" style={createAccountLink}>
              Create an account <ArrowRight style={{ width: 12, height: 12 }} />
            </Link>
          </motion.div>
        </div>
      </motion.section>

      <GlobalStyles />
    </div>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────

function Hero({ greeting }: { greeting: string }) {
  // Parallax: mouse -> position, smoothed with springs
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 18, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 18, mass: 0.6 });

  // Tiered parallax depth (far → near)
  const farX  = useTransform(sx, (v) => v * 12);
  const farY  = useTransform(sy, (v) => v * 12);
  const midX  = useTransform(sx, (v) => v * 22);
  const midY  = useTransform(sy, (v) => v * 22);
  const nearX = useTransform(sx, (v) => v * 40);
  const nearY = useTransform(sy, (v) => v * 40);

  const heroRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      // Normalise to [-1, 1] relative to centre
      const x = ((e.clientX - r.left) / r.width  - 0.5) * 2;
      const y = ((e.clientY - r.top)  / r.height - 0.5) * 2;
      mx.set(x);
      my.set(y);
    };
    const onLeave = () => { mx.set(0); my.set(0); };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [mx, my]);

  return (
    <motion.aside
      ref={heroRef as any}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="m4m-login-hero"
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #1a0a14 0%, #2d0e1e 30%, #5a1f33 55%, #2d0e1e 85%, #140609 100%)",
        display: "flex",
        flexDirection: "column",
        padding: "48px 60px",
        isolation: "isolate",
      }}
    >
      {/* Aurora — FAR */}
      <motion.span style={{ x: farX, y: farY }} className="h-blur h-blur-rose" />
      <motion.span style={{ x: farX, y: farY }} className="h-blur h-blur-gold" />
      <motion.span style={{ x: farX, y: farY }} className="h-blur h-blur-plum" />

      {/* Grain */}
      <span className="h-grain" />

      {/* Dot grid — FAR parallax */}
      <motion.span style={{ x: useTransform(sx, (v) => v * 8), y: useTransform(sy, (v) => v * 8) }} className="h-dots" />

      {/* Vignette */}
      <span className="h-vignette" />

      {/* Decorative ring — MID parallax */}
      <motion.div style={{ x: midX, y: midY }} className="h-ring-wrap">
        <DecorativeRing />
      </motion.div>

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          position: "relative", zIndex: 5,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}
      >
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #ff4d79, #a0153c)",
            display: "grid", placeItems: "center",
            boxShadow: "0 8px 24px rgba(220,30,60,0.5), inset 0 0 0 1px rgba(255,255,255,0.12)",
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

        {/* Live pill */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          padding: "6px 11px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 999,
          backdropFilter: "blur(10px)",
        }}>
          <span className="pulse-dot" />
          <span style={{
            fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            {greeting}
          </span>
        </div>
      </motion.header>

      {/* ─── Composition: headline + testimonial + stat strip ─── */}
      <div style={{
        flex: 1,
        position: "relative", zIndex: 5,
        display: "flex", flexDirection: "column", justifyContent: "center",
        maxWidth: 620,
        paddingTop: 20,
      }}>
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          style={{
            fontSize: 11, fontWeight: 700,
            color: "rgba(255,255,255,0.5)",
            letterSpacing: "0.22em", textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          <span style={{
            display: "inline-block", verticalAlign: "middle",
            width: 28, height: 1, background: "rgba(255,255,255,0.25)", marginRight: 14,
          }} />
          Since 2024
        </motion.div>

        {/* Headline with word-stagger + underline draw */}
        <HeroHeadline />

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.3, ease: EASE }}
          style={{
            fontSize: 17,
            lineHeight: 1.6,
            color: "rgba(255,255,255,0.6)",
            marginTop: 28, maxWidth: 510,
            fontWeight: 400,
          }}
        >
          Sign in to continue your journey — where verified profiles, real families,
          and the warmth of a community that believes in forever have been waiting for you.
        </motion.p>

        {/* Testimonial quote */}
        <motion.blockquote
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 1.55, ease: EASE }}
          style={{
            margin: "48px 0 0",
            paddingLeft: 20,
            borderLeft: "2px solid rgba(255,152,174,0.45)",
            maxWidth: 520,
          }}
        >
          <p style={{
            margin: 0,
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 20, lineHeight: 1.45,
            fontStyle: "italic",
            color: "rgba(255,255,255,0.82)",
            letterSpacing: "-0.005em",
          }}>
            We met here in 2024 and got married the next spring. Match4Marriage
            made us feel safe from the very first message.
          </p>
          <footer style={{
            marginTop: 14,
            fontSize: 12, fontWeight: 600,
            color: "rgba(255,255,255,0.55)",
            letterSpacing: "0.08em", textTransform: "uppercase",
          }}>
            Priya &amp; Arjun &nbsp;·&nbsp; London &nbsp;·&nbsp; 2025
          </footer>
        </motion.blockquote>
      </div>

      {/* Footer strip */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.8, duration: 0.5 }}
        style={{
          position: "relative", zIndex: 5,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          paddingTop: 28, borderTop: "1px solid rgba(255,255,255,0.06)",
          gap: 16, flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 28 }}>
          <Stat big="50K+" small="Verified members" />
          <Stat big="1,200+" small="Happy couples" />
          <Stat big="4.9★" small="Average rating" />
        </div>
        <div style={{
          fontSize: 11, color: "rgba(255,255,255,0.4)",
          display: "flex", gap: 18, alignItems: "center",
        }}>
          <Link href="/privacy" style={{ color: "inherit", textDecoration: "none" }}>Privacy</Link>
          <Link href="/terms" style={{ color: "inherit", textDecoration: "none" }}>Terms</Link>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </motion.footer>
    </motion.aside>
  );
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <div style={{
        fontFamily: "var(--font-playfair, serif)",
        fontSize: 22, fontWeight: 600, color: "#fff",
        letterSpacing: "-0.01em", lineHeight: 1,
      }}>{big}</div>
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: "rgba(255,255,255,0.45)",
        textTransform: "uppercase", letterSpacing: "0.1em",
        marginTop: 6,
      }}>{small}</div>
    </div>
  );
}

// ─── Headline with word-stagger + drawn underline ───────────────────────────

const WORDS = ["Every", "great", "story", "begins", "with", "a"];
const HL_CONTAINER: Variants = {
  hidden: {},
  show: { transition: { delayChildren: 0.35, staggerChildren: 0.08 } },
};
const HL_WORD: Variants = {
  hidden: { opacity: 0, y: 24, rotateX: 30 },
  show:   { opacity: 1, y: 0, rotateX: 0, transition: { duration: 0.7, ease: EASE } },
};
const HL_HELLO: Variants = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.8, ease: EASE } },
};

function HeroHeadline() {
  return (
    <motion.h1
      variants={HL_CONTAINER}
      initial="hidden"
      animate="show"
      style={{
        fontFamily: "var(--font-playfair, serif)",
        fontSize: "clamp(48px, 5.8vw, 84px)",
        fontWeight: 500,
        lineHeight: 1.03,
        margin: 0,
        letterSpacing: "-0.032em",
        color: "#ffffff",
        perspective: 800,
      }}
    >
      <div style={{ display: "inline-flex", flexWrap: "wrap", gap: "0.22em" }}>
        {WORDS.map((w, i) => (
          <motion.span
            key={i}
            variants={HL_WORD}
            style={{ display: "inline-block", willChange: "transform, opacity" }}
          >
            {w}
          </motion.span>
        ))}
        <motion.span
          variants={HL_HELLO}
          style={{ display: "inline-block", position: "relative", whiteSpace: "nowrap" }}
        >
          <em style={{
            fontStyle: "italic", fontWeight: 400,
            color: "#ffc8d3",
            paddingBottom: 4,
            display: "inline-block",
          }}>
            hello
          </em>
          {/* SVG underline, drawn after reveal */}
          <motion.svg
            aria-hidden
            viewBox="0 0 220 22"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              left: 0, right: 0, bottom: -14,
              width: "100%", height: 18,
              pointerEvents: "none",
            }}
          >
            <motion.path
              d="M 4 12 Q 70 2 120 11 T 216 9"
              fill="none"
              stroke="url(#hl-gradient)"
              strokeWidth={3.4}
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ delay: 1.35, duration: 0.95, ease: EASE }}
            />
            <defs>
              <linearGradient id="hl-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="#ff98ae" stopOpacity="0" />
                <stop offset="20%"  stopColor="#ff98ae" />
                <stop offset="80%"  stopColor="#ffc8a8" />
                <stop offset="100%" stopColor="#ffc8a8" stopOpacity="0" />
              </linearGradient>
            </defs>
          </motion.svg>
        </motion.span>
        <span style={{ marginLeft: "-0.15em" }}>.</span>
      </div>
    </motion.h1>
  );
}

// ─── Decorative ring (animated SVG path draws) ─────────────────────────────

function DecorativeRing() {
  return (
    <svg
      viewBox="0 0 600 600"
      aria-hidden
      style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
    >
      <defs>
        <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#ff98ae" stopOpacity="0.9" />
          <stop offset="50%"  stopColor="#ffc8a8" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id="ring-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"  stopColor="rgba(255,152,174,0.18)" />
          <stop offset="70%" stopColor="rgba(255,152,174,0.04)" />
          <stop offset="100%" stopColor="rgba(255,152,174,0)" />
        </radialGradient>
      </defs>

      {/* Inner glow halo */}
      <circle cx="300" cy="300" r="280" fill="url(#ring-glow)" />

      {/* OUTER ring — draws on mount */}
      <motion.circle
        cx="300" cy="300" r="240"
        fill="none"
        stroke="url(#ring-grad)"
        strokeWidth="1.5"
        strokeDasharray="4 6"
        initial={{ pathLength: 0, opacity: 0, rotate: -45 }}
        animate={{ pathLength: 1, opacity: 1, rotate: 0 }}
        transition={{ delay: 0.4, duration: 2.0, ease: EASE }}
        style={{ transformOrigin: "300px 300px" }}
      />

      {/* MIDDLE slow-rotating subtle ring */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 180, ease: "linear", repeat: Infinity }}
        style={{ transformOrigin: "300px 300px" }}
      >
        <circle
          cx="300" cy="300" r="190"
          fill="none"
          stroke="rgba(255,200,168,0.22)"
          strokeWidth="1"
          strokeDasharray="1 10"
        />
      </motion.g>

      {/* Accent ticks on inner ring */}
      {[...Array(12)].map((_, i) => (
        <motion.g
          key={i}
          transform={`rotate(${i * 30} 300 300)`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 + i * 0.04, duration: 0.4 }}
        >
          <line x1="300" y1="110" x2="300" y2="118" stroke="rgba(255,200,170,0.5)" strokeWidth="1.2" strokeLinecap="round" />
        </motion.g>
      ))}

      {/* Centre orbs — breathing */}
      <motion.g
        animate={{ scale: [1, 1.06, 1] }}
        transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
        style={{ transformOrigin: "300px 300px" }}
      >
        <circle cx="300" cy="300" r="3" fill="#ffd7b8" />
        <circle cx="300" cy="300" r="28" fill="none" stroke="rgba(255,215,184,0.35)" strokeWidth="1" />
        <circle cx="300" cy="300" r="60" fill="none" stroke="rgba(255,215,184,0.18)" strokeWidth="0.8" />
      </motion.g>

      {/* Three orbiting dots, each on its own rotation ring */}
      {[
        { r: 240, dur: 60,  phase: 0,   size: 4, color: "#ffb9c8" },
        { r: 190, dur: 90,  phase: 120, size: 3, color: "#ffc8a8" },
        { r: 140, dur: 45,  phase: 240, size: 2.5, color: "#e0b8ff" },
      ].map((o, i) => (
        <motion.g
          key={i}
          animate={{ rotate: 360 }}
          transition={{ duration: o.dur, ease: "linear", repeat: Infinity, delay: 1 }}
          style={{ transformOrigin: "300px 300px", rotate: o.phase }}
        >
          <circle cx={300} cy={300 - o.r} r={o.size} fill={o.color} style={{ filter: `drop-shadow(0 0 6px ${o.color})` }} />
        </motion.g>
      ))}
    </svg>
  );
}

// ─── Form building blocks ──────────────────────────────────────────────────

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

function Banner({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
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
      transition={SPRING_SNAP}
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

// ─── Global styles ──────────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style jsx global>{`
      /* Aurora — no runtime animation; parallax drives them */
      .h-blur {
        position: absolute;
        border-radius: 50%;
        filter: blur(140px);
        pointer-events: none;
        will-change: transform;
        z-index: 1;
      }
      .h-blur-rose {
        width: 620px; height: 620px;
        top: -160px; left: -140px;
        background: radial-gradient(circle, rgba(255,77,121,0.85), transparent 60%);
        opacity: 0.55;
      }
      .h-blur-gold {
        width: 640px; height: 640px;
        bottom: -180px; right: -160px;
        background: radial-gradient(circle, rgba(255,166,77,0.7), transparent 60%);
        opacity: 0.32;
      }
      .h-blur-plum {
        width: 440px; height: 440px;
        top: 50%; left: 30%;
        background: radial-gradient(circle, rgba(135,58,200,0.55), transparent 60%);
        opacity: 0.28;
      }

      /* Grain */
      .h-grain {
        position: absolute; inset: 0; pointer-events: none; z-index: 2;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0 0.95  0 0 0 0.05 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
        mix-blend-mode: overlay; opacity: 0.5;
      }

      /* Dots */
      .h-dots {
        position: absolute; inset: 0; pointer-events: none; z-index: 2;
        background-image: radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px);
        background-size: 28px 28px;
        opacity: 0.08;
        mask-image: radial-gradient(ellipse at 30% 50%, black 5%, transparent 75%);
        -webkit-mask-image: radial-gradient(ellipse at 30% 50%, black 5%, transparent 75%);
      }

      /* Vignette */
      .h-vignette {
        position: absolute; inset: 0; z-index: 4; pointer-events: none;
        background: radial-gradient(ellipse at 35% 50%, transparent 35%, rgba(0,0,0,0.6) 100%);
      }

      /* Decorative ring wrapper — anchored centre-right */
      .h-ring-wrap {
        position: absolute;
        top: 50%; right: -12%;
        transform: translateY(-50%);
        width: 58%;
        max-width: 720px;
        aspect-ratio: 1;
        pointer-events: none;
        z-index: 3;
        opacity: 0.6;
      }

      /* Pulse dot */
      .pulse-dot {
        width: 7px; height: 7px; border-radius: 50%;
        background: #7dd68c;
        box-shadow: 0 0 10px #7dd68c, 0 0 0 3px rgba(125,214,140,0.25);
        animation: pulse 2.4s ease-in-out infinite;
      }
      @keyframes pulse {
        0%, 100% { box-shadow: 0 0 10px #7dd68c, 0 0 0 3px rgba(125,214,140,0.25); }
        50%      { box-shadow: 0 0 14px #7dd68c, 0 0 0 6px rgba(125,214,140,0.1); }
      }

      /* Spinner */
      @keyframes u-spin { to { transform: rotate(360deg); } }

      /* Focus */
      .m4m-login input:focus,
      .m4m-login select:focus {
        border-color: #dc1e3c !important;
        background: #fff !important;
        box-shadow: 0 0 0 4px rgba(220, 30, 60, 0.08) !important;
      }

      /* Responsive */
      @media (max-width: 1100px) {
        .m4m-login {
          grid-template-columns: 1fr !important;
          min-height: auto !important;
        }
        .m4m-login-hero {
          padding: 48px 40px !important;
          min-height: 560px;
        }
        .h-ring-wrap { opacity: 0.35 !important; width: 80% !important; right: -25% !important; }
      }
      @media (max-width: 640px) {
        .m4m-login-hero {
          padding: 32px 24px !important;
          min-height: 440px;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .pulse-dot { animation: none !important; }
      }
    `}</style>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

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

const phoneShell: React.CSSProperties = {
  display: "flex", gap: 8,
  padding: 4,
  background: "rgba(255,255,255,0.95)",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  paddingLeft: 36,
  boxShadow: "0 1px 3px rgba(0,0,0,0.03), inset 0 1px 2px rgba(0,0,0,0.02)",
};

const countrySelect: React.CSSProperties = {
  border: "none", background: "transparent", fontSize: 13,
  color: "#1a0a14", outline: "none", cursor: "pointer",
  padding: "8px 4px", fontFamily: "inherit", fontWeight: 600,
};

const phoneNumberInput: React.CSSProperties = {
  flex: 1, border: "none", outline: "none",
  fontSize: 14, color: "#1a0a14", background: "transparent",
  fontFamily: "inherit", padding: "9px 8px",
};

const helperText: React.CSSProperties = {
  fontSize: 11.5, color: "#999", textAlign: "center",
  margin: "4px 0 0", lineHeight: 1.5,
};

const otpConfirmBanner: React.CSSProperties = {
  padding: "14px 16px",
  background: "rgba(92,122,82,0.06)",
  border: "1px solid rgba(92,122,82,0.15)",
  borderRadius: 12,
  display: "flex", alignItems: "center", gap: 10,
};

const otpInput: React.CSSProperties = {
  width: "100%",
  padding: "18px 16px",
  background: "rgba(255,255,255,0.95)",
  border: "1px solid rgba(26,10,20,0.1)",
  borderRadius: 12,
  fontSize: 28, fontWeight: 600,
  color: "#1a0a14",
  outline: "none",
  textAlign: "center",
  letterSpacing: "0.5em",
  fontFamily: "ui-monospace, 'SF Mono', monospace",
  boxShadow: "0 1px 3px rgba(0,0,0,0.03), inset 0 1px 2px rgba(0,0,0,0.02)",
};

const createAccountLink: React.CSSProperties = {
  color: "#dc1e3c", fontWeight: 600, textDecoration: "none",
  display: "inline-flex", alignItems: "center", gap: 4,
};
