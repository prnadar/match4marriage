"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Flag, Settings, LogOut,
  ChevronRight, Menu, ShieldCheck, X, Wallet, CreditCard,
  Tag, Inbox, Bell, Search, Sparkles,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { ToastProvider } from "@/components/admin/Toast";
import { api, ApiError } from "@/lib/api";
import { firebaseAuth, clearClientState } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// Sectioned nav — gives the sidebar visual hierarchy and matches how admins
// actually think about their work (overview vs day-to-day vs config).
const navSections: Array<{
  label: string;
  items: Array<{ href: string; label: string; icon: any }>;
}> = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard",     label: "Dashboard",     icon: LayoutDashboard },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck },
      { href: "/admin/users",         label: "Users",         icon: Users },
      { href: "/admin/enquiries",     label: "Enquiries",     icon: Inbox },
      { href: "/admin/reports",       label: "Reports",       icon: Flag },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/admin/payments",      label: "Payments",      icon: Wallet },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
      { href: "/admin/pricing",       label: "Pricing",       icon: Tag },
    ],
  },
  {
    label: "Configuration",
    items: [
      { href: "/admin/settings",      label: "Settings",      icon: Settings },
    ],
  },
];

const allItems = navSections.flatMap((s) => s.items);

function titleForPath(pathname: string): string {
  const item = allItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.label || "Admin";
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  // Defence-in-depth: also inject <meta name="robots" content="noindex,nofollow"/>
  // into the admin head client-side. Headers (X-Robots-Tag) are the primary
  // signal — this is a backup for crawlers that ignore them.
  useEffect(() => {
    if (typeof document === "undefined") return;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "robots";
      document.head.appendChild(meta);
    }
    meta.content = "noindex, nofollow, noarchive";
  }, []);

  useEffect(() => {
    if (pathname === "/admin/login") { setAuthenticated(true); return; }
    let cancelled = false;
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (cancelled) return;
      if (!user) { router.replace("/admin/login"); return; }

      // Force a token refresh so the admin custom claims are guaranteed to be
      // on the token — a stale cached token could lack them and read as
      // non-admin. (The login page force-refreshes too; keep them in step.)
      try { await user.getIdToken(true); } catch { /* api layer retries on 401 */ }

      // Verify admin while tolerating transient failures. A network / cold-
      // start error must NOT redirect to /admin/login: the login page would
      // immediately send a signed-in admin back here, and with a full-reload
      // redirect that becomes an infinite loop. Only a *definitive* answer
      // redirects — a successful "not an admin" response, or no user at all.
      for (let attempt = 0; attempt < 3 && !cancelled; attempt++) {
        try {
          const res = await api.get<{ data: { is_admin: boolean; email: string | null } }>("/api/v1/auth/me");
          if (cancelled) return;
          const data = (res.data as any)?.data;
          if (data?.is_admin) {
            setAdminEmail(data?.email || user.email || null);
            setAuthenticated(true);
          } else {
            router.replace("/admin/login");
          }
          return;
        } catch (err) {
          // A 401 means the api layer already handled session expiry (it
          // redirects to /auth/login itself) — stop. Anything else is
          // transient: back off and retry instead of bouncing into a loop.
          if (err instanceof ApiError && err.status === 401) return;
          if (attempt === 2) return; // give up quietly; keep showing the loader
          await new Promise((r) => setTimeout(r, 600 * (attempt + 1)));
        }
      }
    });
    return () => { cancelled = true; unsub(); };
  }, [pathname, router]);

  const handleLogout = async () => {
    try { await signOut(firebaseAuth); } catch {}
    clearClientState();
    router.push("/admin/login");
  };

  const pageTitle = useMemo(() => titleForPath(pathname), [pathname]);

  if (pathname === "/admin/login") return <>{children}</>;

  if (authenticated === null) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: "linear" }}
          className="w-7 h-7 rounded-full border-[2.5px] border-primary/20 border-t-primary"
        />
      </div>
    );
  }

  const initial = (adminEmail || "A")[0]?.toUpperCase() || "A";

  return (
    <ToastProvider>
    <div className="min-h-screen flex bg-background font-body text-foreground">
      {/* ── Mobile backdrop ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[260px] bg-sidebar text-sidebar-foreground flex flex-col",
          "transition-transform duration-200 ease-out",
          // Mobile slide
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-2.5 px-4 border-b border-sidebar-border/60">
          <span className="inline-flex items-center rounded-lg bg-white/95 px-2 py-1 shadow-[0_4px_12px_rgba(0,0,0,0.25)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.jpeg" alt="Match 4 Marriage" className="h-7 w-auto block" />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-sidebar-muted uppercase tracking-[0.16em] font-semibold">Admin Console</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 grid place-items-center text-sidebar-muted hover:text-white transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Nav — sectioned */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted/70">
                {section.label}
              </div>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium",
                          "transition-colors duration-150",
                          active
                            ? "text-white"
                            : "text-sidebar-muted hover:text-white hover:bg-white/5",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="admin-nav-active-bg"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            className="absolute inset-0 bg-gradient-to-r from-sidebar-accent-soft to-transparent rounded-md border border-sidebar-accent/30"
                          />
                        )}
                        {active && (
                          <motion.span
                            layoutId="admin-nav-active-marker"
                            transition={{ type: "spring", stiffness: 380, damping: 30 }}
                            className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-sidebar-accent"
                          />
                        )}
                        <Icon className="relative z-10 w-4 h-4 shrink-0" />
                        <span className="relative z-10">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User pill at bottom */}
        <div className="border-t border-sidebar-border/60 p-3">
          <div className="flex items-center gap-2.5 p-2 rounded-md bg-white/[0.03] hover:bg-white/[0.06] transition-colors">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-rose-700 grid place-items-center text-white text-xs font-semibold shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate" title={adminEmail || ""}>
                {adminEmail || "Admin"}
              </div>
              <div className="text-[10px] text-sidebar-muted">Super admin</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              className="w-7 h-7 rounded-md text-sidebar-muted hover:text-white hover:bg-white/10 grid place-items-center transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div className="flex-1 lg:pl-[260px] flex flex-col min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 flex items-center gap-3 px-4 lg:px-6 bg-background/85 backdrop-blur-md border-b border-border">
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden w-9 h-9 rounded-md hover:bg-secondary grid place-items-center text-foreground"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[12px] text-muted2-foreground/70">Admin</span>
            <ChevronRight className="w-3 h-3 text-muted2-foreground/40 shrink-0" />
            <span className="text-[13px] font-medium text-foreground truncate">{pageTitle}</span>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Quick search (placeholder for now — wired in a follow-up) */}
            <button
              className="hidden md:inline-flex items-center gap-2 h-8 pl-2.5 pr-2 rounded-md bg-secondary/60 hover:bg-secondary border border-border text-[12px] text-muted2-foreground transition-colors"
              title="Search (⌘K)"
              onClick={() => { /* TODO: command palette */ }}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Search</span>
              <kbd className="hidden lg:inline-flex items-center gap-0.5 ml-1 px-1.5 h-5 rounded bg-white border border-border text-[10px] font-medium text-muted2-foreground">⌘K</kbd>
            </button>

            <button
              className="w-8 h-8 rounded-md hover:bg-secondary grid place-items-center text-foreground/70 hover:text-foreground transition-colors relative"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
            </button>

            <Link
              href="/dashboard"
              className="hidden md:inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium text-muted2-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Switch to user view"
            >
              <Sparkles className="w-3.5 h-3.5" />
              User view
            </Link>
          </div>
        </header>

        {/* Content surface */}
        <main className="flex-1 px-4 py-5 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}
