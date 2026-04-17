"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart, Mail, Lock, Eye, EyeOff, AlertCircle,
  ShieldCheck, Zap, KeyRound, ArrowRight, Check,
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
      gridTemplateColumns: "minmax(0, 1.15fr) minmax(420px, 520px)",
      background: "#0c050a",
      position: "relative",
      overflow: "hidden",
      color: "#fff",
    }}>

      {/* ═══ HERO ═══════════════════════════════════════════════════════ */}
      <motion.aside
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="m4m-login-hero"
        style={{
          position: "relative",
          overflow: "hidden",
          background: "linear-gradient(135deg, #1a0a14 0%, #2a0f1e 30%, #1a0a14 70%, #0c050a 100%)",
          display: "flex",
          flexDirection: "column",
          padding: "48px 64px",
          isolation: "isolate",
        }}
      >
        {/* Aurora blobs (layer 1) */}
        <span className="aurora aurora-rose" />
        <span className="aurora aurora-gold" />
        <span className="aurora aurora-plum" />

        {/* Noise / texture overlay (layer 2) */}
        <span className="hero-grain" />

        {/* Dot grid (layer 3) */}
        <span className="hero-dots" />

        {/* Hex cluster — absolute positioned in the composition (layer 4) */}
        <HexCluster />

        {/* Radial edge vignette (layer 5) */}
        <span className="hero-vignette" />

        {/* ─── Header bar ─── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{
            position: "relative", zIndex: 4,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 11,
              background: "linear-gradient(135deg, #ff4d79, #a0153c)",
              display: "grid", placeItems: "center",
              boxShadow: "0 6px 22px rgba(220,30,60,0.45), inset 0 0 0 1px rgba(255,255,255,0.12)",
            }}>
              <Heart style={{ width: 18, height: 18, color: "#fff" }} fill="#fff" />
            </div>
            <div style={{ lineHeight: 1.1 }}>
              <div style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: 20, fontWeight: 700, color: "#fff",
                letterSpacing: "-0.01em",
              }}>
                Match<span style={{ color: "#ff98ae" }}>4</span>Marriage
              </div>
              <div style={{
                fontSize: 9.5, fontWeight: 700, color: "rgba(255,255,255,0.42)",
                letterSpacing: "0.16em", textTransform: "uppercase", marginTop: 2,
              }}>
                Admin Console
              </div>
            </div>
          </div>

          {/* Operational status pill */}
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
              fontSize: 10.5, fontWeight: 600, color: "rgba(255,255,255,0.72)",
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>
              All systems operational
            </span>
          </div>
        </motion.header>

        {/* ─── Main composition ─── */}
        <div style={{
          flex: 1,
          position: "relative", zIndex: 4,
          display: "flex", flexDirection: "column", justifyContent: "center",
          maxWidth: 580,
          paddingTop: 40,
        }}>
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.3 }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "5px 12px 5px 8px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 999,
              marginBottom: 24, alignSelf: "flex-start",
              backdropFilter: "blur(10px)",
            }}
          >
            <span style={{
              width: 22, height: 22, borderRadius: "50%",
              background: "linear-gradient(135deg, rgba(92,122,82,0.35), rgba(125,214,140,0.35))",
              display: "grid", placeItems: "center",
            }}>
              <Check style={{ width: 11, height: 11, color: "#9ce3a9" }} strokeWidth={3} />
            </span>
            <span style={{
              fontSize: 10.5, fontWeight: 700, color: "rgba(255,255,255,0.78)",
              letterSpacing: "0.14em", textTransform: "uppercase",
            }}>
              Trusted by families since 2024
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: "clamp(40px, 5vw, 68px)",
              fontWeight: 500,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: "-0.028em",
              color: "#ffffff",
            }}
          >
            Where every match<br />
            begins with{" "}
            <span style={{ position: "relative", whiteSpace: "nowrap" }}>
              <em style={{
                fontStyle: "italic",
                fontWeight: 400,
                color: "#ffb9c8",
                position: "relative", zIndex: 1,
              }}>
                trust
              </em>
              <motion.span
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 1.0, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  position: "absolute",
                  left: 0, right: 0, bottom: -4,
                  height: 4, borderRadius: 2,
                  background: "linear-gradient(90deg, transparent, #ff98ae 25%, #ffc8a8 75%, transparent)",
                  transformOrigin: "left center",
                  boxShadow: "0 0 20px rgba(255,152,174,0.4)",
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
              color: "rgba(255,255,255,0.62)",
              marginTop: 22, maxWidth: 500,
              fontWeight: 400,
            }}
          >
            You&apos;re the keeper. Review profiles, verify identities, and guide the community you&apos;re building — all from one console.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.5 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 28 }}
          >
            {[
              { icon: ShieldCheck, label: "Verification queue", tone: "rose" },
              { icon: Zap,         label: "Keyboard-first review", tone: "gold" },
              { icon: KeyRound,    label: "Tenant-isolated safety", tone: "plum" },
            ].map(({ icon: Icon, label, tone }, i) => (
              <motion.span
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 + i * 0.08, duration: 0.4 }}
                whileHover={{ y: -2 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 13px",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  fontSize: 12.5, fontWeight: 500,
                  color: "rgba(255,255,255,0.88)",
                  backdropFilter: "blur(12px)",
                  cursor: "default",
                  letterSpacing: "0.01em",
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: 6,
                  display: "grid", placeItems: "center",
                  background: tone === "rose" ? "rgba(255,152,174,0.16)"
                    : tone === "gold" ? "rgba(255,200,168,0.16)"
                    : "rgba(180,150,220,0.16)",
                }}>
                  <Icon style={{
                    width: 12, height: 12,
                    color: tone === "rose" ? "#ffb9c8"
                      : tone === "gold" ? "#ffc8a8"
                      : "#c8b0e8",
                  }} />
                </span>
                {label}
              </motion.span>
            ))}
          </motion.div>
        </div>

        {/* ─── Bottom trust strip ─── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.5 }}
          style={{
            position: "relative", zIndex: 4,
            paddingTop: 28,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: 16,
          }}
        >
          <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "center" }}>
            {[
              "SOC 2 Type II",
              "ISO 27001",
              "GDPR compliant",
              "End-to-end encrypted",
            ].map((c) => (
              <span key={c} style={{
                fontSize: 11, fontWeight: 500,
                color: "rgba(255,255,255,0.45)",
                letterSpacing: "0.04em",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                <ShieldCheck style={{ width: 11, height: 11, color: "rgba(255,255,255,0.3)" }} />
                {c}
              </span>
            ))}
          </div>
          <span style={{
            fontSize: 11, color: "rgba(255,255,255,0.3)", letterSpacing: "0.04em",
          }}>
            © {new Date().getFullYear()} Match4Marriage Ltd.
          </span>
        </motion.div>
      </motion.aside>

      {/* ═══ FORM ═══════════════════════════════════════════════════════ */}
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
        {/* Subtle form-side backdrop */}
        <div aria-hidden style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at 50% 30%, rgba(220,30,60,0.035), transparent 65%)",
          pointerEvents: "none",
        }} />

        <div style={{ width: "100%", maxWidth: 400, position: "relative" }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            style={{ marginBottom: 36 }}
          >
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              padding: "4px 10px 4px 8px",
              background: "rgba(220,30,60,0.06)",
              border: "1px solid rgba(220,30,60,0.14)",
              borderRadius: 999,
              marginBottom: 18,
            }}>
              <ShieldCheck style={{ width: 11, height: 11, color: "#dc1e3c" }} />
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#a0153c",
                letterSpacing: "0.12em", textTransform: "uppercase",
              }}>
                Admin sign-in
              </span>
            </div>
            <h2 style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 34, fontWeight: 500, color: "#1a0a14",
              margin: 0, letterSpacing: "-0.022em", lineHeight: 1.1,
            }}>
              {greeting}.
            </h2>
            <p style={{ fontSize: 14, color: "#777", margin: "10px 0 0", lineHeight: 1.5 }}>
              Sign in to continue to your admin console.
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
                  display: "flex", alignItems: "flex-start", gap: 9,
                  background: "rgba(220,30,60,0.06)",
                  color: "#a0153c",
                  fontSize: 13,
                  padding: "12px 14px",
                  borderRadius: 10,
                  marginBottom: 18,
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
                style={{ ...inputStyle, paddingRight: 42 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                style={{
                  position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#aaa", padding: 6, display: "grid", placeItems: "center",
                  borderRadius: 6,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "#1a0a14")}
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
                boxShadow: loading ? "none" : "0 10px 28px rgba(220,30,60,0.32), inset 0 0 0 1px rgba(255,255,255,0.1)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                fontFamily: "inherit",
                transition: "background 0.2s, box-shadow 0.2s",
                letterSpacing: "0.01em",
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
              marginTop: 32, paddingTop: 24,
              borderTop: "1px solid rgba(0,0,0,0.06)",
              fontSize: 11.5, color: "#999", textAlign: "center", lineHeight: 1.6,
            }}
          >
            Admin accounts are managed by super-admins.<br />
            Contact your team to request access.
          </motion.div>
        </div>
      </motion.section>

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
        fontSize: 11, fontWeight: 700, color: "#555",
        textTransform: "uppercase", letterSpacing: "0.1em",
        marginBottom: 7,
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

