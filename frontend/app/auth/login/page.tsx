"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
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
  CheckCircle2, Loader2, ArrowLeft,
} from "lucide-react";

const EASE = [0.22, 1, 0.36, 1] as const;
const SPRING = { type: "spring" as const, stiffness: 380, damping: 30 };

type Mode = "email" | "phone";

// Curated stories — each tied to a photo. Cycled on a 10s rotation so the
// hero feels alive without any decoration or noise.
const STORIES = [
  {
    src: "/couples/couple-hero.jpg",
    quote: "From the first conversation I knew. Match4Marriage made the family part feel easy — everything else just followed.",
    couple: "Meera & Rahul",
    location: "London",
    year: 2025,
  },
  {
    src: "/couples/wedding-swing.jpg",
    quote: "Our parents met on a video call after just two weeks. Two months later, we were engaged.",
    couple: "Divya & Karthik",
    location: "Bangalore",
    year: 2025,
  },
  {
    src: "/couples/heritage-villa.jpg",
    quote: "Verified profiles, thoughtful matches. For the biggest decision of our lives, that mattered.",
    couple: "Sneha & Arjun",
    location: "Chennai",
    year: 2024,
  },
  {
    src: "/couples/mandapam.jpg",
    quote: "We both wanted tradition and respect. The platform quietly aligned everything else.",
    couple: "Lakshmi & Vivek",
    location: "Hyderabad",
    year: 2025,
  },
];

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

  // Rotate stories on a 10s interval
  const [storyIdx, setStoryIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStoryIdx((i) => (i + 1) % STORIES.length), 10000);
    return () => clearInterval(id);
  }, []);

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
      if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password"))
        setError("Email or password is incorrect.");
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

  const currentStory = STORIES[storyIdx];

  return (
    <div className="m4m-login" style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.35fr) minmax(420px, 520px)",
      background: "#fdfbf9",
      position: "relative",
      overflow: "hidden",
      fontFamily: "var(--font-poppins, sans-serif)",
    }}>
      <div id="recaptcha-login" style={{ position: "absolute", left: -9999 }} />

      {/* ═══ LEFT — Editorial photograph ═══════════════════════════════ */}
      <aside className="m4m-login-hero" style={{
        position: "relative",
        overflow: "hidden",
        background: "#1a0a14",
      }}>
        {/* Rotating images with slow Ken Burns */}
        <AnimatePresence mode="wait">
          <motion.div
            key={storyIdx}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, scale: 1.06 }}
            exit={{ opacity: 0 }}
            transition={{ opacity: { duration: 1.2, ease: EASE }, scale: { duration: 12, ease: "linear" } }}
            style={{ position: "absolute", inset: 0 }}
          >
            <Image
              src={currentStory.src}
              alt=""
              fill
              priority={storyIdx === 0}
              sizes="(max-width: 1024px) 100vw, 60vw"
              style={{ objectFit: "cover", objectPosition: "center" }}
            />
          </motion.div>
        </AnimatePresence>

        {/* Gradient overlay for legibility */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(180deg, rgba(26,10,20,0.55) 0%, rgba(26,10,20,0.05) 30%, rgba(26,10,20,0.1) 55%, rgba(26,10,20,0.82) 100%)",
          pointerEvents: "none",
        }} />

        {/* Top-left brand mark */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            position: "absolute", top: 32, left: 32, zIndex: 2,
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <Link href="/" style={{
            display: "inline-flex", alignItems: "center", gap: 10,
            padding: "8px 12px 8px 10px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            textDecoration: "none",
          }}>
            <div style={{
              width: 28, height: 28, borderRadius: 8,
              background: "linear-gradient(135deg, #ff4d79, #a0153c)",
              display: "grid", placeItems: "center",
            }}>
              <Heart style={{ width: 14, height: 14, color: "#fff" }} fill="#fff" />
            </div>
            <span style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 15, fontWeight: 700, color: "#fff",
              letterSpacing: "-0.005em",
            }}>
              Match<span style={{ color: "#ffb9c8" }}>4</span>Marriage
            </span>
          </Link>
        </motion.div>

        {/* Top-right: story pager */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            position: "absolute", top: 40, right: 32, zIndex: 2,
            display: "flex", alignItems: "center", gap: 10,
          }}
        >
          <span style={{
            fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)",
            letterSpacing: "0.18em", textTransform: "uppercase",
          }}>
            {String(storyIdx + 1).padStart(2, "0")} / {String(STORIES.length).padStart(2, "0")}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            {STORIES.map((_, i) => (
              <button
                key={i}
                onClick={() => setStoryIdx(i)}
                aria-label={`Show story ${i + 1}`}
                style={{
                  width: i === storyIdx ? 22 : 8,
                  height: 4, borderRadius: 2, border: "none",
                  background: i === storyIdx ? "#fff" : "rgba(255,255,255,0.35)",
                  transition: "all 400ms cubic-bezier(0.22, 1, 0.36, 1)",
                  cursor: "pointer", padding: 0,
                }}
              />
            ))}
          </div>
        </motion.div>

        {/* Bottom quote + attribution — cross-fades with photo */}
        <AnimatePresence mode="wait">
          <motion.div
            key={storyIdx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}
            style={{
              position: "absolute", left: 48, right: 48, bottom: 52, zIndex: 2,
              maxWidth: 640,
            }}
          >
            <p style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: "clamp(20px, 2.2vw, 30px)",
              fontWeight: 400,
              lineHeight: 1.35,
              color: "#fff",
              margin: 0,
              fontStyle: "italic",
              letterSpacing: "-0.01em",
              textShadow: "0 2px 20px rgba(0,0,0,0.4)",
            }}>
              &ldquo;{currentStory.quote}&rdquo;
            </p>
            <div style={{
              marginTop: 20,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{
                width: 28, height: 1, background: "rgba(255,255,255,0.5)",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: "rgba(255,255,255,0.85)",
                letterSpacing: "0.14em", textTransform: "uppercase",
              }}>
                {currentStory.couple} &nbsp;·&nbsp; {currentStory.location} &nbsp;·&nbsp; {currentStory.year}
              </span>
            </div>
          </motion.div>
        </AnimatePresence>
      </aside>

      {/* ═══ RIGHT — Form ═══════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.1, ease: EASE }}
        className="m4m-login-form"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "56px 48px", background: "#fdfbf9",
          position: "relative", overflow: "hidden",
        }}
      >
        <div style={{ width: "100%", maxWidth: 400 }}>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            style={{ marginBottom: 40 }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "4px 11px 4px 8px",
              background: "rgba(220,30,60,0.055)",
              border: "1px solid rgba(220,30,60,0.12)",
              borderRadius: 999,
              marginBottom: 22,
            }}>
              <Heart style={{ width: 10, height: 10, color: "#dc1e3c" }} fill="#dc1e3c" />
              <span style={{
                fontSize: 9.5, fontWeight: 700, color: "#a0153c",
                letterSpacing: "0.14em", textTransform: "uppercase",
              }}>
                Sign in
              </span>
            </div>
            <h1 style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 40, fontWeight: 500, color: "#1a0a14",
              margin: 0, letterSpacing: "-0.025em", lineHeight: 1.08,
            }}>
              {greeting}.
            </h1>
            <p style={{
              fontSize: 14.5, color: "#78686e",
              margin: "10px 0 0", lineHeight: 1.55, fontWeight: 400,
            }}>
              Continue your journey to forever.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            style={{
              display: "flex",
              padding: 3,
              background: "rgba(220,30,60,0.03)",
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
                      transition={SPRING}
                      style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                        borderRadius: 9,
                        boxShadow: "0 4px 12px rgba(220,30,60,0.28), inset 0 0 0 1px rgba(255,255,255,0.08)",
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

          <AnimatePresence mode="wait">
            {error && <Banner key="err" tone="error">{error}</Banner>}
            {!error && info && <Banner key="info" tone="info">{info}</Banner>}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {mode === "email" ? (
              <motion.div
                key="email-form"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 6 }}
                transition={{ duration: 0.22, ease: EASE }}
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
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.22, ease: EASE }}
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
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: EASE }}
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
                    cursor: "pointer", fontFamily: "inherit",
                    display: "inline-flex", alignItems: "center", gap: 6,
                    alignSelf: "center",
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
            transition={{ delay: 0.75 }}
            style={{
              marginTop: 32, paddingTop: 24,
              borderTop: "1px solid rgba(26,10,20,0.07)",
              fontSize: 13, color: "#78686e", textAlign: "center", lineHeight: 1.6,
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
          fontSize: 10.5, fontWeight: 700, color: "#555",
          textTransform: "uppercase", letterSpacing: "0.12em",
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
      transition={SPRING}
      style={{
        marginTop: 6,
        padding: "15px 18px",
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
        letterSpacing: "0.015em",
      }}
    >
      {loading ? (
        <>
          <Loader2 style={{ width: 15, height: 15, animation: "m4m-spin 0.7s linear infinite" }} />
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
      @keyframes m4m-spin { to { transform: rotate(360deg); } }

      .m4m-login input:focus,
      .m4m-login select:focus {
        border-color: #dc1e3c !important;
        background: #fff !important;
        box-shadow: 0 0 0 4px rgba(220, 30, 60, 0.07) !important;
      }

      /* Responsive — stack below 1024px */
      @media (max-width: 1024px) {
        .m4m-login {
          grid-template-columns: 1fr !important;
          min-height: auto !important;
        }
        .m4m-login-hero {
          min-height: 42vh;
          aspect-ratio: 16 / 10;
        }
        .m4m-login-form {
          padding: 44px 32px !important;
        }
      }
      @media (max-width: 640px) {
        .m4m-login-hero {
          min-height: 320px;
          aspect-ratio: unset;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
      }
    `}</style>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 14px 14px 40px",
  background: "rgba(255,255,255,0.98)",
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
  background: "rgba(255,255,255,0.98)",
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
  padding: "20px 16px",
  background: "rgba(255,255,255,0.98)",
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
