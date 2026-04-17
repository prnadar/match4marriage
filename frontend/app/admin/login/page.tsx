"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Mail, Lock, Eye, EyeOff, AlertCircle,
  ShieldCheck, Zap, KeyRound, ArrowRight,
} from "lucide-react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseAuth, clearClientState, rememberSessionUid } from "@/lib/firebase";
import { api } from "@/lib/api";

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 5) return "Welcome back";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Welcome back";
  }, []);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        await user.getIdToken(true);
        const res = await api.get<{ data: { is_admin: boolean } }>("/api/v1/auth/me");
        if ((res.data as any)?.data?.is_admin) router.replace("/admin/dashboard");
      } catch { /* stay on login */ }
    });
    return unsub;
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      await cred.user.getIdToken(true);
      rememberSessionUid(cred.user.uid);
      const res = await api.get<{ data: { is_admin: boolean } }>("/api/v1/auth/me");
      if ((res.data as any)?.data?.is_admin !== true) {
        await signOut(firebaseAuth);
        clearClientState();
        setError("This account does not have admin access.");
        setLoading(false);
        return;
      }
      router.replace("/admin/dashboard");
    } catch (e: any) {
      const code = e?.code || "";
      if (code.includes("user-not-found") || code.includes("invalid-credential") || code.includes("wrong-password")) {
        setError("Email or password is incorrect.");
      } else if (code.includes("too-many-requests")) {
        setError("Too many attempts. Please wait a moment and try again.");
      } else if (code.includes("user-disabled")) {
        setError("This account has been disabled.");
      } else {
        setError(e?.message || "Login failed.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="m4m-login-root" style={{
      minHeight: "100vh",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1.1fr) minmax(400px, 500px)",
      background: "#fdfbf9",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* ── Hero side ── */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="m4m-login-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "radial-gradient(ellipse at 30% 20%, #4a1528 0%, #2a0c18 50%, #1a0a14 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "52px 60px",
          color: "#fff",
        }}
      >
        {/* Drifting aurora blobs */}
        <span className="aurora aurora-rose" />
        <span className="aurora aurora-gold" />
        <span className="aurora aurora-plum" />

        {/* Subtle dot grid */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, opacity: 0.08,
          backgroundImage: "radial-gradient(rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse at 40% 45%, black 10%, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse at 40% 45%, black 10%, transparent 75%)",
          pointerEvents: "none",
        }} />

        {/* Brand mark */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 2 }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #ff4d79, #a0153c)",
            display: "grid", placeItems: "center",
            boxShadow: "0 8px 24px rgba(220,30,60,0.45), 0 0 0 1px rgba(255,255,255,0.1) inset",
          }}>
            <Heart style={{ width: 20, height: 20, color: "#fff" }} fill="#fff" />
          </div>
          <div>
            <span style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 22, fontWeight: 700, color: "#fff",
              letterSpacing: "-0.01em",
            }}>
              Match<span style={{ color: "#ff98ae" }}>4</span>Marriage
            </span>
            <div style={{
              fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.5)",
              letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 1,
            }}>
              Admin Console
            </div>
          </div>
        </motion.div>

        {/* Centre: hexagon cluster + headline */}
        <div style={{
          flex: 1, position: "relative", zIndex: 2,
          display: "flex", flexDirection: "column",
          justifyContent: "center",
          gap: 32,
        }}>
          <HexCluster />

          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "6px 14px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 999,
                marginBottom: 20,
                backdropFilter: "blur(10px)",
              }}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: "#7dd68c",
                boxShadow: "0 0 10px #7dd68c",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)",
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                Trusted by families since 2024
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: "clamp(36px, 4.8vw, 56px)",
                fontWeight: 600,
                lineHeight: 1.08,
                margin: 0,
                letterSpacing: "-0.025em",
              }}
            >
              Where every match <br />
              begins with{" "}
              <span style={{
                background: "linear-gradient(135deg, #ff98ae, #ffc8a8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                fontStyle: "italic",
              }}>trust</span>.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              style={{
                fontSize: 15,
                lineHeight: 1.65,
                color: "rgba(255,255,255,0.68)",
                marginTop: 18, maxWidth: 460,
              }}
            >
              You&apos;re the keeper. Review profiles, verify identities, and guide the community you&apos;re building.
            </motion.p>

            {/* Feature pills */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.75, duration: 0.4 }}
              style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}
            >
              {[
                { icon: ShieldCheck, label: "Verification queue" },
                { icon: Zap,         label: "Keyboard-first review" },
                { icon: KeyRound,    label: "Tenant-isolated safety" },
              ].map(({ icon: Icon, label }, i) => (
                <motion.span
                  key={label}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 + i * 0.08, duration: 0.4 }}
                  whileHover={{ y: -2, borderColor: "rgba(255,200,100,0.35)" }}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 7,
                    padding: "7px 13px",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 999,
                    fontSize: 12, fontWeight: 500,
                    color: "rgba(255,255,255,0.88)",
                    backdropFilter: "blur(12px)",
                    cursor: "default",
                    transition: "border-color 200ms",
                  }}
                >
                  <Icon style={{ width: 13, height: 13, color: "#ffc8a8" }} />
                  {label}
                </motion.span>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          style={{
            position: "relative", zIndex: 2,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            fontSize: 11.5,
            color: "rgba(255,255,255,0.4)",
          }}
        >
          <span>© {new Date().getFullYear()} Match4Marriage</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <ShieldCheck style={{ width: 11, height: 11 }} />
            End-to-end encrypted · GDPR compliant
          </span>
        </motion.div>
      </motion.div>

      {/* ── Form side ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "48px 40px", background: "#fdfbf9", position: "relative",
        }}
      >
        <div style={{ width: "100%", maxWidth: 380 }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            style={{ marginBottom: 34 }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "4px 10px",
              background: "rgba(220,30,60,0.06)",
              border: "1px solid rgba(220,30,60,0.12)",
              borderRadius: 999,
              marginBottom: 14,
            }}>
              <ShieldCheck style={{ width: 11, height: 11, color: "#dc1e3c" }} />
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#a0153c",
                letterSpacing: "0.1em", textTransform: "uppercase",
              }}>
                Admin sign-in
              </span>
            </div>
            <h2 style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 32, fontWeight: 600, color: "#1a0a14",
              margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15,
            }}>
              {greeting}.
            </h2>
            <p style={{ fontSize: 14, color: "#777", margin: "8px 0 0" }}>
              Sign in to your admin account to continue.
            </p>
          </motion.div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key="err"
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -4, height: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  display: "flex", alignItems: "flex-start", gap: 8,
                  background: "rgba(220,30,60,0.06)",
                  color: "#a0153c",
                  fontSize: 13,
                  padding: "12px 14px",
                  borderRadius: 10,
                  marginBottom: 16,
                  border: "1px solid rgba(220,30,60,0.14)",
                  overflow: "hidden",
                }}
              >
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <InputField icon={Mail} label="Email" delay={0.45}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@match4marriage.com"
                autoComplete="username"
                required
                style={inputStyle}
              />
            </InputField>

            <InputField icon={Lock} label="Password" delay={0.55}>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ ...inputStyle, paddingRight: 40 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#aaa", padding: 4, display: "grid", placeItems: "center",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#666")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "#aaa")}
              >
                {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </InputField>

            <motion.button
              type="submit"
              disabled={loading}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              whileHover={{ y: loading ? 0 : -1 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              style={{
                marginTop: 10,
                padding: "14px 18px",
                background: loading
                  ? "linear-gradient(135deg, rgba(220,30,60,0.35), rgba(160,21,60,0.35))"
                  : "linear-gradient(135deg, #dc1e3c 0%, #a0153c 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 12,
                fontSize: 14, fontWeight: 600,
                cursor: loading ? "wait" : "pointer",
                boxShadow: loading ? "none" : "0 12px 32px rgba(220,30,60,0.32)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit",
                transition: "background 0.2s, box-shadow 0.2s",
              }}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight style={{ width: 15, height: 15 }} />
                </>
              )}
            </motion.button>
          </form>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.85 }}
            style={{
              marginTop: 28, paddingTop: 22,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              fontSize: 11.5, color: "#aaa", textAlign: "center", lineHeight: 1.5,
            }}
          >
            Admin accounts are managed by super-admins.<br />
            Contact your team to request access.
          </motion.div>
        </div>
      </motion.div>

      <GlobalStyles />
    </div>
  );
}

// ─── Sub components ───────────────────────────────────────────────────────────

function InputField({
  icon: Icon, label, delay, children,
}: {
  icon: any; label: string; delay: number; children: React.ReactNode;
}) {
  return (
    <motion.label
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      style={{ display: "block", position: "relative" }}
    >
      <span style={{
        display: "block",
        fontSize: 11, fontWeight: 600, color: "#555",
        textTransform: "uppercase", letterSpacing: "0.08em",
        marginBottom: 6,
      }}>
        {label}
      </span>
      <div style={{ position: "relative" }}>
        <Icon style={{
          position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
          width: 15, height: 15, color: "#bbb", pointerEvents: "none",
        }} />
        {children}
      </div>
    </motion.label>
  );
}

// ─── Hexagon cluster ──────────────────────────────────────────────────────────

const HEX_POINTS = "100,10 170,50 170,130 100,170 30,130 30,50";

interface HexAvatarData {
  size: number;
  cx: number;
  cy: number;
  grad: [string, string];
  delay: number;
  floatY: number;
  floatDur: number;
  scalePeak: number;
}

const HEX_AVATARS: HexAvatarData[] = [
  { size: 200, cx: 400, cy: 290, grad: ["#ff7a9a", "#a0153c"], delay: 0.6,  floatY: -12, floatDur: 6.5, scalePeak: 1.04 }, // centre couple
  { size: 120, cx: 220, cy: 200, grad: ["#ffc8a8", "#e68a5c"], delay: 0.75, floatY: -10, floatDur: 5.5, scalePeak: 1.06 },
  { size: 110, cx: 590, cy: 210, grad: ["#8fb4ff", "#5072c4"], delay: 0.85, floatY: -14, floatDur: 7.2, scalePeak: 1.05 },
  { size: 100, cx: 180, cy: 400, grad: ["#ffd18a", "#c89020"], delay: 0.95, floatY: -9,  floatDur: 6.8, scalePeak: 1.06 },
  { size: 120, cx: 600, cy: 410, grad: ["#b5d8a6", "#5c7a52"], delay: 1.05, floatY: -11, floatDur: 6.0, scalePeak: 1.04 },
];

function HexCluster() {
  return (
    <div
      aria-hidden
      className="hex-cluster"
      style={{
        position: "relative",
        width: "100%",
        maxWidth: 520,
        aspectRatio: "800/560",
        margin: "0 auto",
      }}
    >
      <svg
        viewBox="0 0 800 560"
        style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
      >
        <defs>
          {HEX_AVATARS.map((a, i) => (
            <linearGradient key={i} id={`hex-grad-${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={a.grad[0]} />
              <stop offset="100%" stopColor={a.grad[1]} />
            </linearGradient>
          ))}
          <radialGradient id="hex-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,200,180,0.25)" />
            <stop offset="100%" stopColor="rgba(255,200,180,0)" />
          </radialGradient>
        </defs>

        {/* Centre glow */}
        <circle cx="400" cy="290" r="260" fill="url(#hex-glow)" />

        {/* Connecting lines (softly drawn) */}
        {HEX_AVATARS.slice(1).map((a, i) => (
          <motion.line
            key={`line-${i}`}
            x1={400}
            y1={290}
            x2={a.cx}
            y2={a.cy}
            stroke="rgba(255,152,174,0.22)"
            strokeWidth="1"
            strokeDasharray="3 4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.55 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}

        {/* Hexagons */}
        {HEX_AVATARS.map((a, i) => (
          <HexAvatar key={i} data={a} index={i} />
        ))}
      </svg>

      {/* Floating sparkle dots (pure CSS) */}
      <span className="sparkle sparkle-1" />
      <span className="sparkle sparkle-2" />
      <span className="sparkle sparkle-3" />
    </div>
  );
}

function HexAvatar({ data, index }: { data: HexAvatarData; index: number }) {
  const halfSize = data.size / 2;
  const heartSize = Math.max(10, data.size * 0.18);
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: data.delay, duration: 0.7, type: "spring", stiffness: 180, damping: 18 }}
      style={{ transformOrigin: `${data.cx}px ${data.cy}px` }}
    >
      <motion.g
        animate={{
          y: [0, data.floatY, 0],
          scale: [1, data.scalePeak, 1],
        }}
        transition={{
          duration: data.floatDur,
          repeat: Infinity,
          ease: "easeInOut",
          delay: data.delay,
        }}
        style={{ transformOrigin: `${data.cx}px ${data.cy}px` }}
      >
        <g transform={`translate(${data.cx - halfSize}, ${data.cy - halfSize}) scale(${data.size / 200})`}>
          {/* Outer hex */}
          <polygon
            points={HEX_POINTS}
            fill={`url(#hex-grad-${index})`}
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1.5"
            style={{ filter: "drop-shadow(0 18px 30px rgba(26,10,20,0.35))" }}
          />
          {/* Inner highlight */}
          <polygon
            points={HEX_POINTS}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
            transform="scale(0.88) translate(13.5, 12)"
          />
          {/* Heart (only on centre hex, index 0) */}
          {index === 0 && (
            <g transform="translate(100, 90)">
              <HeartPath size={heartSize} />
            </g>
          )}
        </g>
      </motion.g>
    </motion.g>
  );
}

