"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, Mail, Lock, Eye, EyeOff, AlertCircle } from "lucide-react";
import {
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { firebaseAuth, clearClientState, rememberSessionUid } from "@/lib/firebase";
import { api } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // If an admin is already signed in, skip the form.
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        // Force refresh so a freshly-granted admin claim is picked up.
        await user.getIdToken(true);
        const res = await api.get<{ data: { is_admin: boolean } }>("/api/v1/auth/me");
        if ((res.data as any)?.data?.is_admin) {
          router.replace("/admin/verifications");
        }
      } catch {
        // Not authenticated / not authorised — stay on login page
      }
    });
    return unsub;
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      // 1. Sign in via Firebase
      const cred = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      // 2. Force a token refresh so custom claims land immediately
      await cred.user.getIdToken(true);
      rememberSessionUid(cred.user.uid);

      // 3. Confirm admin role server-side
      const res = await api.get<{ data: { is_admin: boolean; roles: string[] } }>("/api/v1/auth/me");
      const isAdmin = (res.data as any)?.data?.is_admin === true;
      if (!isAdmin) {
        await signOut(firebaseAuth);
        clearClientState();
        setError("This account does not have admin access.");
        setLoading(false);
        return;
      }

      // 4. Route into the admin area
      router.replace("/admin/verifications");
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
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3">
            <Heart className="w-7 h-7 text-rose fill-rose" />
            <span className="font-display text-2xl font-bold text-deep">Match4Marriage</span>
          </div>
          <p className="font-body text-sm text-muted">Admin Panel</p>
        </div>

        <div className="glass-card p-8">
          <h2 className="font-display text-xl font-semibold text-deep mb-6 text-center">
            Admin Log In
          </h2>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm font-body px-4 py-3 rounded-xl mb-4">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block font-body text-sm font-medium text-deep/70 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@match4marriage.com"
                  autoComplete="username"
                  required
                  className="w-full pl-10 pr-4 py-3 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                  style={{ borderColor: "rgba(201,149,74,0.2)", minHeight: "auto" }}
                />
              </div>
            </div>

            <div>
              <label className="block font-body text-sm font-medium text-deep/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  className="w-full pl-10 pr-10 py-3 rounded-xl border font-body text-sm text-deep bg-white/80 focus:outline-none focus:ring-2 focus:ring-gold/30 focus:border-gold transition-colors"
                  style={{ borderColor: "rgba(201,149,74,0.2)", minHeight: "auto" }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-deep transition-colors"
                  style={{ minHeight: "auto", minWidth: "auto" }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2 disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Log In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