// Arranged as an asymmetric honeycomb — centre hex + 4 orbiters
// Coords are in viewBox (800x600) space so they scale cleanly.
const HEX_AVATARS: HexAvatarData[] = [
  { size: 210, cx: 460, cy: 300, grad: ["#ff7a9a", "#a0153c"], delay: 0.55, floatY: -10, floatDur: 6.5, scalePeak: 1.025 }, // CENTRE couple
  { size: 110, cx: 290, cy: 170, grad: ["#ffd7b8", "#e8a06b"], delay: 0.70, floatY: -8,  floatDur: 5.6, scalePeak: 1.04  },
  { size: 100, cx: 640, cy: 180, grad: ["#a8c0ff", "#6079c4"], delay: 0.80, floatY: -11, floatDur: 7.2, scalePeak: 1.035 },
  { size:  96, cx: 250, cy: 460, grad: ["#ffdd95", "#b88420"], delay: 0.90, floatY: -9,  floatDur: 6.8, scalePeak: 1.04  },
  { size: 110, cx: 640, cy: 460, grad: ["#b5d8a6", "#5c7a52"], delay: 1.00, floatY: -10, floatDur: 6.0, scalePeak: 1.03  },
];

function HexCluster() {
  return (
    <div
      aria-hidden
      className="hex-cluster"
      style={{
        position: "absolute",
        top: "50%",
        right: "-4%",
        transform: "translateY(-50%)",
        width: "60%",
        maxWidth: 720,
        aspectRatio: "800/600",
        pointerEvents: "none",
        zIndex: 2,
        opacity: 0.95,
      }}
    >
      <svg
        viewBox="0 0 800 600"
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
            <stop offset="0%" stopColor="rgba(255,180,150,0.25)" />
            <stop offset="100%" stopColor="rgba(255,180,150,0)" />
          </radialGradient>
        </defs>

        {/* Centre glow behind cluster */}
        <circle cx="460" cy="300" r="280" fill="url(#hex-glow)" />

        {/* Connecting lines */}
        {HEX_AVATARS.slice(1).map((a, i) => (
          <motion.line
            key={`line-${i}`}
            x1={460}
            y1={300}
            x2={a.cx}
            y2={a.cy}
            stroke="rgba(255,152,174,0.18)"
            strokeWidth="1"
            strokeDasharray="3 5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ delay: 0.6 + i * 0.1, duration: 1.0, ease: [0.22, 1, 0.36, 1] }}
          />
        ))}

        {/* Hexagons */}
        {HEX_AVATARS.map((a, i) => (
          <HexAvatar key={i} data={a} index={i} />
        ))}
      </svg>

      {/* Sparkles */}
      <span className="sparkle sparkle-1" />
      <span className="sparkle sparkle-2" />
      <span className="sparkle sparkle-3" />
    </div>
  );
}

