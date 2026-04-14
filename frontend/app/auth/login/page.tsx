"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const handleLogin = async () => {
    setError("");
    setInfo("");
    if (!email.includes("@")) return setError("Please enter a valid email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      router.replace("/dashboard");
    } catch (e: any) {
      const code = e?.code || "";
      if (code.includes("user-not-found") || code.includes("invalid-credential")) {
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
    setError("");
    setInfo("");
    if (!email.includes("@")) return setError("Enter your email first, then click reset.");
    try {
      await sendPasswordResetEmail(firebaseAuth, email.trim());
      setInfo("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      setError(e?.message || "Could not send reset email.");
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Sign in</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>Welcome back to Match4Marriage.</p>

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
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
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
        onClick={handleLogin}
        disabled={loading}
        style={{ width: "100%", padding: 12, background: "#7B2D3A", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 16 }}
      >
        {loading ? "Signing in..." : "Sign in"}
      </button>

      <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", fontSize: 14 }}>
        <button type="button" onClick={handleReset} style={{ background: "none", border: "none", color: "#7B2D3A", cursor: "pointer", padding: 0 }}>
          Forgot password?
        </button>
        <Link href="/onboarding" style={{ color: "#7B2D3A" }}>
          Sign in with phone instead
        </Link>
      </div>

      <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee", textAlign: "center", fontSize: 14 }}>
        New here? <Link href="/onboarding" style={{ color: "#7B2D3A" }}>Create an account</Link>
      </div>
    </div>
  );
}