function HeartPath({ size }: { size: number }) {
  // Heart shape centered around origin; tuned to read clearly at any size.
  return (
    <path
      d={`M 0,${size * 0.3}
          C ${-size * 0.7},${-size * 0.4} ${-size * 1.5},${size * 0.3} 0,${size * 1.4}
          C ${size * 1.5},${size * 0.3} ${size * 0.7},${-size * 0.4} 0,${size * 0.3}
          Z`}
      fill="rgba(255,255,255,0.92)"
      style={{ filter: "drop-shadow(0 2px 4px rgba(26,10,20,0.35))" }}
    />
  );
}

// ─── Global styles ────────────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style jsx global>{`
      /* Aurora blobs — ambient motion behind the cluster */
      .aurora {
        position: absolute;
        border-radius: 50%;
        filter: blur(120px);
        pointer-events: none;
        opacity: 0.6;
        will-change: transform;
      }
      .aurora-rose {
        width: 460px; height: 460px;
        top: -80px; left: -60px;
        background: radial-gradient(circle, #ff4d79, transparent 60%);
        animation: aurora-rose 22s ease-in-out infinite alternate;
      }
      .aurora-gold {
        width: 500px; height: 500px;
        bottom: -120px; right: -100px;
        background: radial-gradient(circle, #ffa64d, transparent 60%);
        animation: aurora-gold 28s ease-in-out infinite alternate;
        opacity: 0.38;
      }
      .aurora-plum {
        width: 340px; height: 340px;
        top: 40%; left: 35%;
        background: radial-gradient(circle, #7c3aed, transparent 60%);
        animation: aurora-plum 32s ease-in-out infinite alternate;
        opacity: 0.3;
      }
      @keyframes aurora-rose {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(140px, 90px) scale(1.18); }
      }
      @keyframes aurora-gold {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(-140px, -70px) scale(0.9); }
      }
      @keyframes aurora-plum {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(80px, -50px) scale(1.1); }
      }

      /* Tiny sparkle dots in the cluster */
      .sparkle {
        position: absolute;
        width: 4px; height: 4px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 8px rgba(255,200,170,0.8);
        opacity: 0;
        animation: sparkle 4s ease-in-out infinite;
      }
      .sparkle-1 { top: 22%; left: 18%; animation-delay: 0.4s; }
      .sparkle-2 { top: 68%; left: 82%; animation-delay: 1.8s; }
      .sparkle-3 { top: 30%; left: 76%; animation-delay: 3.1s; }
      @keyframes sparkle {
        0%, 100% { opacity: 0; transform: scale(0.7); }
        40%      { opacity: 1; transform: scale(1.3); }
        60%      { opacity: 1; transform: scale(1.3); }
      }

      /* Spinner in submit button */
      .spinner {
        width: 14px; height: 14px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Input focus ring */
      .m4m-login-root input:focus {
        border-color: #dc1e3c !important;
        background: #fff !important;
        box-shadow: 0 0 0 4px rgba(220, 30, 60, 0.08) !important;
      }

      /* Responsive: collapse to single column */
      @media (max-width: 960px) {
        .m4m-login-root {
          grid-template-columns: 1fr !important;
        }
        .m4m-login-hero {
          padding: 40px 32px !important;
          min-height: 420px;
        }
        .hex-cluster {
          max-width: 360px !important;
        }
      }

      /* Respect reduced-motion */
      @media (prefers-reduced-motion: reduce) {
        .aurora, .sparkle, .spinner { animation: none !important; }
      }
    `}</style>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px 13px 40px",
  background: "rgba(255,255,255,0.92)",
  border: "1px solid rgba(220,30,60,0.12)",
  borderRadius: 12,
  fontSize: 14,
  color: "#1a0a14",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
  boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
};