function HexAvatar({ data, index }: { data: HexAvatarData; index: number }) {
  const halfSize = data.size / 2;
  const heartSize = Math.max(12, data.size * 0.2);
  return (
    <motion.g
      initial={{ opacity: 0, scale: 0.55 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: data.delay, duration: 0.75, type: "spring", stiffness: 180, damping: 20 }}
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
          delay: data.delay + 0.2,
        }}
        style={{ transformOrigin: `${data.cx}px ${data.cy}px` }}
      >
        <g transform={`translate(${data.cx - halfSize}, ${data.cy - halfSize}) scale(${data.size / 200})`}>
          {/* Drop shadow hex underneath for extra depth */}
          <polygon
            points={HEX_POINTS}
            fill="rgba(0,0,0,0.35)"
            transform="translate(2, 8)"
            style={{ filter: "blur(12px)" }}
          />
          {/* Main hex */}
          <polygon
            points={HEX_POINTS}
            fill={`url(#hex-grad-${index})`}
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1.5"
          />
          {/* Inner highlight hex */}
          <polygon
            points={HEX_POINTS}
            fill="none"
            stroke="rgba(255,255,255,0.28)"
            strokeWidth="1"
            transform="scale(0.86) translate(16, 14)"
          />
          {/* Top-left gloss */}
          <polygon
            points="100,10 170,50 170,65 100,25 30,65 30,50"
            fill="rgba(255,255,255,0.12)"
          />
          {/* Centre heart (only on central hex) */}
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
  return (
    <path
      d={`M 0,${size * 0.3}
          C ${-size * 0.7},${-size * 0.4} ${-size * 1.5},${size * 0.3} 0,${size * 1.4}
          C ${size * 1.5},${size * 0.3} ${size * 0.7},${-size * 0.4} 0,${size * 0.3}
          Z`}
      fill="rgba(255,255,255,0.95)"
      style={{ filter: "drop-shadow(0 2px 4px rgba(26,10,20,0.35))" }}
    />
  );
}

