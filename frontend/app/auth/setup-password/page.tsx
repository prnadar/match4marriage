"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { EmailAuthProvider, linkWithCredential } from "firebase/auth";
import { firebaseAuth, rememberSessionUid } from "@/lib/firebase";

export default function SetupPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) {
        router.replace("/onboarding");
        return;
      }
      rememberSessionUid(user.uid);
      // If email already linked, skip
      const hasEmail = user.providerData.some((p) => p.providerId === "password");
      if (hasEmail) {
        router.replace("/dashboard");
        return;
      }
      setReady(true);
    });
    return unsub;
  }, [router]);

  const handleSave = async () => {
    setError("");
    if (!email.includes("@")) return setError("Please enter a valid email.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirm) return setError("Passwords don't match.");

    const user = firebaseAuth.currentUser;
    if (!user) return setError("Session expired. Please sign in again.");

    setLoading(true);
    try {
      const cred = EmailAuthProvider.credential(email.trim(), password);
      await linkWithCredential(user, cred);
      router.replace("/dashboard");
    } catch (e: any) {
      const code = e?.code || "";
      if (code.includes("email-already-in-use")) {
        setError("This email is already used by another account.");
      } else if (code.includes("provider-already-linked")) {
        router.replace("/dashboard");
      } else {
        setError(e?.message || "Could not save.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!ready) return null;

  return (
    <div style={{ maxWidth: 420, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 26, marginBottom: 8 }}>Set your email & password</h1>
      <p style={{ color: "#666", marginBottom: 24 }}>
        Required so you can sign back in from any device. You can still sign in with phone OTP too.
      </p>

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

      <label style={{ display: "block", marginBottom: 12 }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Password (min 6 chars)</div>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
        />
      </label>

      <label style={{ display: "block", marginBottom: 16 }}>
        <div style={{ fontSize: 13, marginBottom: 4 }}>Confirm password</div>
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSave()}
          style={{ width: "100%", padding: 10, border: "1px solid #ddd", borderRadius: 6 }}
        />
      </label>

      {error && <div style={{ color: "#c00", marginBottom: 12 }}>{error}</div>}

      <button
        onClick={handleSave}
        disabled={loading}
        style={{ width: "100%", padding: 12, background: "#7B2D3A", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 16 }}
      >
        {loading ? "Saving..." : "Save and continue"}
      </button>

      <button
        type="button"
        onClick={() => router.replace("/dashboard")}
        style={{ width: "100%", marginTop: 10, padding: 10, background: "none", color: "#666", border: "1px solid #ddd", borderRadius: 6, cursor: "pointer" }}
      >
        Remind me later
      </button>
    </div>
  );
}
