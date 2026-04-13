"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, Users, Upload, Image, CreditCard,
  Flag, Settings, LogOut, Heart, ChevronLeft, ChevronRight,
  Menu, UserCheck, Camera, MessageSquare, BarChart3,
  Bell, DollarSign, Handshake,
} from "lucide-react";
import { ToastProvider } from "@/components/admin/Toast";

const navItems = [
  { href: "/admin/dashboard",       label: "Dashboard",      icon: LayoutDashboard },
  { href: "/admin/users",           label: "Users",          icon: Users },
  { href: "/admin/profiles",        label: "Profiles",       icon: UserCheck },
  { href: "/admin/profiles/upload", label: "Upload Profile", icon: Upload },
  { href: "/admin/photos",          label: "Photos",         icon: Camera },
  { href: "/admin/matches",         label: "Matches",        icon: Handshake },
  { href: "/admin/messages",        label: "Messages",       icon: MessageSquare },
  { href: "/admin/subscriptions",   label: "Subscriptions",  icon: CreditCard },
  { href: "/admin/payments",        label: "Payments",       icon: DollarSign },
  { href: "/admin/reports",         label: "Reports",        icon: Flag },
  { href: "/admin/analytics",       label: "Analytics",      icon: BarChart3 },
  { href: "/admin/notifications",   label: "Notifications",  icon: Bell },
  { href: "/admin/settings",        label: "Settings",       icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);

  // Auth guard — skip for login page
  useEffect(() => {
    if (pathname === "/admin/login") {
      setAuthenticated(true);
      return;
    }
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin/login");
    } else {
      setAuthenticated(true);
    }
  }, [pathname, router]);

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_email");
    router.push("/admin/login");
  };

  // Login page — no sidebar
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  if (authenticated === null) {
    return (
      <div className="min-h-screen bg-mesh flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-rose border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const sidebarWidth = collapsed ? "w-[72px]" : "w-64";

  return (
    <div className="min-h-screen bg-mesh flex">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-full z-50 flex flex-col transition-all duration-200 ${sidebarWidth}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0`}
        style={{
          background: "rgba(250,246,238,0.97)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(154,107,0,0.14)",
        }}
      >
        {/* Logo */}
        <div className="px-4 py-4 border-b flex items-center gap-2" style={{ borderColor: "rgba(154,107,0,0.12)" }}>
          <Heart className="w-5 h-5 text-rose fill-rose flex-shrink-0" />
          {!collapsed && (
            <span className="font-display text-lg font-semibold text-deep whitespace-nowrap">
              M4M Admin
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto text-deep/40 hover:text-deep transition-colors hidden lg:block"
            style={{ minHeight: "auto", minWidth: "auto" }}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Admin badge */}
        {!collapsed && (
          <div className="px-4 py-3 border-b" style={{ borderColor: "rgba(154,107,0,0.10)" }}>
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: "rgba(232,66,106,0.07)", border: "1px solid rgba(232,66,106,0.15)" }}
            >
              <span className="font-body text-xs font-bold text-rose">Admin Panel</span>
            </div>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/admin/dashboard" && pathname.startsWith(href) && href !== "/admin/profiles" || pathname === href);
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                style={{ minHeight: "auto" }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "text-rose bg-rose/10"
                    : "text-deep/55 hover:text-deep hover:bg-rose/5"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!collapsed && <span className="flex-1 whitespace-nowrap">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-2 py-4 border-t" style={{ borderColor: "rgba(154,107,0,0.10)" }}>
          <button
            onClick={handleLogout}
            style={{ minHeight: "auto" }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-body text-sm text-deep/40 hover:text-red-500 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {!collapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="fixed top-0 left-0 right-0 h-14 z-30 lg:hidden navbar-glass flex items-center px-4">
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="text-deep"
          style={{ minHeight: "auto", minWidth: "auto" }}
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="ml-3 font-display text-lg font-semibold text-deep">M4M Admin</span>
      </div>

      {/* Main */}
      <main className={`flex-1 min-h-screen transition-all duration-200 ${collapsed ? "lg:ml-[72px]" : "lg:ml-64"} pt-14 lg:pt-0`}>
        <ToastProvider>
          {children}
        </ToastProvider>
      </main>
    </div>
  );
}
