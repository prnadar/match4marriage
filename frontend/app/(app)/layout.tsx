"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Heart, MessageCircle, User, Star, Globe,
  Shield, Bell, Settings, LogOut, ChevronRight, Users, Star as StarIcon,
  CreditCard, Home, Menu, X, AlertTriangle, Mail, MapPin, ArrowRight,
} from "lucide-react";
import { profileApi } from "@/lib/api";
import { clearClientState, firebaseAuth, rememberSessionUid } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import PublicHeader from "@/components/PublicHeader";
import { useProfilePhoto } from "@/lib/profilePhoto";

// Side-nav entries shown to authenticated members. Notification badges are
// omitted until they're wired to real counts — fake numbers erode trust.
// /nri-hub and /family are hidden until those features ship.
const navItems = [
  { href: "/profile/me",   label: "My Profile",   icon: User            },
  { href: "/dashboard",    label: "My Matches",   icon: LayoutDashboard },
  { href: "/matches",      label: "Browse",        icon: Heart           },
  { href: "/interests",    label: "Interests",     icon: Star            },
  { href: "/messages",     label: "Messages",      icon: MessageCircle   },
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
        <span style={{
          flexShrink: 0,
          width: 30, height: 30, borderRadius: "50%",
          background: "rgba(255,212,220,0.18)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
        }}>
          <AlertTriangle style={{ width: 16, height: 16, color: "#ffd4dc" }} strokeWidth={2} />
        </span>
        <p style={{ margin: 0, color: "#fff", fontSize: "14px", lineHeight: 1.5 }}>
          <strong>Complete your profile &amp; verify your ID.</strong> You must complete your profile and verify your identity to view other profiles and send interests.{" "}
          <a href="/profile/me" style={{ color: "#ffd4dc", fontWeight: 700, textDecoration: "underline", display: "inline-flex", alignItems: "center", gap: 3 }}>
            Complete now <ArrowRight size={12} strokeWidth={2.4} />
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
  const [sidebarPlan, setSidebarPlan] = useState<string>("Basic");
  // Same hook PublicHeader uses; keeps the sidebar avatar in lock-step
  // with the top-bar avatar after a primary-photo change.
  const sidebarPhotoUrl = useProfilePhoto();

  // Auth + verification gate. Sends the user back to /onboarding if any
  // of the three required steps is missing:
  //   1. Backend profile bootstrap (first_name set after step 1)
  //   2. Phone verified (Firebase user.phoneNumber populated by step 2)
  //   3. ID uploaded (profile.visa_status === "id_uploaded" after step 3)
  // Per the product brief: dashboard access is only unlocked once all
  // three gates are cleared.
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) { router.replace("/onboarding"); return; }
      rememberSessionUid(user.uid);
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data;
        const hasProfile = !!(p && p.first_name && p.first_name.trim());
        if (!hasProfile) { router.replace("/onboarding"); return; }

        const hasPhone = !!(user.phoneNumber && user.phoneNumber.trim());
        if (!hasPhone) { router.replace("/onboarding"); return; }

        const idUploaded = p?.visa_status === "id_uploaded";
        if (!idUploaded) { router.replace("/onboarding"); return; }
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

      // Resolve current subscription tier — `users.subscription_tier` returns
      // free/silver/gold/platinum; we map that to the plan label users see in
      // /pricing (Basic / Premium / Elite / VIP Concierge). Falls back to
      // "Basic" so the badge isn't blank during the brief load window.
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data ?? res.data;
        const tier = String(p?.subscription_tier || "free").toLowerCase();
        const tierToLabel: Record<string, string> = {
          free: "Basic",
          silver: "Premium",
          gold: "Elite",
          platinum: "VIP Concierge",
        };
        setSidebarPlan(tierToLabel[tier] || "Basic");
      } catch { /* leave default */ }
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
          background:
            "linear-gradient(160deg, #150812 0%, #220e1c 50%, #2e1224 100%)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Soft rose aura — drifts very slowly */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              "radial-gradient(60% 40% at 30% 18%, rgba(220,30,60,0.20) 0%, transparent 70%)," +
              "radial-gradient(50% 35% at 80% 90%, rgba(201,149,74,0.12) 0%, transparent 70%)",
          }}
        />
        {/* Subtle vertical hairline — suggests an editorial column */}
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-full w-px"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.10) 30%, rgba(220,30,60,0.20) 50%, rgba(255,255,255,0.10) 70%, transparent 100%)",
          }}
        />
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
          {/* Brand wordmark removed from the sidebar — the shared
              PublicHeader at the top of the page now owns the brand bar
              across every page (public and authenticated). The burger
              toggle alone is enough here. */}
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
                style={{
                  background: sidebarPhotoUrl
                    ? `url(${sidebarPhotoUrl}) center/cover no-repeat, linear-gradient(135deg,#dc1e3c,#a0153c)`
                    : "linear-gradient(135deg,#dc1e3c,#a0153c)",
                  color: sidebarPhotoUrl ? "transparent" : "#fff",
                }}
              >
                {sidebarPhotoUrl ? "" : (sidebarInitial || "?")}
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
              style={{
                background: sidebarPhotoUrl
                  ? `url(${sidebarPhotoUrl}) center/cover no-repeat, linear-gradient(135deg,#dc1e3c,#a0153c)`
                  : "linear-gradient(135deg,#dc1e3c,#a0153c)",
                color: sidebarPhotoUrl ? "transparent" : "#fff",
              }}
            >{sidebarPhotoUrl ? "" : (sidebarInitial || "?")}</div>
          </div>
        )}

        {/* Current plan badge — reflects the user's actual subscription_tier
            (Basic, Premium, Elite, VIP). The Basic tier is the default for
            new accounts (free for the first 3 months per /pricing). */}
        {!collapsed && (
          <div className="px-4 pt-3">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(220,30,60,0.10)", border: "1px solid rgba(220,30,60,0.25)" }}
            >
              <StarIcon className="w-3 h-3" style={{ color: "#dc1e3c", fill: "#dc1e3c" }} />
              <span className="text-xs font-bold" style={{ color: "#ffd4dc" }}>{sidebarPlan} Plan</span>
              <span className="ml-auto text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>Active</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
            const badge: number | undefined = undefined;
            return (
              <Link
                key={href}
                href={href}
                title={collapsed ? label : undefined}
                className="relative group"
                style={{
                  minHeight: "auto",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: collapsed ? "center" : "flex-start",
                  gap: "12px",
                  padding: collapsed ? "10px" : "10px 12px",
                  borderRadius: "12px",
                  fontSize: "13.5px",
                  fontWeight: 500,
                  letterSpacing: "0.005em",
                  transition: "background 0.18s ease, color 0.18s ease",
                  background: active
                    ? "linear-gradient(95deg, rgba(220,30,60,0.32) 0%, rgba(220,30,60,0.18) 50%, rgba(220,30,60,0.06) 100%)"
                    : "transparent",
                  color: active ? "#ffffff" : "rgba(255,255,255,0.62)",
                  textDecoration: "none",
                  boxShadow: active
                    ? "inset 0 1px 0 rgba(255,255,255,0.10), 0 6px 18px rgba(220,30,60,0.18)"
                    : "none",
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
              >
                {/* Active-state vertical accent on the left edge */}
                {active && !collapsed && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: -2, top: 8, bottom: 8,
                      width: 3, borderRadius: 4,
                      background: "linear-gradient(to bottom, #dc1e3c, #ffd87a)",
                      boxShadow: "0 0 12px rgba(220,30,60,0.55)",
                    }}
                  />
                )}
                <Icon
                  className="w-4 h-4 flex-shrink-0 transition-colors"
                  style={{ color: active ? "#ffd6dd" : "rgba(255,255,255,0.55)" }}
                />
                {!collapsed && <span className="flex-1 truncate">{label}</span>}
                {!collapsed && badge !== undefined && (
                  <span
                    className="text-[10px] font-bold text-white rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg,#dc1e3c,#7d0a35)",
                      boxShadow: "0 4px 10px rgba(220,30,60,0.45)",
                    }}
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
            { href: "/notifications", label: "Notifications", icon: Bell     },
            { href: "/settings",      label: "Settings",      icon: Settings },
            { href: "/",              label: "Home",          icon: Home     },
          ].map(({ href, label, icon: Icon }) => {
            const badge: number | undefined = undefined;
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
        {/* Shared brand bar — same component the public site uses. It detects
            Firebase auth state and renders Bell / Messages / Avatar in place
            of the Log In / Register CTAs, so authenticated and anonymous
            visitors see one consistent top bar everywhere. */}
        <PublicHeader />

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
                <a href="mailto:enquiry@match4marriage.com" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: 6 }}>
                  <Mail style={{ width: 13, height: 13 }} strokeWidth={1.6} /> enquiry@match4marriage.com
                </a>
              </div>
            </div>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
                © {new Date().getFullYear()} Match4Marriage. All rights reserved.
              </p>
              <p style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
                Made with <Heart style={{ width: 12, height: 12, color: "#dc1e3c", fill: "#dc1e3c" }} /> for love
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
