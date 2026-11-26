"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard, Heart, MessageCircle, User, Star, Bell, Settings, LogOut,
  ChevronRight, CreditCard, Home, X, AlertTriangle, Mail, ArrowRight,
  PanelLeftClose, PanelLeftOpen, type LucideIcon,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { profileApi, api, chatApi } from "@/lib/api";
import { clearClientState, firebaseAuth, rememberSessionUid } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import PublicHeader from "@/components/PublicHeader";
import { useProfilePhoto } from "@/lib/profilePhoto";
import { useEntitlements } from "@/lib/useEntitlements";
import * as Sentry from "@sentry/nextjs";
import ConsentPrompt from "@/components/ConsentPrompt";

// Side-nav entries shown to authenticated members, grouped into labelled
// sections. Only real counts get badges (Messages: unread from
// GET /chats/unread-count) — fake numbers erode trust.
// /nri-hub and /family are hidden until those features ship.
// `exact` keeps the original matching rule for the account links (exact path
// only); the rest also match their sub-routes.
type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean };
const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Introductions",
    items: [
      { href: "/dashboard", label: "My Matches", icon: LayoutDashboard },
      { href: "/matches",   label: "Browse",     icon: Heart           },
      { href: "/interests", label: "Interests",  icon: Star            },
      { href: "/messages",  label: "Messages",   icon: MessageCircle   },
    ],
  },
  {
    label: "Membership",
    items: [
      { href: "/profile/me",   label: "My Profile",   icon: User       },
      { href: "/subscription", label: "Subscription", icon: CreditCard },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/notifications", label: "Notifications", icon: Bell,     exact: true },
      { href: "/settings",      label: "Settings",      icon: Settings, exact: true },
    ],
  },
];

