"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Heart, MessageCircle, User, Star, Globe,
  Shield, Bell, Settings, LogOut, ChevronRight, Users, Star as StarIcon,
  CreditCard, Home, Menu, X,
} from "lucide-react";
import { profileApi } from "@/lib/api";
import { clearClientState, firebaseAuth, rememberSessionUid } from "@/lib/firebase";
import { signOut } from "firebase/auth";

const navItems = [
  { href: "/profile/me",   label: "My Profile",   icon: User            },
  { href: "/dashboard",    label: "My Matches",   icon: LayoutDashboard },
  { href: "/matches",      label: "Browse",        icon: Heart           },
  { href: "/interests",    label: "Interests",     icon: Star, badge: 6  },
  { href: "/messages",     label: "Messages",      icon: MessageCircle, badge: 3 },
  { href: "/nri-hub",      label: "NRI Hub",       icon: Globe           },
  { href: "/family",       label: "Family Mode",   icon: Users           },
  { href: "/subscription", label: "Subscription",  icon: CreditCard      },
];

function VerificationBanner() {
  const [verified, setVerified] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data;
        setVerified(!!(p && p.completeness_score >= 60));
      } catch {
        setVerified(false);
      }
    })();
  }, []);

  if (verified || dismissed) return null;

  return (
    <div style={{
      background: "linear-gradient(135deg, #1a0a14 0%, #2d0f20 60%, #3b1428 100%)",
      padding: "12px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "16px",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "18px" }}>⚠️</span>
        <p style={{ margin: 0, color: "#fff", fontSize: "14px", lineHeight: 1.5 }}>
          <strong>Complete your profile &amp; verify your ID.</strong> You must complete your profile and verify your identity to view other profiles and send interests.{" "}
          <a href="/profile/me" style={{ color: "#ffd4dc", fontWeight: 700, textDecoration: "underline" }}>
            Complete now →
          </a>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        style={{ background: "none", border: "none", color: "rgba(255,255,255,0.7)", cursor: "pointer", fontSize: "18px", flexShrink: 0, padding: "0 4px" }}
        aria-label="Dismiss"
      >×</button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [sidebarName, setSidebarName] = useState("");
  const [sidebarInitial, setSidebarInitial] = useState("");
  const [sidebarTrustScore, setSidebarTrustScore] = useState<number | null>(null);

  // Auth guard: if Firebase says no user, send to onboarding.
  // If user exists but has no backend profile, also send to onboarding.
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) { router.replace("/onboarding"); return; }
      rememberSessionUid(user.uid);
      const hasPassword = user.providerData.some((p) => p.providerId === "password");
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data;
        const hasProfile = !!(p && p.first_name && p.first_name.trim());
        if (!hasProfile) { router.replace("/onboarding"); return; }
        // Existing user with no password → prompt them to set one, but only once per session.
        if (!hasPassword && !sessionStorage.getItem("skip_password_prompt")) {
          sessionStorage.setItem("skip_password_prompt", "1");
          router.replace("/auth/setup-password");
        }
      } catch {
        // backend unreachable — leave user on page
      }
    });
    return unsub;
  }, [router]);

  useEffect(() => {
    async function loadSidebar() {
      let resolvedName = "";
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data ?? res.data;
        resolvedName = p?.first_name
          ? `${p.first_name}${p.last_name ? ` ${p.last_name.charAt(0)}.` : ""}`
          : "";
      } catch { /* ignore */ }

      if (resolvedName) {
        setSidebarName(resolvedName);
        setSidebarInitial(resolvedName.charAt(0).toUpperCase());
      }

      try {
        const res = await profileApi.getTrustScore();
        const d = (res.data as any)?.data ?? res.data;
        if (d?.total !== undefined) setSidebarTrustScore(d.total);
        else if (d?.trust_score !== undefined) setSidebarTrustScore(d.trust_score);
      } catch { /* ignore */ }
    }
    loadSidebar();
  }, [pathname]);

  const sidebarWidth = collapsed ? "72px" : "256px";

  return (
    <div className="min-h-screen flex" style={{ background: "#fdfbf9" }}>
      {/* ── Sidebar ── */}
      <aside
        className="fixed top-0 left-0 h-full z-40 flex flex-col transition-all duration-300"
        style={{
          width: sidebarWidth,
          background: "linear-gradient(160deg, #1a0a14 0%, #2d0f20 60%, #3b1428 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Burger / Close toggle — replaces logo */}
        <div className="flex items-center px-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)", height: "60px", flexShrink: 0 }}>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center rounded-xl transition-colors"
            style={{
              width: "36px", height: "36px", flexShrink: 0,
              color: "rgba(255,255,255,0.7)",
              background: "transparent",
              border: "none", cursor: "pointer",
            }}
            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.08)"}
            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = "transparent"}
          >
            {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
          </button>
          {!collapsed && (
            <Link href="/dashboard" style={{ textDecoration: "none", marginLeft: "10px", display: "flex", alignItems: "center", minHeight: "auto" }}>
              <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "15px", fontWeight: 700, color: "#fff", whiteSpace: "nowrap" }}>
                Match4Marriage
              </span>
            </Link>
          )}
        </div>

        {/* Profile mini */}
        {!collapsed && (
          <div className="px-4 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <Link href="/profile/me" className="flex items-center gap-3 p-2 rounded-xl cursor-pointer transition-colors" style={{ minHeight: "auto" }}
              onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.background = "transparent"}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-sm flex-shrink-0"
                style={{ background: "linear-gradient(135deg,#dc1e3c,#a0153c)" }}
              >
                {sidebarInitial || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "#ffffff" }}>{sidebarName || "My Profile"}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Shield className="w-3 h-3" style={{ color: "#8DB870" }} />
                  <span className="text-xs font-medium" style={{ color: "#8DB870" }}>Trust Score: {sidebarTrustScore ?? "–"}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.25)" }} />
            </Link>
          </div>
        )}

        {/* Collapsed avatar */}
        {collapsed && (
          <div className="flex justify-center py-3 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm"
              style={{ background: "linear-gradient(135deg,#dc1e3c,#a0153c)" }}
            >{sidebarInitial || "?"}</div>
          </div>
        )}

        {/* Gold plan badge */}
        {!collapsed && (
          <div className="px-4 pt-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(200,144,32,0.12)", border: "1px solid rgba(200,144,32,0.25)" }}
            >
              <StarIcon className="w-3 h-3" style={{ color: "#C89020", fill: "#C89020" }} />
              <span className="text-xs font-bold" style={{ color: "#C89020" }}>Gold Plan</span>
              <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Active</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  minHeight: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: "12px",
                  padding: collapsed ? "10px" : "10px 12px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.15s ease",
                  background: active ? "rgba(220,30,60,0.20)" : "transparent",
                  color: active ? "#ffffff" : "rgba(255,255,255,0.55)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && badge !== undefined && (
                  <span
                    className="text-[10px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#dc1e3c,#a0153c)" }}
                  >
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="px-2 py-4 space-y-0.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { href: "/notifications", label: "Notifications", icon: Bell,     badge: 2 },
            { href: "/settings",      label: "Settings",      icon: Settings          },
            { href: "/",              label: "Home",           icon: Home               },
          ].map(({ href, label, icon: Icon, badge }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                style={{
                  minHeight: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: "12px",
                  padding: collapsed ? "10px" : "10px 12px",
                  borderRadius: "12px",
                  fontSize: "14px",
                  fontWeight: "500",
                  transition: "all 0.15s ease",
                  background: active ? "rgba(220,30,60,0.20)" : "transparent",
                  color: active ? "#ffffff" : "rgba(255,255,255,0.55)",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                <Icon className="w-4 h-4" />
                {!collapsed && <span className="flex-1">{label}</span>}
                {!collapsed && badge !== undefined && (
                  <span className="text-[10px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center" style={{ background: "#dc1e3c" }}>
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
          <button
            onClick={async () => {
              try { await signOut(firebaseAuth); } catch {}
              clearClientState();
              window.location.href = "/auth/login";
            }}
            title={collapsed ? "Sign Out" : undefined}
            className="w-full flex items-center rounded-xl text-sm transition-colors"
            style={{
              justifyContent: collapsed ? "center" : "flex-start",
              gap: "12px",
              padding: collapsed ? "10px" : "10px 12px",
              color: "rgba(255,100,100,0.7)",
              background: "transparent",
              border: "none", cursor: "pointer",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "#ff6b6b"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,80,80,0.08)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,100,100,0.7)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main
        className="flex-1 min-h-screen flex flex-col transition-all duration-300"
        style={{ marginLeft: sidebarWidth, background: "#fdfbf9" }}
      >
        {/* ── Top Header ── */}
        <header style={{
          position: "sticky", top: 0, zIndex: 30,
          background: "rgba(253,251,249,0.92)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(220,30,60,0.10)",
          padding: "0 32px",
          height: "60px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          {/* Brand logo in header */}
          <Link href="/dashboard" style={{ textDecoration: "none", display: "flex", alignItems: "center", minHeight: "auto" }}>
            <img src="/images/logo.jpeg" alt="Match4Marriage" style={{ height: "48px", width: "auto", objectFit: "contain" }} />
          </Link>

          {/* Right side */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
            <Link href="/notifications" style={{ position: "relative", textDecoration: "none", display: "flex", alignItems: "center", color: "#1a0a14", minHeight: "auto" }}>
              <Bell className="w-5 h-5" style={{ color: "rgba(26,10,20,0.55)" }} />
              <span style={{
                position: "absolute", top: "-4px", right: "-6px",
                background: "#dc1e3c", color: "#fff",
                fontSize: "10px", fontWeight: 700,
                width: "16px", height: "16px",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>2</span>
            </Link>
            <Link href="/messages" style={{ position: "relative", textDecoration: "none", display: "flex", alignItems: "center", minHeight: "auto" }}>
              <MessageCircle className="w-5 h-5" style={{ color: "rgba(26,10,20,0.55)" }} />
              <span style={{
                position: "absolute", top: "-4px", right: "-6px",
                background: "#dc1e3c", color: "#fff",
                fontSize: "10px", fontWeight: 700,
                width: "16px", height: "16px",
                borderRadius: "50%",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>3</span>
            </Link>
            <Link href="/profile/me" style={{ textDecoration: "none", minHeight: "auto" }}>
              <div style={{
                width: "34px", height: "34px", borderRadius: "50%",
                background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "13px",
              }}>{sidebarInitial || "?"}</div>
            </Link>
          </div>
        </header>

        {/* ── ID Verification Warning Banner ── */}
        <VerificationBanner />

        {/* ── Page Content ── */}
        <div style={{ flex: 1 }}>
          {children}
        </div>

        {/* ── Footer ── */}
        <footer style={{
          borderTop: "1px solid rgba(220,30,60,0.10)",
          background: "#1a0a14",
          padding: "32px",
        }}>
          <div style={{ maxWidth: "960px", margin: "0 auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "24px", marginBottom: "24px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <Heart className="w-4 h-4" style={{ color: "#dc1e3c" }} />
                  <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "18px", fontWeight: 700, color: "#fff" }}>Match<span style={{ color: "#dc1e3c" }}>4</span>Marriage</span>
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
                  Elite Indian Matrimony<br />United Kingdom
                </p>
              </div>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Quick Links</p>
                {[
                  { label: "My Profile", href: "/profile/me" },
                  { label: "Browse Matches", href: "/matches" },
                  { label: "Messages", href: "/messages" },
                  { label: "Subscription", href: "/subscription" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "6px", minHeight: "auto" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#fff"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)"}
                  >{label}</Link>
                ))}
              </div>
              <div>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "10px" }}>Support</p>
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Settings", href: "/settings" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "6px", minHeight: "auto" }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "#fff"}
                    onMouseLeave={(e) => (e.currentTarget as HTMLAnchorElement).style.color = "rgba(255,255,255,0.45)"}
                  >{label}</Link>
                ))}
                <a href="mailto:enquiry@match4marriage.com" style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "6px" }}>
                  ✉️ enquiry@match4marriage.com
                </a>
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                © {new Date().getFullYear()} Match4Marriage. All rights reserved.
              </p>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                Made with ❤️ for love
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