// ─── Global styles ────────────────────────────────────────────────────────────

function GlobalStyles() {
  return (
    <style jsx global>{`
      /* Aurora blobs */
      .aurora {
        position: absolute;
        border-radius: 50%;
        filter: blur(130px);
        pointer-events: none;
        will-change: transform;
      }
      .aurora-rose {
        width: 520px; height: 520px;
        top: -120px; left: -100px;
        background: radial-gradient(circle, rgba(255,77,121,0.8), transparent 60%);
        animation: aurora-rose 24s ease-in-out infinite alternate;
        opacity: 0.5;
      }
      .aurora-gold {
        width: 560px; height: 560px;
        bottom: -160px; right: -120px;
        background: radial-gradient(circle, rgba(255,166,77,0.7), transparent 60%);
        animation: aurora-gold 30s ease-in-out infinite alternate;
        opacity: 0.28;
      }
      .aurora-plum {
        width: 380px; height: 380px;
        top: 55%; left: 22%;
        background: radial-gradient(circle, rgba(124,58,237,0.7), transparent 60%);
        animation: aurora-plum 34s ease-in-out infinite alternate;
        opacity: 0.22;
      }
      @keyframes aurora-rose {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(160px, 110px) scale(1.2); }
      }
      @keyframes aurora-gold {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(-160px, -80px) scale(0.9); }
      }
      @keyframes aurora-plum {
        from { transform: translate(0,0) scale(1); }
        to   { transform: translate(90px, -60px) scale(1.12); }
      }

      /* Grain texture (SVG-encoded noise) */
      .hero-grain {
        position: absolute; inset: 0;
        pointer-events: none; z-index: 2;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0 0.9  0 0 0 0.05 0'/></filter><rect width='200' height='200' filter='url(%23n)'/></svg>");
        mix-blend-mode: overlay;
        opacity: 0.55;
      }

      /* Dot grid — subtle */
      .hero-dots {
        position: absolute; inset: 0;
        pointer-events: none; z-index: 2;
        background-image: radial-gradient(rgba(255,255,255,0.28) 1px, transparent 1px);
        background-size: 26px 26px;
        opacity: 0.12;
        mask-image: radial-gradient(ellipse at 30% 50%, black 10%, transparent 75%);
        -webkit-mask-image: radial-gradient(ellipse at 30% 50%, black 10%, transparent 75%);
      }

      /* Edge vignette so corners fade to darker */
      .hero-vignette {
        position: absolute; inset: 0; z-index: 3;
        pointer-events: none;
        background: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.55) 100%);
      }

      /* Pulsing green dot for status pill */
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

      /* Sparkle dots inside cluster */
      .sparkle {
        position: absolute;
        width: 4px; height: 4px;
        border-radius: 50%;
        background: #fff;
        box-shadow: 0 0 10px rgba(255,200,170,0.9);
        opacity: 0;
        animation: sparkle 4.5s ease-in-out infinite;
      }
      .sparkle-1 { top: 20%; right: 42%; animation-delay: 0.5s; }
      .sparkle-2 { top: 65%; right: 18%; animation-delay: 2.1s; }
      .sparkle-3 { top: 32%; right: 8%;  animation-delay: 3.4s; }
      @keyframes sparkle {
        0%, 100% { opacity: 0; transform: scale(0.6); }
        40%      { opacity: 1; transform: scale(1.2); }
        60%      { opacity: 1; transform: scale(1.2); }
      }

      /* Spinner */
      .spinner {
        width: 14px; height: 14px; border-radius: 50%;
        border: 2px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        animation: spin 0.7s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* Input focus */
      .m4m-login-root input:focus {
        border-color: #dc1e3c !important;
        background: #fff !important;
        box-shadow: 0 0 0 4px rgba(220, 30, 60, 0.08) !important;
      }

      /* Responsive */
      @media (max-width: 1024px) {
        .m4m-login-root {
          grid-template-columns: 1fr !important;
        }
        .m4m-login-hero {
          padding: 40px 32px !important;
          min-height: 560px;
        }
        :global(.hex-cluster) {
          opacity: 0.45 !important;
          width: 80% !important;
          right: -20% !important;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .aurora, .sparkle, .spinner, .pulse-dot { animation: none !important; }
      }
    `}</style>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
