"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Flag, Settings, LogOut, Heart,
  ChevronLeft, ChevronRight, Menu, ShieldCheck, X,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { ToastProvider } from "@/components/admin/Toast";
import { api } from "@/lib/api";
import { firebaseAuth, clearClientState } from "@/lib/firebase";

const navItems = [
  { href: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
  { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck },
  { href: "/admin/users",         label: "Users",         icon: Users },
  { href: "/admin/reports",       label: "Reports",       icon: Flag },
  { href: "/admin/settings",      label: "Settings",      icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    if (pathname === "/admin/login") {
      setAuthenticated(true);
      return;
    }

    let cancelled = false;
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (cancelled) return;
      if (!user) { router.replace("/admin/login"); return; }
      try {
        const res = await api.get<{ data: { is_admin: boolean; email: string | null } }>("/api/v1/auth/me");
        const data = (res.data as any)?.data;
        const isAdmin = data?.is_admin === true;
        if (cancelled) return;
        if (!isAdmin) { router.replace("/admin/login"); return; }
        setAdminEmail(data?.email || user.email || null);
        setAuthenticated(true);
      } catch {
        if (!cancelled) router.replace("/admin/login");
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [pathname, router]);

  const handleLogout = async () => {
    try { await signOut(firebaseAuth); } catch {}
    clearClientState();
    router.push("/admin/login");
  };

  if (pathname === "/admin/login") return <>{children}</>;

  if (authenticated === null) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #fdfbf9 0%, #fbf6ef 100%)",
        display: "grid", placeItems: "center",
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          style={{
            width: 28, height: 28, borderRadius: "50%",
            border: "2.5px solid rgba(220,30,60,0.18)",
            borderTopColor: "#dc1e3c",
          }}
        />
      </div>
    );
  }

  const sidebarWidth = collapsed ? 76 : 264;
  const initial = (adminEmail || "A")[0]?.toUpperCase() || "A";

  return (
    <div style={{ minHeight: "100vh", display: "flex", fontFamily: "var(--font-poppins, sans-serif)" }}>
      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
            style={{
              position: "fixed", inset: 0, background: "rgba(26,10,20,0.5)",
              backdropFilter: "blur(4px)", zIndex: 40,
            }}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside
        className={mobileOpen ? "m4m-sidebar-open" : "m4m-sidebar-closed"}
        style={{
          position: "fixed", top: 0, left: 0, height: "100%", zIndex: 50,
          width: sidebarWidth,
          background: "linear-gradient(180deg, #1a0a14 0%, #2d0f20 60%, #3b1428 100%)",
          borderRight: "1px solid rgba(255,255,255,0.04)",
          display: "flex", flexDirection: "column",
          transition: "width 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1)",
          boxShadow: "0 0 40px rgba(0,0,0,0.14)",
        }}
      >
        {/* Ambient glow at top */}
        <div aria-hidden style={{
          position: "absolute", top: -60, left: -40, width: 240, height: 240, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(220,30,60,0.35), transparent 70%)",
          filter: "blur(40px)", pointerEvents: "none",
        }} />

        {/* Logo */}
        <div style={{
          padding: "16px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex", alignItems: "center", gap: 10,
          position: "relative", zIndex: 1,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
            display: "grid", placeItems: "center",
            boxShadow: "0 6px 16px rgba(220,30,60,0.35)",
            flexShrink: 0,
          }}>
            <Heart style={{ width: 16, height: 16, color: "#fff" }} fill="#fff" />
          </div>
          {!collapsed && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: 16, fontWeight: 700, color: "#fff",
                whiteSpace: "nowrap", letterSpacing: "-0.01em",
                flex: 1,
              }}
            >
              M4M Admin
            </motion.span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="lg:block hidden"
            style={{
              background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8,
              color: "rgba(255,255,255,0.55)", cursor: "pointer",
              width: 28, height: 28, display: "grid", placeItems: "center",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; e.currentTarget.style.color = "#fff"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.55)"; }}
          >
            {collapsed ? <ChevronRight style={{ width: 14, height: 14 }} /> : <ChevronLeft style={{ width: 14, height: 14 }} />}
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
            style={{
              background: "rgba(255,255,255,0.05)", border: "none", borderRadius: 8,
              color: "rgba(255,255,255,0.55)", cursor: "pointer",
              width: 28, height: 28, display: "grid", placeItems: "center",
            }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        </div>

        {/* Admin pill */}
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ padding: "14px 16px", position: "relative", zIndex: 1 }}
          >
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "10px 12px",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              backdropFilter: "blur(10px)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                display: "grid", placeItems: "center",
                color: "#fff", fontSize: 13, fontWeight: 700,
                flexShrink: 0,
              }}>
                {initial}
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: 12, fontWeight: 600, color: "#fff",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }} title={adminEmail || ""}>
                  {adminEmail || "Admin"}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: "#ff98ae",
                  textTransform: "uppercase", letterSpacing: "0.08em",
                }}>
                  Admin panel
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Nav */}
        <nav
          data-admin-scroll
          style={{
            flex: 1, padding: "6px 10px", display: "flex", flexDirection: "column", gap: 2,
            overflowY: "auto", position: "relative", zIndex: 1,
          }}
        >
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                style={{ textDecoration: "none", position: "relative" }}
              >
                <div style={{
                  position: "relative",
                  display: "flex", alignItems: "center", gap: 12,
                  padding: collapsed ? "10px" : "10px 12px",
                  borderRadius: 10,
                  color: isActive ? "#fff" : "rgba(255,255,255,0.6)",
                  fontSize: 13, fontWeight: 500,
                  transition: "color 180ms, background 180ms",
                  justifyContent: collapsed ? "center" : "flex-start",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(255,255,255,0.85)"; } }}
                onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; } }}
                >
                  {isActive && (
                    <motion.span
                      layoutId="admin-nav-active"
                      transition={{ type: "spring", stiffness: 350, damping: 30 }}
                      style={{
                        position: "absolute", inset: 0,
                        background: "linear-gradient(135deg, rgba(220,30,60,0.26), rgba(160,21,60,0.22))",
                        border: "1px solid rgba(255,140,165,0.3)",
                        borderRadius: 10,
                        boxShadow: "0 4px 18px rgba(220,30,60,0.3), inset 0 0 20px rgba(255,140,165,0.12)",
                        zIndex: 0,
                      }}
                    />
                  )}
                  <Icon style={{ width: 15, height: 15, flexShrink: 0, position: "relative", zIndex: 1 }} />
                  {!collapsed && (
                    <span style={{ flex: 1, whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>
                      {label}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom — Sign Out */}
        <div style={{
          padding: "10px 10px 14px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          position: "relative", zIndex: 1,
        }}>
          <button
            onClick={handleLogout}
            title={collapsed ? "Sign Out" : undefined}
            style={{
              width: "100%",
              display: "flex", alignItems: "center", gap: 12,
              padding: collapsed ? "10px" : "10px 12px",
              background: "transparent",
              border: "1px solid transparent",
              borderRadius: 10,
              color: "rgba(255,100,120,0.75)", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
              justifyContent: collapsed ? "center" : "flex-start",
              transition: "all 180ms",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,80,100,0.1)"; e.currentTarget.style.color = "#ff758a"; e.currentTarget.style.borderColor = "rgba(255,80,100,0.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(255,100,120,0.75)"; e.currentTarget.style.borderColor = "transparent"; }}
          >
            <LogOut style={{ width: 15, height: 15, flexShrink: 0 }} />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="lg:hidden"
        style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 56, zIndex: 30,
          background: "rgba(253,251,249,0.85)", backdropFilter: "blur(12px)",
          borderBottom: "1px solid rgba(26,10,20,0.06)",
          display: "flex", alignItems: "center", padding: "0 16px", gap: 10,
        }}
      >
        <button
          onClick={() => setMobileOpen(true)}
          style={{
            background: "rgba(26,10,20,0.04)", border: "none", borderRadius: 8,
            width: 34, height: 34, display: "grid", placeItems: "center",
            color: "#1a0a14", cursor: "pointer",
          }}
        >
          <Menu style={{ width: 16, height: 16 }} />
        </button>
        <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 16, fontWeight: 700, color: "#1a0a14" }}>
          M4M Admin
        </span>
      </div>

      {/* Main */}
      <main
        style={{
          flex: 1, minHeight: "100vh",
          paddingTop: 0,
          transition: "margin-left 220ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
        className="m4m-admin-main"
      >
        <ToastProvider>
          {children}
        </ToastProvider>
      </main>

      <style jsx>{`
        @media (min-width: 1024px) {
          :global(.m4m-sidebar-closed) {
            transform: translateX(0) !important;
          }
          :global(.m4m-admin-main) {
            margin-left: ${sidebarWidth}px;
          }
        }
        @media (max-width: 1023px) {
          :global(.m4m-sidebar-closed) {
            transform: translateX(-100%);
          }
          :global(.m4m-sidebar-open) {
            transform: translateX(0);
          }
          :global(.m4m-admin-main) {
            padding-top: 56px;
          }
        }
      `}</style>
    </div>
  );
}
