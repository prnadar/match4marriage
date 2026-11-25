"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import { Eye, EyeOff, AlertTriangle, ArrowRight, ArrowLeft } from "lucide-react";
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

  // The time-of-day greeting is resolved AFTER mount, never during render.
  // Computing it in render makes the server (UTC) and the client (local)
  // disagree on the hour, which trips a React hydration mismatch. A failed
  // hydration leaves the Next.js client router wedged, so a successful
  // sign-in's redirect silently no-ops and the button stays on "Signing in…"
  // forever. Starting from a stable value keeps SSR and the first client
  // render identical.
  const [greeting, setGreeting] = useState("Welcome back");
  useEffect(() => {
    const h = new Date().getHours();
    setGreeting(
      h < 5 ? "Welcome back"
        : h < 12 ? "Good morning"
        : h < 17 ? "Good afternoon"
        : h < 21 ? "Good evening"
        : "Welcome back",
    );
  }, []);

  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) return;
      try {
        await user.getIdToken(true);
        const res = await api.get<{ data: { is_admin: boolean } }>("/api/v1/auth/me");
        // SPA navigation keeps the in-memory Firebase session continuous so the
        // dashboard gate sees the signed-in user immediately. A full reload
        // would re-read persistence — a transient `null` there bounces back to
        // login → infinite loop — and would remount the root-layout preloader.
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
    <MotionConfig reducedMotion="user">
      <div className="admin-console grid min-h-screen bg-background font-body text-foreground lg:grid-cols-[minmax(0,1.1fr)_minmax(440px,560px)]">

        {/* ── Brand panel: the member app's aubergine ground, hairlines not glow ── */}
        <aside className="adm-rail relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.08] px-14 py-12 text-white lg:flex">
          <div className="flex items-center gap-3">
            <span className="inline-flex rounded-lg bg-white/95 px-2 py-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo.png" alt="Match 4 Marriage" className="block h-7 w-auto" />
            </span>
            <span className="adm-kicker">Admin console</span>
          </div>

          <div className="max-w-[30rem]">
            <span aria-hidden className="mb-7 block h-px w-12 bg-[rgba(201,149,74,0.6)]" />
            <p className="font-display text-[40px] font-medium leading-[1.12] tracking-[0.005em] text-white [text-wrap:balance] xl:text-[46px]">
              Every introduction begins with a profile someone here has read.
            </p>
            <p className="mt-6 max-w-[26rem] text-[15px] leading-[1.7] text-white/70">
              Review and verify profiles, answer enquiries, suggest matches and keep the membership record straight, from one console.
            </p>
          </div>

          <dl className="grid max-w-[30rem] grid-cols-3 gap-6 border-t border-white/[0.08] pt-6">
            {[
              ["Review", "Verification queue with keyboard shortcuts"],
              ["Record", "Approvals, suspensions and pricing changes are logged"],
              ["Access", "Admin rights are granted per account"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="adm-kicker">{k}</dt>
                <dd className="mt-2 text-[12.5px] leading-[1.55] text-white/65">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>

        {/* ── Sign-in form ── */}
        <main className="flex flex-col">
          {/* Compact brand bar for phones / tablets (the panel is desktop-only). */}
          <div className="adm-rail flex items-center gap-3 border-b border-white/[0.08] px-5 py-4 lg:hidden">
            <span className="inline-flex rounded-md bg-white/95 px-1.5 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/logo.png" alt="Match 4 Marriage" className="block h-6 w-auto" />
            </span>
            <span className="adm-kicker">Admin console</span>
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="w-full max-w-[380px]"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] adm-fg-gold" style={{ fontFamily: "var(--font-nav)" }}>
                Staff sign-in
              </p>
              <h1 className="mt-3 font-display text-[32px] font-semibold leading-[1.12] tracking-[0.005em] text-foreground">
                {greeting}
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-muted2-foreground">
                Sign in with your admin account to open the console.
              </p>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.div
                    key="err"
                    role="alert"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="adm-soft-bad mt-6 flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] leading-snug"
                  >
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleLogin} className="mt-7 flex flex-col gap-4">
                <div>
                  <label htmlFor="admin-email" className="mb-1.5 block text-[12.5px] font-medium text-foreground">Email</label>
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@match4marriage.com"
                    autoComplete="username"
                    autoFocus
                    required
                    className={fieldCls}
                  />
                </div>

                <div>
                  <label htmlFor="admin-password" className="mb-1.5 block text-[12.5px] font-medium text-foreground">Password</label>
                  <div className="relative">
                    <input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      required
                      className={`${fieldCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-md text-muted2-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  aria-busy={loading || undefined}
                  className="mt-1 inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-primary bg-primary px-4 text-[14px] font-medium text-primary-foreground shadow-[0_1px_2px_rgba(160,21,60,0.25)] transition-colors hover:border-[#C21933] hover:bg-[#C21933] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
                >
                  {loading ? (
                    <>
                      <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" /> Signing in…
                    </>
                  ) : (
                    <>
                      Sign in <ArrowRight className="h-4 w-4" aria-hidden />
                    </>
                  )}
                </button>
              </form>

              <div className="mt-8 border-t border-border pt-5 text-[12.5px] leading-relaxed text-muted2-foreground">
                <p>Admin access is granted by an existing administrator. If you need it, ask your team lead.</p>
                <Link
                  href="/"
                  className="mt-3 inline-flex items-center gap-1.5 rounded font-medium text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to match4marriage.com
                </Link>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </MotionConfig>
  );
}

// Same field recipe as the console (components/admin/primitives FIELD), one
// step taller: this is the only form a signed-out admin ever sees.
const fieldCls =
  "h-11 w-full rounded-lg border border-border bg-card px-3.5 text-[14px] text-foreground " +
  "placeholder:text-muted2-foreground transition-shadow " +
  "focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-ring/20";
