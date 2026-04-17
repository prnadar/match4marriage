"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle, ShieldCheck, Sparkles, ArrowRight } from "lucide-react";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { firebaseAuth, clearClientState, rememberSessionUid } from "@/lib/firebase";
import { api } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
    <div style={{
      minHeight: "100vh",
      position: "relative",
      display: "grid",
      gridTemplateColumns: "minmax(0, 1fr) minmax(380px, 520px)",
      background: "#fdfbf9",
      overflow: "hidden",
    }}
    className="admin-login-root"
    >
      {/* ── Hero side (animated) ── */}
      <div style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #1a0a14 0%, #3b1428 55%, #7B2D3A 100%)",
        display: "flex", flexDirection: "column",
        padding: "56px 64px",
        color: "#fff",
      }}>
        {/* Aurora blobs */}
        <span className="hero-blob hero-blob-1" />
        <span className="hero-blob hero-blob-2" />
        <span className="hero-blob hero-blob-3" />

        {/* Grid overlay */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, opacity: 0.08,
          backgroundImage: "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse at center, black 0%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, black 0%, transparent 80%)",
        }} />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{ display: "flex", alignItems: "center", gap: 12, position: "relative", zIndex: 1 }}
        >
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
            display: "grid", placeItems: "center",
            boxShadow: "0 8px 24px rgba(220,30,60,0.4)",
          }}>
            <Heart style={{ width: 20, height: 20, color: "#fff" }} fill="#fff" />
          </div>
          <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 22, fontWeight: 700 }}>
            Match<span style={{ color: "#ff98ae" }}>4</span>Marriage
          </span>
        </motion.div>

        {/* Centre tagline */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", position: "relative", zIndex: 1 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              padding: "6px 12px",
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 999,
              marginBottom: 24, alignSelf: "flex-start",
              backdropFilter: "blur(10px)",
            }}
          >
            <ShieldCheck style={{ width: 13, height: 13, color: "#ffc8d3" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Admin Console
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: "clamp(40px, 5vw, 64px)",
              fontWeight: 600,
              lineHeight: 1.05,
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Craft the moments
            <br />
            that change lives.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.6 }}
            style={{
              fontSize: 16, lineHeight: 1.6,
              color: "rgba(255,255,255,0.75)",
              marginTop: 24, maxWidth: 460,
            }}
          >
            Review profiles, guard your community, and ship trust — one verified match at a time.
          </motion.p>

          {/* Feature pills */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 32 }}
          >
            {[
              { icon: ShieldCheck, label: "Real-time verification queue" },
              { icon: Sparkles,    label: "Keyboard-first review" },
              { icon: Heart,       label: "Tenant-isolated safety" },
            ].map(({ icon: Icon, label }, i) => (
              <motion.span
                key={label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + i * 0.08 }}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 12px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 999,
                  fontSize: 12, fontWeight: 500,
                  color: "rgba(255,255,255,0.85)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <Icon style={{ width: 12, height: 12, color: "#ffc8d3" }} />
                {label}
              </motion.span>
            ))}
          </motion.div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.5 }}
          style={{ position: "relative", zIndex: 1, fontSize: 12, color: "rgba(255,255,255,0.4)" }}
        >
          © {new Date().getFullYear()} Match4Marriage. All rights reserved.
        </motion.div>
      </div>

      {/* ── Form side ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "40px 32px", background: "#fdfbf9",
        position: "relative",
      }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: "100%", maxWidth: 380 }}
        >
          <div style={{ marginBottom: 32 }}>
            <h2 style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 28, fontWeight: 600, color: "#1a0a14",
              margin: 0, letterSpacing: "-0.015em",
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 14, color: "#888", margin: "6px 0 0" }}>
              Sign in to your admin account to continue.
            </p>
          </div>

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
                  border: "1px solid rgba(220,30,60,0.12)",
                  overflow: "hidden",
                }}
              >
                <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Field icon={Mail} label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@match4marriage.com"
                autoComplete="username"
                required
                style={inputStyle}
              />
            </Field>

            <Field icon={Lock} label="Password">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                required
                style={{ ...inputStyle, paddingRight: 38 }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer",
                  color: "#999", padding: 0, display: "flex",
                }}
                title={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <EyeOff style={{ width: 16, height: 16 }} /> : <Eye style={{ width: 16, height: 16 }} />}
              </button>
            </Field>

            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ y: loading ? 0 : -1 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 28 }}
              style={{
                marginTop: 8,
                padding: "14px 18px",
                background: loading
                  ? "rgba(220,30,60,0.35)"
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

          <div style={{
            marginTop: 24, paddingTop: 20,
            borderTop: "1px solid rgba(0,0,0,0.06)",
            fontSize: 12, color: "#aaa", textAlign: "center",
          }}>
            Admin accounts are managed by super-admins. Contact your team to request access.
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        .hero-blob {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          opacity: 0.55;
          pointer-events: none;
        }
        .hero-blob-1 {
          width: 360px; height: 360px;
          top: -80px; left: -40px;
          background: radial-gradient(circle, #ff4d79, transparent 60%);
          animation: hero-drift-a 20s ease-in-out infinite alternate;
        }
        .hero-blob-2 {
          width: 420px; height: 420px;
          bottom: -120px; right: -80px;
          background: radial-gradient(circle, #ffa64d, transparent 60%);
          animation: hero-drift-b 24s ease-in-out infinite alternate;
          opacity: 0.35;
        }
        .hero-blob-3 {
          width: 280px; height: 280px;
          top: 40%; left: 30%;
          background: radial-gradient(circle, #7c3aed, transparent 60%);
          animation: hero-drift-c 28s ease-in-out infinite alternate;
          opacity: 0.28;
        }
        @keyframes hero-drift-a {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(120px, 80px) scale(1.15); }
        }
        @keyframes hero-drift-b {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(-120px, -60px) scale(0.92); }
        }
        @keyframes hero-drift-c {
          from { transform: translate(0,0) scale(1); }
          to   { transform: translate(60px, -40px) scale(1.1); }
        }
        .spinner {
          width: 14px; height: 14px; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          :global(.admin-login-root) {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", position: "relative" }}>
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
          width: 15, height: 15, color: "#aaa",
        }} />
        {children}
      </div>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 14px 13px 40px",
  background: "rgba(255,255,255,0.9)",
  border: "1px solid rgba(220,30,60,0.15)",
  borderRadius: 12,
  fontSize: 14,
  color: "#1a0a14",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
};
