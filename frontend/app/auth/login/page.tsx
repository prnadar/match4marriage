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
import { firebaseAuth, rememberSessionUid } from "@/lib/firebase";
import { profileApi } from "@/lib/api";
import { Heart, Phone, Mail, Eye, EyeOff, Sparkles, ArrowRight } from "lucide-react";

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
      setInfo("OTP sent. Check your SMS.");
    } catch (e: any) { setError(e?.message || "Could not send OTP."); }
    finally { setLoading(false); }
  };

  const handleVerifyOtp = async () => {
    clearMsgs();
    if (!confirmationRef.current) return setError("Session expired. Resend OTP.");
    if (otp.replace(/\D/g, "").length < 6) return setError("Enter the 6-digit code.");
    setLoading(true);
    try {
      await confirmationRef.current.confirm(otp.trim());
      await routeAfterAuth();
    } catch { setError("Incorrect code. Please try again."); }
    finally { setLoading(false); }
  };

  const inputBase: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    background: "rgba(255,255,255,0.6)",
    border: "1px solid rgba(123,45,58,0.15)",
    borderRadius: 12,
    fontSize: 15,
    color: "#1a0a14",
    outline: "none",
    transition: "all 0.2s ease",
    fontFamily: "inherit",
  };

  const primaryBtn: React.CSSProperties = {
    width: "100%",
    padding: "14px 20px",
    background: "linear-gradient(135deg, #dc1e3c 0%, #7B2D3A 100%)",
    color: "#fff",
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "0.02em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    boxShadow: "0 10px 30px rgba(220,30,60,0.35)",
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
  };

  return (
    <>
      <style>{`
        @keyframes aurora {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(60px, -40px) scale(1.15); }
          66% { transform: translate(-40px, 30px) scale(0.9); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(0deg); opacity: 0.5; }
          50% { transform: translateY(-30px) rotate(15deg); opacity: 1; }
        }
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseRing {
          0% { transform: scale(0.8); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0; }
        }
        .login-input:focus {
          border-color: #dc1e3c !important;
          background: rgba(255,255,255,0.95) !important;
          box-shadow: 0 0 0 4px rgba(220,30,60,0.08) !important;
        }
        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 14px 40px rgba(220,30,60,0.45);
        }
        .login-btn:active:not(:disabled) { transform: translateY(0); }
        .tab-btn {
          transition: all 0.25s ease;
          position: relative;
          overflow: hidden;
        }
        .tab-btn.active::before {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent);
          background-size: 200% 100%;
          animation: shimmer 2.5s infinite;
        }
        .float-heart { position: absolute; pointer-events: none; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #fff5f0 0%, #fdf2f8 50%, #fef7e0 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}>
        {/* Aurora blobs */}
        <div style={{
          position: "absolute", top: "-200px", left: "-150px",
          width: 500, height: 500, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220,30,60,0.35), transparent 70%)",
          filter: "blur(60px)",
          animation: "aurora 18s ease-in-out infinite",
        }} />
        <div style={{
          position: "absolute", bottom: "-180px", right: "-120px",
          width: 480, height: 480, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(200,144,32,0.3), transparent 70%)",
          filter: "blur(70px)",
          animation: "aurora 22s ease-in-out infinite reverse",
        }} />
        <div style={{
          position: "absolute", top: "40%", left: "55%",
          width: 350, height: 350, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(160,21,60,0.25), transparent 70%)",
          filter: "blur(70px)",
          animation: "aurora 26s ease-in-out infinite",
        }} />

        {/* Floating hearts + sparkles */}
        {[
          { left: "8%", top: "15%", size: 18, delay: "0s", dur: "7s", color: "#dc1e3c" },
          { left: "85%", top: "20%", size: 14, delay: "1.2s", dur: "9s", color: "#C89020" },
          { left: "15%", top: "75%", size: 22, delay: "2.5s", dur: "8s", color: "#7B2D3A" },
          { left: "78%", top: "70%", size: 16, delay: "0.8s", dur: "10s", color: "#dc1e3c" },
          { left: "50%", top: "10%", size: 12, delay: "3s", dur: "11s", color: "#C89020" },
          { left: "92%", top: "50%", size: 20, delay: "1.8s", dur: "8.5s", color: "#7B2D3A" },
        ].map((h, i) => (
          <Heart key={i} className="float-heart" fill={h.color} stroke="none"
            style={{
              left: h.left, top: h.top, width: h.size, height: h.size, color: h.color,
              animation: `float ${h.dur} ease-in-out ${h.delay} infinite`,
              opacity: 0.4,
            }}
          />
        ))}
        {[
          { left: "25%", top: "30%", delay: "0.5s" },
          { left: "70%", top: "35%", delay: "2s" },
          { left: "20%", top: "60%", delay: "3.5s" },
          { left: "75%", top: "85%", delay: "1s" },
        ].map((s, i) => (
          <Sparkles key={`s${i}`} className="float-heart"
            style={{
              left: s.left, top: s.top, width: 14, height: 14, color: "#C89020",
              animation: `float 8s ease-in-out ${s.delay} infinite`,
              opacity: 0.5,
            }}
          />
        ))}

        {/* Glass card */}
        <div style={{
          position: "relative", zIndex: 10,
          width: "100%", maxWidth: 440,
          padding: "40px 36px",
          background: "rgba(255,255,255,0.72)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255,255,255,0.6)",
          borderRadius: 24,
          boxShadow: "0 30px 80px rgba(123,45,58,0.18), 0 4px 24px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
          animation: "fadeSlideUp 0.6s ease-out",
        }}>
          {/* Logo + tag */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 12 }}>
              <div style={{
                position: "absolute", inset: 0, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(220,30,60,0.5), transparent)",
                animation: "pulseRing 2.5s ease-out infinite",
              }} />
              <div style={{
                position: "relative",
                width: 64, height: 64, borderRadius: "50%",
                background: "linear-gradient(135deg, #dc1e3c, #7B2D3A)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 10px 30px rgba(220,30,60,0.4)",
              }}>
                <Heart fill="#fff" stroke="none" style={{ width: 30, height: 30 }} />
              </div>
            </div>
            <h1 style={{
              fontFamily: "var(--font-playfair, Georgia, serif)",
              fontSize: 32, fontWeight: 600, margin: 0,
              color: "#1a0a14", letterSpacing: "-0.02em",
            }}>
              Welcome back
            </h1>
            <p style={{ color: "#6b5560", marginTop: 6, fontSize: 14 }}>
              Sign in to continue your journey to forever.
            </p>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", marginBottom: 24,
            background: "rgba(123,45,58,0.06)",
            borderRadius: 14,
            padding: 4,
          }}>
            {[
              { id: "email", label: "Email", icon: Mail },
              { id: "phone", label: "Phone", icon: Phone },
            ].map(({ id, label, icon: Icon }) => {
              const active = mode === id;
              return (
                <button
                  key={id}
                  className={`tab-btn ${active ? "active" : ""}`}
                  onClick={() => { setMode(id as Mode); clearMsgs(); }}
                  style={{
                    flex: 1, padding: "10px 12px",
                    border: "none", cursor: "pointer",
                    background: active ? "linear-gradient(135deg, #dc1e3c, #7B2D3A)" : "transparent",
                    color: active ? "#fff" : "#7B2D3A",
                    borderRadius: 10,
                    fontSize: 14, fontWeight: 600,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: active ? "0 6px 20px rgba(220,30,60,0.3)" : "none",
                  }}
                >
                  <Icon style={{ width: 15, height: 15 }} />
                  {label}
                </button>
              );
            })}
          </div>

          {mode === "email" && (
            <div style={{ animation: "fadeSlideUp 0.3s ease-out" }}>
              <label style={{ display: "block", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#7B2D3A", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>Email</div>
                <input
                  className="login-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={inputBase}
                />
              </label>

              <label style={{ display: "block", marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#7B2D3A", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>Password</div>
                <div style={{ position: "relative" }}>
                  <input
                    className="login-input"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleEmailLogin()}
                    placeholder="Your password"
                    style={{ ...inputBase, paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#7B2D3A", display: "flex", padding: 4 }}
                  >
                    {showPassword ? <EyeOff style={{ width: 18, height: 18 }} /> : <Eye style={{ width: 18, height: 18 }} />}
                  </button>
                </div>
              </label>

              {error && <div style={{ padding: "10px 14px", background: "rgba(220,30,60,0.08)", color: "#c00", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>{error}</div>}
              {info && <div style={{ padding: "10px 14px", background: "rgba(46,125,50,0.08)", color: "#2e7d32", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>{info}</div>}

              <button className="login-btn" onClick={handleEmailLogin} disabled={loading} style={primaryBtn}>
                {loading ? "Signing in..." : <>Sign in <ArrowRight style={{ width: 16, height: 16 }} /></>}
              </button>

              <div style={{ marginTop: 14, textAlign: "center", fontSize: 13 }}>
                <button type="button" onClick={handleReset} style={{ background: "none", border: "none", color: "#7B2D3A", cursor: "pointer", padding: 0, textDecoration: "underline" }}>
                  Forgot password?
                </button>
              </div>
            </div>
          )}

          {mode === "phone" && (
            <div style={{ animation: "fadeSlideUp 0.3s ease-out" }}>
              {!otpSent && (
                <>
                  <label style={{ display: "block", marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#7B2D3A", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>Phone number</div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <select
                        className="login-input"
                        value={countryCode}
                        onChange={(e) => setCountryCode(e.target.value)}
                        style={{ ...inputBase, width: 110, paddingRight: 8 }}
                      >
                        <option value="+44">🇬🇧 +44</option>
                        <option value="+91">🇮🇳 +91</option>
                        <option value="+1">🇺🇸 +1</option>
                        <option value="+971">🇦🇪 +971</option>
                        <option value="+61">🇦🇺 +61</option>
                        <option value="+65">🇸🇬 +65</option>
                      </select>
                      <input
                        className="login-input"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="7700 900123"
                        style={{ ...inputBase, flex: 1 }}
                      />
                    </div>
                  </label>

                  {error && <div style={{ padding: "10px 14px", background: "rgba(220,30,60,0.08)", color: "#c00", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>{error}</div>}
                  {info && <div style={{ padding: "10px 14px", background: "rgba(46,125,50,0.08)", color: "#2e7d32", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>{info}</div>}

                  <button className="login-btn" onClick={handleSendOtp} disabled={loading} style={primaryBtn}>
                    {loading ? "Sending..." : <>Send OTP <ArrowRight style={{ width: 16, height: 16 }} /></>}
                  </button>
                </>
              )}

              {otpSent && (
                <>
                  <label style={{ display: "block", marginBottom: 18 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#7B2D3A", letterSpacing: "0.08em", marginBottom: 6, textTransform: "uppercase" }}>Enter 6-digit code</div>
                    <input
                      className="login-input"
                      type="text"
                      inputMode="numeric"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleVerifyOtp()}
                      placeholder="• • • • • •"
                      maxLength={6}
                      style={{ ...inputBase, fontSize: 22, letterSpacing: 8, textAlign: "center", fontWeight: 600 }}
                    />
                  </label>

                  {error && <div style={{ padding: "10px 14px", background: "rgba(220,30,60,0.08)", color: "#c00", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>{error}</div>}
                  {info && <div style={{ padding: "10px 14px", background: "rgba(46,125,50,0.08)", color: "#2e7d32", borderRadius: 10, marginBottom: 14, fontSize: 13 }}>{info}</div>}

                  <button className="login-btn" onClick={handleVerifyOtp} disabled={loading} style={primaryBtn}>
                    {loading ? "Verifying..." : <>Verify & continue <ArrowRight style={{ width: 16, height: 16 }} /></>}
                  </button>

                  <button
                    type="button"
                    onClick={() => { setOtpSent(false); setOtp(""); clearMsgs(); }}
                    style={{ width: "100%", marginTop: 10, padding: 10, background: "none", color: "#7B2D3A", border: "1px solid rgba(123,45,58,0.2)", borderRadius: 10, cursor: "pointer", fontSize: 13 }}
                  >
                    Change number
                  </button>
                </>
              )}

              <div id="recaptcha-login" />
            </div>
          )}

          <div style={{
            marginTop: 28, paddingTop: 20,
            borderTop: "1px solid rgba(123,45,58,0.1)",
            textAlign: "center", fontSize: 13, color: "#6b5560",
          }}>
            New to Match4Marriage?{" "}
            <Link href="/onboarding" style={{ color: "#dc1e3c", fontWeight: 600, textDecoration: "none" }}>
              Create an account →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