// Fixed row geometry (px). Every row in the nav column has an explicit
// height so the active marker's offset can be computed arithmetically and
// animated with a plain transform — no DOM measuring, which would be thrown
// off by the shell's `zoom` scaling.
const NAV_ROW_H = 44;
const NAV_LABEL_H = 40;
const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

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
    <div
      className="flex items-center justify-between gap-3 pl-4 pr-1 sm:pl-6 sm:pr-3 lg:pl-10 lg:pr-7"
      style={{
        background: "#1a0a14",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        flexShrink: 0,
      }}
    >
      <div className="flex items-start gap-3 py-3 min-w-0">
        <AlertTriangle
          aria-hidden
          style={{ width: 16, height: 16, color: "#f3c9a8", flexShrink: 0, marginTop: 3 }}
          strokeWidth={1.6}
        />
        <p style={{ margin: 0, color: "rgba(255,255,255,0.78)", fontSize: "13.5px", lineHeight: 1.55 }}>
          <strong style={{ color: "#fff", fontWeight: 600 }}>Complete your profile.</strong> Members with full profiles get far more interest. Finish yours to get noticed.{" "}
          <a href="/profile/me" style={{ color: "#ffd4dc", fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3, display: "inline-flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
            Complete now <ArrowRight size={12} strokeWidth={2} />
          </a>
        </p>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="m4m-shell-iconbtn"
        aria-label="Dismiss"
      >
        <X style={{ width: 16, height: 16 }} strokeWidth={1.6} />
      </button>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  // Mobile off-canvas drawer state. Desktop ignores this entirely (the
  // sidebar is always visible at lg+); on phones/tablets the sidebar is
  // hidden off-screen until `mobileOpen` is true.
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarName, setSidebarName] = useState("");
  const [sidebarInitial, setSidebarInitial] = useState("");
  const { entitlements } = useEntitlements();
  const [sidebarMembership, setSidebarMembership] = useState<string | null>(null);
  // Same hook PublicHeader uses; keeps the sidebar avatar in lock-step
  // with the top-bar avatar after a primary-photo change.
  const sidebarPhotoUrl = useProfilePhoto();
  // Unread messages for the Messages badge. Refreshed on navigation and every
  // 30s while visible; only for members who can message.
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    if (!entitlements.canMessage) { setUnreadMessages(0); return; }
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      chatApi.unreadCount()
        .then((r) => { if (!cancelled) setUnreadMessages(Number((r.data as any)?.data?.unread) || 0); })
        .catch(() => { /* badge is best-effort */ });
    };
    refresh();
    const id = setInterval(refresh, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [entitlements.canMessage, pathname]);

  // Auth gate. Onboarding is only "complete" when BOTH steps have shipped:
  // Step 1 saves `first_name` on the profile; Step 2 links a phone number to
  // the Firebase user. Allowing dashboard access on `first_name` alone let
  // members slip past the phone-verify step by clicking the M4M logo (or any
  // other link) and landing inside the app shell mid-onboarding. The gate
  // now requires both artefacts and redirects to /onboarding otherwise.
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged(async (user) => {
      if (!user) { router.replace("/auth/login"); return; }
      rememberSessionUid(user.uid);
      const hasPhone = !!(user.phoneNumber && user.phoneNumber.trim());
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data;
        const hasProfile = !!(p && p.first_name && p.first_name.trim());
        if (!hasProfile || !hasPhone) { router.replace("/onboarding"); return; }
      } catch {
        // Backend unreachable — still bounce a phone-less user so they can't
        // sit on a dashboard they shouldn't yet have reached.
        if (!hasPhone) { router.replace("/onboarding"); return; }
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

      // Plan label now comes from useEntitlements() (GET /subscriptions/limits) —
      // the same source the Subscription page's "current plan" panel uses — so
      // the sidebar badge and that panel can never disagree. The old code read
      // `subscription_tier` off the *profile* object, which doesn't carry it, so
      // the badge was always "Basic" regardless of the member's real tier; and
      // it used an off-by-one tier→label map (gold→"Elite").

      // Membership number (issued once onboarding completes) — shown under
      // the member's name in the sidebar.
      try {
        const meRes = await api.get("/api/v1/auth/me");
        const d = (meRes.data as any)?.data ?? meRes.data;
        setSidebarMembership(d?.membership_number ?? null);
        // Attribute Sentry errors to this member (id only — no PII).
        if (d?.user_id) Sentry.setUser({ id: String(d.user_id) });
      } catch { /* leave null */ }
    }
    loadSidebar();
  }, [pathname]);

  // Close the mobile drawer whenever the route changes (nav-item tap or any
  // programmatic navigation) so it never lingers over the new page.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // The collapsed (icon-only) rail is a desktop-only affordance. Below lg the
  // sidebar is a full-width drawer, so collapse must never apply there —
  // otherwise a desktop→mobile resize leaves an icon-only drawer.
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setIsDesktop(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  const effectiveCollapsed = isDesktop && collapsed;

  // Desktop margin tracks the rail width; on mobile the CSS below zeroes it.
  const sidebarWidth = effectiveCollapsed ? "72px" : "256px";

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  // Motion. Everything below animates transform/opacity only and collapses
  // to instant changes when the member prefers reduced motion.
  const reduceMotion = useReducedMotion();
  const tween = (duration: number, delay = 0) =>
    reduceMotion ? { duration: 0 } : { type: "tween" as const, duration, delay, ease: EASE_OUT };
  // The sidebar's groups arrive in a short stagger: once on desktop load, and
  // each time the drawer opens on mobile.
  const sidebarShown = isDesktop || mobileOpen;
  const groupsVariants: Variants = {
    hidden: {},
    show: { transition: reduceMotion ? {} : { staggerChildren: 0.045, delayChildren: 0.05 } },
  };
  const groupVariants: Variants = reduceMotion
    ? { hidden: { opacity: 1, x: 0 }, show: { opacity: 1, x: 0 } }
    : {
        hidden: { opacity: 0, x: -8, transition: { duration: 0, delay: 0.32 } },
        show: { opacity: 1, x: 0, transition: { type: "tween", duration: 0.32, ease: EASE_OUT } },
      };

  const isNavActive = (item: NavItem) =>
    pathname === item.href ||
    (!item.exact && item.href !== "/dashboard" && pathname.startsWith(item.href));

  // Offset of the active row inside the nav column (see NAV_ROW_H above).
  // The marker keeps its last position while fading out on routes that match
  // no nav item (e.g. another member's profile).
  let navCursor = 0;
  let markerY: number | null = null;
  for (const section of navSections) {
    navCursor += NAV_LABEL_H;
    for (const item of section.items) {
      if (markerY === null && isNavActive(item)) markerY = navCursor;
      navCursor += NAV_ROW_H;
    }
  }
  const lastMarkerY = useRef(0);
  if (markerY !== null) lastMarkerY.current = markerY;

  const avatarBackground = sidebarPhotoUrl
    ? `url(${sidebarPhotoUrl}) center/cover no-repeat, linear-gradient(135deg,#dc1e3c,#a0153c)`
    : "linear-gradient(135deg,#dc1e3c,#a0153c)";
  const avatarRing = "0 0 0 2px #170811, 0 0 0 3px rgba(201,149,74,0.5)";

  const handleSignOut = async () => {
    try { await signOut(firebaseAuth); } catch {}
    clearClientState();
    Sentry.setUser(null);  // stop attributing errors to the signed-out member
    // Send people to the marketing landing page after sign-out
    // rather than the login form — most users want to leave
    // entirely, not switch accounts.
    window.location.href = "/";
  };

  return (
    <div
      className="min-h-screen flex"
      style={{
        background: "#fdfbf9",
        // Fluid app scaling (see the inline script in app/layout.tsx <head>).
        // The whole authenticated app is laid out at a fixed 1728px design
        // width and scaled to fit any viewport via `zoom`, so a 1366px laptop
        // and a 1728px Mac render the IDENTICAL layout — just scaled — instead
        // of reflowing to fewer columns / a cramped photo rail. min-height is
        // divided by the same factor so the scaled shell still fills the
        // viewport (otherwise a short page would leave a strip at the bottom).
        // Below 1024px --app-zoom is 1, so phones keep the native responsive
        // layout. The cursor + auth/marketing pages are outside this div, so
        // they keep real (unscaled) coordinates.
        zoom: "var(--app-zoom, 1)",
        minHeight: "calc(100vh / var(--app-zoom, 1))",
      }}
    >
      {/* ── Mobile backdrop ── (only renders <lg; click to dismiss) */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            key="m4m-drawer-backdrop"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tween(0.2)}
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──
          <lg: off-canvas drawer — fixed, full-height, slid in and out by
          Framer Motion (x: -100% ↔ 0) and inert while closed. lg+: the
          collapsible rail (256px / 72px) that's always on screen; the CSS
          below pins its transform to none there, so the server-rendered
          closed-drawer transform can never hide the desktop rail. */}
      <motion.aside
        aria-label="Member navigation"
        data-collapsed={effectiveCollapsed ? "true" : "false"}
        className="m4m-app-sidebar fixed top-0 left-0 h-full z-50"
        initial={false}
        animate={{ x: mobileOpen ? "0%" : "-100%" }}
        transition={tween(0.32)}
        style={{
          width: sidebarWidth,
          background: "linear-gradient(180deg, #170811 0%, #1a0a14 55%, #0b0509 100%)",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          overflow: "hidden",
        }}
        {...((!isDesktop && !mobileOpen ? { inert: "" } : {}) as object)}
      >
        <motion.div
          className="flex flex-col h-full"
          variants={groupsVariants}
          initial="hidden"
          animate={sidebarShown ? "show" : "hidden"}
        >
          {/* Top row — same 64px height as the app header so the two
              hairlines meet in one line across the shell. Desktop: collapse /
              expand the rail. Mobile: close the drawer. */}
          <div
            className="flex items-center flex-shrink-0"
            style={{
              height: 64,
              padding: effectiveCollapsed ? "0 14px" : "0 10px 0 26px",
              justifyContent: effectiveCollapsed ? "center" : "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {!effectiveCollapsed && (
              <motion.span
                className="m4m-shell-eyebrow"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={tween(0.2, 0.12)}
              >
                Members&rsquo; Area
              </motion.span>
            )}
            <button
              type="button"
              onClick={() => setCollapsed(!collapsed)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!collapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="m4m-shell-iconbtn m4m-shell-iconbtn--desktop"
            >
              {collapsed
                ? <PanelLeftOpen style={{ width: 18, height: 18 }} strokeWidth={1.5} />
                : <PanelLeftClose style={{ width: 18, height: 18 }} strokeWidth={1.5} />}
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              className="m4m-shell-iconbtn m4m-shell-iconbtn--drawer"
            >
              <X style={{ width: 18, height: 18 }} strokeWidth={1.5} />
            </button>
          </div>

          {/* Member card — avatar, name, membership number, tier. */}
          <motion.div
            variants={groupVariants}
            className="flex-shrink-0"
            style={{
              padding: effectiveCollapsed ? "14px 0" : "14px 12px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {effectiveCollapsed ? (
              <Link
                href="/profile/me"
                title={sidebarName || "My Profile"}
                aria-label="My profile"
                className="m4m-side-member flex items-center justify-center mx-auto"
                style={{ width: 48, height: 48, minHeight: "auto", borderRadius: 12 }}
              >
                <span
                  className="font-display flex items-center justify-center rounded-full"
                  style={{
                    width: 34, height: 34, fontSize: 14, fontWeight: 600,
                    background: avatarBackground,
                    color: sidebarPhotoUrl ? "transparent" : "#fff",
                    boxShadow: avatarRing,
                  }}
                >
                  {sidebarPhotoUrl ? "" : (sidebarInitial || "?")}
                </span>
              </Link>
            ) : (
              <Link
                href="/profile/me"
                className="m4m-side-member flex items-center gap-3"
                style={{ minHeight: "auto", padding: "10px 6px 10px 14px", borderRadius: 12 }}
              >
                <span
                  className="font-display flex items-center justify-center rounded-full flex-shrink-0"
                  style={{
                    width: 44, height: 44, fontSize: 17, fontWeight: 600,
                    background: avatarBackground,
                    color: sidebarPhotoUrl ? "transparent" : "#fff",
                    boxShadow: avatarRing,
                  }}
                >
                  {sidebarPhotoUrl ? "" : (sidebarInitial || "?")}
                </span>
                <motion.span
                  className="flex-1 min-w-0 flex flex-col"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={tween(0.2, 0.12)}
                >
                  <span
                    className="font-display truncate"
                    style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.25, color: "#fff", letterSpacing: "0.005em" }}
                  >
                    {sidebarName || "My Profile"}
                  </span>
                  {sidebarMembership && (
                    <span
                      className="truncate"
                      style={{ fontFamily: "ui-monospace, monospace", fontSize: 10.5, letterSpacing: "0.12em", color: "rgba(255,255,255,0.55)", marginTop: 3 }}
                    >
                      {sidebarMembership}
                    </span>
                  )}
                  <span className="m4m-shell-eyebrow truncate" style={{ marginTop: 6 }}>
                    {entitlements.planLabel} member
                  </span>
                </motion.span>
                <ChevronRight className="flex-shrink-0" style={{ width: 16, height: 16, color: "rgba(255,255,255,0.3)" }} strokeWidth={1.5} />
              </Link>
            )}
          </motion.div>

          {/* Scrolling column: the nav sections and the plan module. Rows
              never shrink (see NAV_ROW_H), so on short screens this column
              scrolls instead of squeezing. */}
          <div
            className="m4m-side-scroll relative flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden"
            style={{ padding: "0 12px" }}
          >
            {/* Active marker — one element that glides between rows. */}
            <motion.span
              aria-hidden
              className="pointer-events-none absolute"
              style={{
                top: 0, left: 12, right: 12, height: NAV_ROW_H,
                borderRadius: 10,
                background: "rgba(255,255,255,0.055)",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)",
              }}
              initial={false}
              animate={{ y: lastMarkerY.current, opacity: markerY === null ? 0 : 1 }}
              transition={tween(0.28)}
            >
              <span
                style={{
                  position: "absolute", left: 0, top: 13, bottom: 13,
                  width: 2, borderRadius: 2, background: "#dc1e3c",
                }}
              />
            </motion.span>

            <nav aria-label="Member" className="flex-shrink-0">
              {navSections.map((section) => (
                <motion.div key={section.label} variants={groupVariants}>
                  <div
                    className="flex items-end"
                    style={{
                      height: NAV_LABEL_H,
                      padding: effectiveCollapsed ? "0 0 13px" : "0 14px 9px",
                      justifyContent: effectiveCollapsed ? "center" : "flex-start",
                    }}
                  >
                    {effectiveCollapsed ? (
                      <span aria-hidden style={{ width: 16, height: 1, background: "rgba(201,149,74,0.45)" }} />
                    ) : (
                      <motion.span
                        className="m4m-shell-eyebrow truncate"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={tween(0.2, 0.12)}
                      >
                        {section.label}
                      </motion.span>
                    )}
                  </div>
                  {section.items.map((item) => {
                    const active = isNavActive(item);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={effectiveCollapsed ? item.label : undefined}
                        aria-label={effectiveCollapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        data-active={active ? "true" : "false"}
                        className="m4m-side-link"
                        style={{ height: NAV_ROW_H }}
                      >
                        <motion.span
                          className="m4m-side-link__row"
                          whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                          transition={{ duration: 0.12 }}
                        >
                          <span className="relative inline-flex">
                            <Icon className="m4m-side-link__icon" strokeWidth={1.5} />
                            {item.href === "/messages" && unreadMessages > 0 && effectiveCollapsed && (
                              <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-[#dc1e3c] ring-2 ring-[#170811]" />
                            )}
                          </span>
                          {!effectiveCollapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {!effectiveCollapsed && item.href === "/messages" && unreadMessages > 0 && (
                            <span
                              aria-label={`${unreadMessages} unread`}
                              className="ml-auto inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-1.5 text-[10.5px] font-bold text-white"
                            >
                              {unreadMessages > 99 ? "99+" : unreadMessages}
                            </span>
                          )}
                        </motion.span>
                      </Link>
                    );
                  })}
                </motion.div>
              ))}
            </nav>

            {/* Plan module — reflects the member's actual tier (Basic,
                Premium, Elite) from useEntitlements(), the same source the
                Subscription page uses. Hidden on the collapsed rail. */}
            {!effectiveCollapsed && (
              <motion.div
                variants={groupVariants}
                className="flex-shrink-0"
                style={{ marginTop: "auto", paddingTop: 24, paddingBottom: 14 }}
              >
                <div
                  style={{
                    padding: "14px 14px 4px",
                    borderRadius: 12,
                    border: "1px solid rgba(201,149,74,0.24)",
                    background: "rgba(255,255,255,0.025)",
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="m4m-shell-eyebrow">Your plan</span>
                    <span className="inline-flex items-center gap-1.5" style={{ fontSize: 11, letterSpacing: "0.04em", color: "rgba(255,255,255,0.6)" }}>
                      <span aria-hidden style={{ width: 5, height: 5, borderRadius: "50%", background: "#c89020" }} />
                      Active
                    </span>
                  </div>
                  <p
                    className="font-display truncate"
                    style={{ margin: "8px 0 0", fontSize: 21, fontWeight: 500, lineHeight: 1.2, color: "#f3c9a8" }}
                  >
                    {entitlements.planLabel}
                  </p>
                  <Link href="/subscription" className="m4m-side-planlink">
                    <span>{entitlements.plan === "platinum" ? "Manage membership" : "View membership plans"}</span>
                    <ArrowRight className="m4m-side-planlink__arrow" style={{ width: 13, height: 13 }} strokeWidth={1.6} />
                  </Link>
                </div>
              </motion.div>
            )}
          </div>

          {/* Leaving: back to the public site, or sign out. */}
          <motion.div
            variants={groupVariants}
            className="flex-shrink-0"
            style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Link
              href="/"
              title={effectiveCollapsed ? "Home" : undefined}
              aria-label={effectiveCollapsed ? "Home" : undefined}
              className="m4m-side-link"
              style={{ height: NAV_ROW_H }}
            >
              <motion.span
                className="m4m-side-link__row"
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.12 }}
              >
                <Home className="m4m-side-link__icon" strokeWidth={1.5} />
                {!effectiveCollapsed && <span className="flex-1 truncate">Home</span>}
              </motion.span>
            </Link>
            <button
              type="button"
              onClick={handleSignOut}
              title={effectiveCollapsed ? "Sign Out" : undefined}
              aria-label={effectiveCollapsed ? "Sign Out" : undefined}
              className="m4m-side-link m4m-side-link--quiet"
              style={{ height: NAV_ROW_H }}
            >
              <motion.span
                className="m4m-side-link__row"
                whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                transition={{ duration: 0.12 }}
              >
                <LogOut className="m4m-side-link__icon" strokeWidth={1.5} />
                {!effectiveCollapsed && <span className="flex-1 truncate text-left">Sign Out</span>}
              </motion.span>
            </button>
          </motion.div>
        </motion.div>
      </motion.aside>

      {/* ── Main ──
          Desktop keeps the inline marginLeft (matches the rail width). On
          <lg the rail is an overlay drawer, so the content must be full
          width — `m4m-app-main` zeroes the inline margin below 1024px. */}
      <main
        className="m4m-app-main flex-1 min-h-screen flex flex-col transition-all duration-300 min-w-0"
        style={{ marginLeft: sidebarWidth, background: "#fdfbf9" }}
      >
        <style jsx global>{`
          @media (max-width: 1023px) {
            .m4m-app-main { margin-left: 0 !important; }
            /* Force a comfortable drawer width on phones/tablets even if the
               desktop "collapsed" rail width (72px) was carried over. */
            .m4m-app-sidebar { width: min(280px, 82vw) !important; }
          }
          @media (min-width: 1024px) {
            /* The rail is always on screen at lg+: the drawer's slide
               transform (set inline by Framer Motion) must never apply. */
            .m4m-app-sidebar { transform: none !important; }
          }
          .m4m-app-sidebar { transition: width 0.3s cubic-bezier(0.22, 1, 0.36, 1); }
          .m4m-app-sidebar :focus-visible { outline-color: #ff8aa3; outline-offset: -2px; border-radius: 10px; }

          /* Small-caps label — the one gold accent in the shell. */
          .m4m-shell-eyebrow {
            font-family: var(--font-nav);
            font-size: 10px;
            font-weight: 600;
            line-height: 1;
            letter-spacing: 0.2em;
            text-transform: uppercase;
            color: rgba(201,149,74,0.95);
            white-space: nowrap;
          }
          .m4m-shell-iconbtn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 44px;
            height: 44px;
            min-height: auto;
            flex-shrink: 0;
            border: 0;
            border-radius: 10px;
            background: transparent;
            color: rgba(255,255,255,0.6);
            cursor: pointer;
            transition: background 0.18s ease, color 0.18s ease;
          }
          /* Desktop-only / drawer-only variants (own rules, because this
             class sets display and would otherwise beat Tailwind's hidden). */
          .m4m-shell-iconbtn--desktop { display: none; }
          @media (min-width: 1024px) {
            .m4m-shell-iconbtn--desktop { display: inline-flex; }
            .m4m-shell-iconbtn--drawer { display: none; }
          }
          .m4m-shell-iconbtn:hover { background: rgba(255,255,255,0.06); color: #fff; }

          .m4m-side-member { text-decoration: none; transition: background 0.18s ease; }
          .m4m-side-member:hover { background: rgba(255,255,255,0.04); }

          .m4m-side-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.14) transparent; }

          .m4m-side-link {
            display: block;
            width: 100%;
            min-height: auto;
            padding: 0;
            border: 0;
            border-radius: 10px;
            background: transparent;
            color: rgba(255,255,255,0.66);
            text-decoration: none;
            cursor: pointer;
            transition: background 0.18s ease, color 0.18s ease;
          }
          .m4m-side-link:hover { background: rgba(255,255,255,0.035); color: #fff; }
          .m4m-side-link[data-active="true"] { background: transparent; color: #fff; }
          .m4m-side-link--quiet { color: rgba(255,255,255,0.5); }
          .m4m-side-link--quiet:hover { color: #ff8aa3; }
          .m4m-side-link__row {
            display: flex;
            align-items: center;
            gap: 12px;
            height: 100%;
            padding: 0 14px;
            font-family: var(--font-nav);
            font-size: 13.5px;
            font-weight: 500;
            letter-spacing: 0.01em;
          }
          .m4m-app-sidebar[data-collapsed="true"] .m4m-side-link__row { justify-content: center; padding: 0; }
          .m4m-side-link__icon { width: 17px; height: 17px; flex-shrink: 0; opacity: 0.8; transition: color 0.18s ease, opacity 0.18s ease; }
          .m4m-side-link:hover .m4m-side-link__icon { opacity: 1; }
          .m4m-side-link[data-active="true"] .m4m-side-link__icon { color: #ff8aa3; opacity: 1; }

          .m4m-side-planlink {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            height: 44px;
            min-height: auto;
            margin-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.08);
            font-family: var(--font-nav);
            font-size: 12.5px;
            font-weight: 500;
            letter-spacing: 0.01em;
            color: rgba(255,255,255,0.78);
            text-decoration: none;
            transition: color 0.18s ease;
          }
          .m4m-side-planlink:hover { color: #fff; }
          .m4m-side-planlink__arrow { color: #f3c9a8; transition: transform 0.2s cubic-bezier(0.22, 1, 0.36, 1); }
          .m4m-side-planlink:hover .m4m-side-planlink__arrow { transform: translateX(3px); }

          .m4m-shell-footlink {
            display: block;
            min-height: auto;
            padding: 5px 0;
            font-size: 13px;
            color: rgba(255,255,255,0.6);
            text-decoration: none;
            transition: color 0.18s ease;
          }
          .m4m-shell-footlink:hover { color: #fff; }
          @media (max-width: 1023px) {
            .m4m-shell-footlink { padding: 12px 0; }
          }
          @media (prefers-reduced-motion: reduce) {
            .m4m-side-planlink:hover .m4m-side-planlink__arrow { transform: none; }
          }
        `}</style>

        {/* Shared brand bar — same component the public site uses, but the
            "app" variant renders the dark member-shell header: no red
            utility strip, no marketing nav (the sidebar covers member
            navigation). Below lg it also carries the drawer opener, so the
            menu lives in the sticky header rather than a floating button. */}
        <PublicHeader variant="app" onMenuClick={() => setMobileOpen(true)} />

        {/* ── ID Verification Warning Banner ── */}
        <VerificationBanner />

        {/* ── Page Content ── */}
        <div style={{ flex: 1 }}>
          {children}
        </div>

        {/* ── UK GDPR consent confirmation (non-blocking) ── */}
        <ConsentPrompt />

        {/* ── Footer ── */}
        <footer
          className="px-5 py-8 sm:px-8 sm:py-8"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.08)",
            background: "#1a0a14",
          }}
        >
          <div style={{ maxWidth: "960px", margin: "0 auto" }}>
            {/* 1 col on phones, 3 across from sm+ — keeps the desktop layout. */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
              <div>
                <div style={{ display: "flex", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ display: "inline-flex", background: "rgba(255,255,255,0.96)", borderRadius: 12, padding: "7px 10px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/images/logo.png" alt="Match 4 Marriage" style={{ height: 30, width: "auto", display: "block" }} />
                  </span>
                </div>
                <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
                  Elite Indian Matrimony<br />United Kingdom
                </p>
              </div>
              <div>
                <p className="m4m-shell-eyebrow" style={{ marginBottom: "12px" }}>Quick Links</p>
                {[
                  { label: "My Profile", href: "/profile/me" },
                  { label: "Browse Matches", href: "/matches" },
                  { label: "Messages", href: "/messages" },
                  { label: "Subscription", href: "/subscription" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} className="m4m-shell-footlink">{label}</Link>
                ))}
              </div>
              <div>
                <p className="m4m-shell-eyebrow" style={{ marginBottom: "12px" }}>Support</p>
                {[
                  { label: "Privacy Policy", href: "/privacy" },
                  { label: "Terms of Service", href: "/terms" },
                  { label: "Settings", href: "/settings" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} className="m4m-shell-footlink">{label}</Link>
                ))}
                <a href="mailto:enquiry@match4marriage.com" className="m4m-shell-footlink" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Mail style={{ width: 13, height: 13 }} strokeWidth={1.6} /> enquiry@match4marriage.com
                </a>
              </div>
            </div>
            <div
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "16px" }}
            >
              <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.5)" }}>
                © {new Date().getFullYear()} Match4Marriage. All rights reserved.
              </p>
              <p style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                Made with <Heart style={{ width: 12, height: 12, color: "#dc1e3c", fill: "#dc1e3c" }} /> for love
              </p>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
