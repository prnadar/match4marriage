"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence, MotionConfig } from "framer-motion";
import {
  LayoutDashboard, Users, Flag, Settings, LogOut,
  ChevronRight, Menu, ShieldCheck, X, Wallet, CreditCard,
  Tag, Inbox, Search, Sparkles, HeartHandshake, MessagesSquare,
  ScrollText, PanelLeftClose, PanelLeftOpen,
  FileCheck2, FileLock2, BookHeart, Plug,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { ToastProvider } from "@/components/admin/Toast";
import NotificationBell from "@/components/admin/NotificationBell";
import CommandPalette, { type PaletteNavItem } from "@/components/admin/CommandPalette";
import { Kbd } from "@/components/admin/primitives";
import { api, ApiError, adminOpsApi } from "@/lib/api";
import { firebaseAuth, clearClientState } from "@/lib/firebase";
import { cn } from "@/lib/utils";

type BadgeKey = "pending_verifications" | "open_reports" | "new_enquiries";
type NavItem = {
  href: string; label: string; icon: any; badge?: BadgeKey; keywords?: string;
  /** Single-key shortcut after pressing G. */
  g?: string;
};

// Sectioned by how a bureau actually works: the daily queues first, then the
// people work, then money, then the compliance record, then the system.
const navSections: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [
      { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, g: "d", keywords: "home kpi stats overview today" },
    ],
  },
  {
    label: "Queues",
    items: [
      { href: "/admin/verifications", label: "Verifications", icon: ShieldCheck, badge: "pending_verifications", g: "v", keywords: "approve review queue id documents" },
      { href: "/admin/enquiries",     label: "Enquiries",     icon: Inbox,       badge: "new_enquiries",         g: "e", keywords: "contact leads questions inbox" },
      { href: "/admin/reports",       label: "Reports",       icon: Flag,        badge: "open_reports",          g: "r", keywords: "abuse safety flagged moderation" },
    ],
  },
  {
    label: "Members",
    items: [
      { href: "/admin/users",           label: "Users",           icon: Users,          g: "u", keywords: "members people crm" },
      { href: "/admin/matchmaking",     label: "Matchmaking",     icon: HeartHandshake, g: "m", keywords: "suggest match introduce compatibility" },
      { href: "/admin/communications",  label: "Communications",  icon: MessagesSquare, g: "c", keywords: "email message broadcast contact follow-up" },
      { href: "/admin/success-stories", label: "Success stories", icon: BookHeart,      keywords: "testimonials couples weddings engaged married" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/admin/payments",      label: "Payments",      icon: Wallet,     g: "p", keywords: "transactions money gbp" },
      { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard, g: "s", keywords: "plans renewals members paid" },
      { href: "/admin/pricing",       label: "Pricing",       icon: Tag,        keywords: "plans basic premium elite price" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { href: "/admin/consents",      label: "Consents",      icon: FileCheck2, keywords: "gdpr consent records privacy terms marketing 18+" },
      { href: "/admin/data-requests", label: "Data requests", icon: FileLock2,  keywords: "gdpr dsar subject access erasure export delete my data" },
      { href: "/admin/audit-log",     label: "Audit log",     icon: ScrollText, g: "l", keywords: "history actions who changed" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/admin/integrations", label: "Integrations", icon: Plug,     keywords: "connections api keys webhooks email sms whatsapp services status" },
      { href: "/admin/settings",     label: "Settings",     icon: Settings, keywords: "site admins mail seo appearance gateway" },
    ],
  },
];

const allItems = navSections.flatMap((s) => s.items.map((i) => ({ ...i, section: s.label })));

function titleForPath(pathname: string): string {
  const item = allItems.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  return item?.label || "Admin";
}

const COLLAPSE_KEY = "m4m-admin-sidebar-collapsed";

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  return t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [gPending, setGPending] = useState(false);
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [counts, setCounts] = useState<Partial<Record<BadgeKey | "overdue_verifications", number>>>({});
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    try { setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1"); } catch { /* ignore */ }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try { localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1"); } catch { /* ignore */ }
      return !c;
    });
  };

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

  // ── Sidebar badge counts: on load, every 60s, on focus, and whenever a page
  //    signals that it changed something (window event "admin:counts-refresh").
  const loadCounts = useCallback(async () => {
    try {
      const res = await adminOpsApi.navCounts();
      const d = (res.data as any)?.data;
      if (d) setCounts(d);
    } catch { /* badges are best-effort */ }
  }, []);
  useEffect(() => {
    if (!authenticated || pathname === "/admin/login") return;
    loadCounts();
    const id = setInterval(loadCounts, 60_000);
    const onFocus = () => loadCounts();
    window.addEventListener("focus", onFocus);
    window.addEventListener("admin:counts-refresh", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("admin:counts-refresh", onFocus);
    };
  }, [authenticated, pathname, loadCounts]);

  // ── Global keyboard: ⌘K / Ctrl+K / "/" palette, "G then <key>" navigation.
  useEffect(() => {
    if (pathname === "/admin/login") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (paletteOpen || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); return; }
      if (gPending) {
        const target = allItems.find((i) => i.g === e.key.toLowerCase());
        setGPending(false);
        if (gTimer.current) clearTimeout(gTimer.current);
        if (target) { e.preventDefault(); router.push(target.href); }
        return;
      }
      if (e.key === "g") {
        setGPending(true);
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => setGPending(false), 1200);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pathname, paletteOpen, gPending, router]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleLogout = async () => {
    try { await signOut(firebaseAuth); } catch {}
    clearClientState();
    router.push("/admin/login");
  };

  const pageTitle = useMemo(() => titleForPath(pathname), [pathname]);
  const paletteItems: PaletteNavItem[] = useMemo(
    () => allItems.map((i) => ({ href: i.href, label: i.label, icon: i.icon, keywords: i.keywords, section: i.section })),
    [],
  );

  if (pathname === "/admin/login") return <>{children}</>;

  if (authenticated === null) {
    return (
      <div className="admin-console grid min-h-screen place-items-center bg-background font-body" role="status" aria-live="polite">
        <div className="flex flex-col items-center gap-3">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden />
          <span className="text-[12.5px] text-muted2-foreground">Checking your admin access…</span>
        </div>
      </div>
    );
  }

  const initial = (adminEmail || "A")[0]?.toUpperCase() || "A";
  const railW = collapsed ? 68 : 248;

  return (
    <MotionConfig reducedMotion="user">
    <ToastProvider>
    <div className="admin-console min-h-screen flex bg-background font-body text-foreground">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[120] focus:rounded-lg focus:bg-card focus:px-3 focus:py-2 focus:text-[13px] focus:font-medium focus:text-foreground focus:shadow-[var(--adm-shadow-pop)] focus:outline-none focus:ring-2 focus:ring-ring/50"
      >
        Skip to content
      </a>
      {/* ── Mobile backdrop ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-[#0b0509]/60"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside
        aria-label="Admin navigation"
        className={cn(
          "adm-rail fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.08] text-white",
          "transition-[transform,width] duration-200 ease-out",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "lg:translate-x-0",
          // Mobile drawer is always full-width nav; the rail only applies ≥lg.
          "w-[264px]",
          collapsed ? "lg:w-[68px]" : "lg:w-[248px]",
        )}
      >
        {/* Logo */}
        <div className={cn("h-14 flex shrink-0 items-center gap-2.5 border-b border-white/[0.08]", collapsed ? "lg:justify-center lg:px-0 px-4" : "px-4")}>
          <span className={cn("inline-flex items-center rounded-md bg-white/95 px-1.5 py-1", collapsed && "lg:px-1")}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Match 4 Marriage" className={cn("block w-auto", collapsed ? "h-6 lg:h-5" : "h-6")} />
          </span>
          <div className={cn("flex-1 min-w-0", collapsed && "lg:hidden")}>
            <div className="adm-kicker">Admin console</div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="lg:hidden w-9 h-9 rounded-md hover:bg-white/10 grid place-items-center text-white/70 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd4dc]/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search trigger in the rail */}
        <div className={cn("px-3 pt-3", collapsed && "lg:px-2")}>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            title="Search (⌘K)"
            aria-label="Open search"
            className={cn(
              "flex h-9 w-full items-center gap-2 rounded-md border border-white/[0.12] bg-white/[0.04] px-2.5 text-[12.5px] text-white/65",
              "transition-colors hover:bg-white/[0.07] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd4dc]/70",
              collapsed && "lg:justify-center lg:px-0",
            )}
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className={cn("flex-1 text-left", collapsed && "lg:hidden")}>Search…</span>
            <span className={cn("rounded border border-white/[0.14] px-1 text-[10px] text-white/60", collapsed && "lg:hidden")}>⌘K</span>
          </button>
        </div>

        {/* Nav — sectioned */}
        <nav data-admin-rail-scroll className={cn("flex-1 overflow-y-auto py-3.5 px-3 space-y-4", collapsed && "lg:px-2 lg:space-y-3")}>
          {navSections.map((section) => (
            <div key={section.label}>
              <div className={cn("adm-kicker px-2.5 pb-1", collapsed && "lg:hidden")}>
                {section.label}
              </div>
              {collapsed && <div aria-hidden className="mx-2 mb-2 hidden h-px bg-[rgba(201,149,74,0.28)] lg:block" />}
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  const Icon = item.icon;
                  const count = item.badge ? counts[item.badge] || 0 : 0;
                  const urgent = item.badge === "pending_verifications" && (counts.overdue_verifications || 0) > 0;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={collapsed ? `${item.label}${count ? ` · ${count}` : ""}` : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex min-h-[32px] items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium",
                          "transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd4dc]/70",
                          active ? "text-white" : "text-white/65 hover:text-white hover:bg-white/[0.04]",
                          collapsed && "lg:justify-center lg:px-0",
                        )}
                      >
                        {active && (
                          <motion.span
                            layoutId="admin-nav-active-bg"
                            transition={{ type: "spring", stiffness: 500, damping: 40 }}
                            className="absolute inset-0 rounded-md bg-white/[0.06] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.07)]"
                          >
                            {/* the rose marker: same active signal as the member shell */}
                            <span aria-hidden className="absolute bottom-[6px] left-0 top-[6px] w-[2px] rounded-full bg-[#dc1e3c]" />
                          </motion.span>
                        )}
                        <Icon className={cn("relative z-10 h-4 w-4 shrink-0 transition-colors", active ? "text-[#ff8aa3]" : "opacity-80 group-hover:opacity-100")} strokeWidth={1.75} aria-hidden />
                        <span className={cn("relative z-10 flex-1 truncate", collapsed && "lg:hidden")}>{item.label}</span>
                        {count > 0 && (
                          <span
                            aria-label={`${count} ${item.badge === "pending_verifications" ? "pending" : item.badge === "open_reports" ? "open" : "new"}`}
                            className={cn(
                              "relative z-10 min-w-[20px] rounded-full px-1.5 text-center text-[10.5px] font-semibold tabular-nums leading-[18px]",
                              urgent || item.badge === "open_reports" ? "bg-[#dc1e3c] text-white" : "bg-white/[0.12] text-white",
                              collapsed && "lg:absolute lg:-right-0.5 lg:-top-0.5 lg:min-w-[16px] lg:px-1 lg:text-[9.5px] lg:leading-[15px]",
                            )}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Collapse toggle (desktop) */}
        <div className="hidden shrink-0 border-t border-white/[0.08] px-3 py-2 lg:block">
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[12px] text-white/60 transition-colors hover:bg-white/[0.05] hover:text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd4dc]/70",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </button>
        </div>

        {/* User pill at bottom */}
        <div className={cn("shrink-0 border-t border-white/[0.08] p-3", collapsed && "lg:p-2")}>
          <div className={cn("flex items-center gap-2.5 rounded-md p-1.5", collapsed && "lg:flex-col lg:gap-1.5")}>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/[0.06] text-xs font-semibold text-[#f3c9a8] shadow-[0_0_0_1px_rgba(201,149,74,0.5)]" title={adminEmail || ""}>
              {initial}
            </div>
            <div className={cn("min-w-0 flex-1", collapsed && "lg:hidden")}>
              <div className="truncate text-[12px] font-medium" title={adminEmail || ""}>
                {adminEmail || "Admin"}
              </div>
              <div className="text-[11px] text-white/60">Administrator</div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
              className="grid h-8 w-8 place-items-center rounded-md text-white/65 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd4dc]/70"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────── */}
      <div
        className="flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out lg:pl-[var(--rail)]"
        style={{ ["--rail" as any]: `${railW}px` }}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur-sm sm:gap-3 sm:px-4 lg:px-8">
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            className="lg:hidden w-10 h-10 -ml-1 rounded-md hover:bg-secondary grid place-items-center text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Menu className="w-[18px] h-[18px]" />
          </button>

          {/* Breadcrumb */}
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            <Link href="/admin/dashboard" className="hidden rounded text-[12.5px] text-muted2-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 sm:inline">Admin</Link>
            <ChevronRight className="hidden h-3 w-3 shrink-0 text-muted2-foreground/50 sm:block" aria-hidden />
            <span className="truncate text-[13px] font-medium text-foreground" aria-current="page">{pageTitle}</span>
          </nav>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              className="hidden h-8 items-center gap-2 rounded-md border border-border bg-card pl-2.5 pr-1.5 text-[12.5px] text-muted2-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:inline-flex"
              title="Search members, enquiries and pages (⌘K)"
              onClick={() => setPaletteOpen(true)}
            >
              <Search className="h-3.5 w-3.5" aria-hidden />
              <span className="w-40 text-left lg:w-56">Search members…</span>
              <Kbd>⌘K</Kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="grid h-10 w-10 place-items-center rounded-md text-foreground hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:hidden"
            >
              <Search className="h-4 w-4" />
            </button>

            <NotificationBell />

            <Link
              href="/dashboard"
              className="hidden h-8 items-center gap-1.5 rounded-md px-3 text-[12.5px] font-medium text-muted2-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 md:inline-flex"
              title="Switch to the member-facing app"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Member view
            </Link>
          </div>
        </header>

        {/* Content surface */}
        <main id="admin-main" tabIndex={-1} className="flex-1 px-4 py-5 focus:outline-none lg:px-8 lg:py-7">
          {children}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} navItems={paletteItems} />

      {/* "G then…" hint */}
      <AnimatePresence>
        {gPending && (
          <motion.div
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.15 }}
            role="status"
            className="fixed bottom-4 left-1/2 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg border border-border bg-card px-3 py-2 text-[12px] text-muted2-foreground shadow-[var(--adm-shadow-pop)]"
          >
            <span className="font-medium text-foreground">Go to</span>
            {allItems.filter((i) => i.g).map((i) => (
              <span key={i.href} className="inline-flex items-center gap-1 whitespace-nowrap">
                <Kbd>{i.g!.toUpperCase()}</Kbd> {i.label}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </ToastProvider>
    </MotionConfig>
  );
}
