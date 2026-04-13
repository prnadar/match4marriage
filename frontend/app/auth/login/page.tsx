"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!email.includes("@")) { setError("Please enter a valid email address."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }
    setError("");
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) {
        setError(authError.message === "Invalid login credentials"
          ? "Incorrect email or password. Please try again."
          : authError.message);
        setLoading(false);
        return;
      }
      // Save token for backend API calls
      if (data.session?.access_token) {
        localStorage.setItem("auth_token", data.session.access_token);
      }
      // Redirect to onboarding if not completed, otherwise dashboard
      const onboardingDone = localStorage.getItem("onboarding_completed") === "true";
      router.push(onboardingDone ? "/dashboard" : "/onboarding");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#fdfbf9", fontFamily: "var(--font-poppins, sans-serif)" }}>

      {/* ── Site Header ── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(253,251,249,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(220,30,60,0.10)",
        padding: "0 32px",
        height: "60px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <Link href="/" style={{ textDecoration: "none", minHeight: "auto" }}>
          <img src="/images/logo.jpeg" alt="Match4Marriage" style={{ height: "44px", width: "auto", objectFit: "contain" }} />
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          {/* Contact */}
          <Link href="/contact" style={{ fontSize: "14px", fontWeight: 500, color: "#555", textDecoration: "none" }}
            onMouseOver={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#dc1e3c"}
            onMouseOut={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#555"}
          >Contact</Link>

          {/* Help dropdown */}
          <div ref={helpRef} style={{ position: "relative" }}>
            <button onClick={() => setHelpOpen(!helpOpen)} style={{
              fontSize: "14px", fontWeight: 500, color: helpOpen ? "#dc1e3c" : "#555",
              background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px",
            }}>
              Help
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: helpOpen ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {helpOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                background: "#fff", borderRadius: "12px", minWidth: "160px",
                boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "1px solid rgba(220,30,60,0.1)",
                overflow: "hidden", zIndex: 100,
              }}>
                {[{ label: "FAQ", href: "/faq" }, { label: "Contact Us", href: "/contact" }].map((item) => (
                  <Link key={item.label} href={item.href} onClick={() => setHelpOpen(false)} style={{
                    display: "block", padding: "11px 18px", fontSize: "13px", fontWeight: 500,
                    color: "#333", textDecoration: "none", borderBottom: "1px solid rgba(220,30,60,0.06)",
                  }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "rgba(220,30,60,0.05)"; (e.currentTarget as HTMLAnchorElement).style.color = "#dc1e3c"; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; (e.currentTarget as HTMLAnchorElement).style.color = "#333"; }}
                  >{item.label}</Link>
                ))}
              </div>
            )}
          </div>

          <Link href="/auth/register" style={{ fontSize: "14px", fontWeight: 500, color: "#555", textDecoration: "none" }}>Register</Link>
          <Link href="/auth/login" style={{
            fontSize: "14px", fontWeight: 600, color: "#fff",
            background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
            padding: "8px 20px", borderRadius: "8px", textDecoration: "none",
          }}>Log In</Link>
        </div>
      </header>

      <div style={{ flex: 1, display: "flex" }}>

      {/* ── Left panel — hero image ── */}
      <div
        className="hidden lg:flex"
        style={{
          width: "45%",
          flexDirection: "column",
          justifyContent: "flex-end",
          alignItems: "center",
          backgroundImage: "url('/couples/couple-hero.png')",
          backgroundSize: "cover",
          backgroundPosition: "center top",
          padding: "0",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Dark gradient overlay — bottom-up so text is readable */}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(26,10,20,0.65) 0%, rgba(26,10,20,0.05) 35%, rgba(0,0,0,0) 100%)", pointerEvents: "none" }} />

        {/* Bottom text overlay on image */}
        <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "40px 40px", width: "100%" }}>
          <Link href="/" style={{ textDecoration: "none" }}>
            <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "26px", fontWeight: 700, color: "#fff", display: "block", marginBottom: "12px", textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
              Match<span style={{ color: "#dc1e3c" }}>4</span>Marriage
            </span>
          </Link>
          <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "28px", fontWeight: 700, color: "#fff", lineHeight: 1.3, marginBottom: "10px", textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
            Welcome Back
          </h2>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)", lineHeight: 1.7, textShadow: "0 1px 6px rgba(0,0,0,0.4)" }}>
            UK's most trusted elite Indian matrimonial service
          </p>
        </div>
      </div>

      {/* ── Right panel — form ── */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: "40px 24px",
      }}>

        {/* Mobile logo */}
        <Link href="/" className="lg:hidden" style={{ textDecoration: "none", marginBottom: "32px" }}>
          <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "24px", fontWeight: 700, color: "#1a0a14" }}>
            Match<span style={{ color: "#dc1e3c" }}>4</span>Marriage
          </span>
        </Link>

        <div style={{ width: "100%", maxWidth: "440px" }}>

          <h1 style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: "28px",
            fontWeight: 700,
            color: "#1a0a14",
            marginBottom: "6px",
          }}>
            Log In
          </h1>
          <p style={{ fontSize: "13px", color: "#888", marginBottom: "28px" }}>
            New here?{" "}
            <Link href="/auth/register" style={{ color: "#dc1e3c", fontWeight: 600, textDecoration: "none" }}>
              Create a free profile
            </Link>
          </p>

          {/* Email */}
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>
              Email Address
            </label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%", padding: "12px 16px",
                border: "1px solid rgba(220,30,60,0.15)",
                borderRadius: "10px", fontSize: "14px",
                color: "#1a0a14", background: "#fff",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: "8px" }}>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{
                  width: "100%", padding: "12px 48px 12px 16px",
                  border: "1px solid rgba(220,30,60,0.15)",
                  borderRadius: "10px", fontSize: "14px",
                  color: "#1a0a14", background: "#fff",
                  outline: "none", boxSizing: "border-box",
                }}
              />
              <button
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#aaa",
                }}
              >
                {showPassword ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          {/* Forgot password */}
          <div style={{ textAlign: "right", marginBottom: "24px" }}>
            <a href="#" style={{ fontSize: "12px", color: "#dc1e3c", textDecoration: "none", fontWeight: 600 }}>
              Forgot password?
            </a>
          </div>

          {/* Error */}
          {error && (
            <div style={{ marginBottom: "16px", padding: "12px 16px", background: "rgba(220,30,60,0.05)", border: "1px solid rgba(220,30,60,0.2)", borderRadius: "10px" }}>
              <p style={{ fontSize: "12px", color: "#dc1e3c", margin: 0 }}>• {error}</p>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: "100%", padding: "14px",
              background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
              color: "#fff",
              borderRadius: "10px", fontSize: "14px", fontWeight: 600,
              border: "none", cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 4px 16px rgba(220,30,60,0.25)",
              transition: "all 0.2s",
            }}
          >
            {loading ? "Signing in…" : "Log In →"}
          </button>



          {/* Footer trust */}
          <div style={{ marginTop: "32px", paddingTop: "20px", borderTop: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
            <p style={{ fontSize: "11px", color: "#ccc" }}>🔒 SSL Secured · GDPR Compliant · UK Registered</p>
          </div>

        </div>
      </div>
      </div>
    </div>
  );
}
