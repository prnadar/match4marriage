"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Mail, ChevronDown, Heart, Bell, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { firebaseAuth } from "@/lib/firebase";
import { useProfilePhoto } from "@/lib/profilePhoto";

interface PublicHeaderProps {
  /**
   * When true, the header floats transparently over a dark hero until the user
   * scrolls past it. Used on the homepage to harmonise with the cinematic
   * video. On every other page the header keeps its solid editorial styling.
   */
  transparent?: boolean;
  /**
   * Pixel offset at which the floating state collapses back into the solid
   * state. Default ~70vh — roughly the start of the next section after the
   * full-viewport video hero.
   */
  transparentUntil?: number;
  /**
   * `"public"` (default) — full marketing nav (Home, Browse Profiles, Success
   * Stories, Pricing, About Us, Help).
   * `"app"` — used inside the logged-in member shell. Drops the marketing
   * links + the mobile drawer's marketing sections (the sidebar covers
   * member navigation); only the brand bar, logo, and signed-in actions
   * (Bell / Messages / Avatar) remain.
   */
  variant?: "public" | "app";
}

type AuthSnapshot =
  | { status: "pending" }
  | { status: "anonymous" }
  | { status: "signed-in"; initial: string };

export default function PublicHeader({ transparent = false, transparentUntil, variant = "public" }: PublicHeaderProps = {}) {
  const isAppVariant = variant === "app";
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const [auth, setAuth] = useState<AuthSnapshot>({ status: "pending" });
  const photoUrl = useProfilePhoto();
  const helpRef = useRef<HTMLDivElement>(null);

  // Track Firebase auth so the right-side actions (Login/Register vs.
  // Bell/Messages/Avatar) match the user's session on every page.
  useEffect(() => {
    const unsub = firebaseAuth.onAuthStateChanged((user) => {
      if (!user) { setAuth({ status: "anonymous" }); return; }
      const seed = user.displayName || user.email || "";
      const initial = (seed.trim().charAt(0) || "?").toUpperCase();
      setAuth({ status: "signed-in", initial });
    });
    return () => unsub();
  }, []);

  // When floating is active and the menu is open we always want solid styling
  // so the dropdown contents read clearly.
  const floating = transparent && !pastHero && !mobileOpen;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setHelpOpen(false);
  }, [pathname]);

  // Scroll-triggered states. `scrolled` adds the glass-blur to the solid bar;
  // `pastHero` flips the floating bar back into solid when the user has
  // scrolled past the cinematic hero.
  useEffect(() => {
    const threshold = transparentUntil ?? (typeof window !== "undefined" ? window.innerHeight * 0.7 : 0);
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 6);
      setPastHero(y > threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [transparentUntil]);

  const navLinks = [
    { label: "Home",            href: "/" },
    { label: "Browse Profiles", href: "/profiles" },
    { label: "Success Stories", href: "/success-stories" },
    { label: "Pricing",         href: "/pricing" },
    { label: "About Us",        href: "/about" },
  ];

  const helpLinks = [
    { label: "FAQs",         href: "/faq" },
    { label: "Contact Us",   href: "/contact" },
    { label: "How It Works", href: "/#how-it-works" },
  ];

  const isActive = (href: string) =>
    pathname === href || (!href.includes("#") && href !== "/" && pathname.startsWith(href));

  return (
    <>
      {/* ── Top Announcement Bar — brand provenance line on the left, direct
              enquiry line on the right. Plain text only: no emoji/flag glyphs
              (they render inconsistently across platforms and read as noisy
              on a premium brand bar). Shared by every public + member page. ─── */}
      <div className={`m4m-top-bar${transparent ? " m4m-top-bar--overlay" : ""}${floating ? " is-floating" : ""}`}>
        <span className="m4m-top-bar__shine" aria-hidden />
        <div className="m4m-top-bar__row max-w-7xl mx-auto">
          <span className="m4m-top-bar__brand">Elite Indian Matrimony, Established in the UK</span>
          <a
            href="mailto:enquiry@match4marriage.com"
            className="m4m-top-bar__mail"
          >
            <Mail className="h-3.5 w-3.5 flex-shrink-0" strokeWidth={1.6} />
            <span className="truncate">enquiry@match4marriage.com</span>
          </a>
        </div>
      </div>

      {/* ── Main Nav ── */}
      <nav className={`m4m-nav${transparent ? " m4m-nav--overlay" : ""}${scrolled ? " is-scrolled" : ""}${floating ? " is-floating" : ""}`}>
        <div className="m4m-nav__row max-w-7xl mx-auto px-4 sm:px-6">
          {/* Logo — single JPEG mark, used on every page (including the
              cinematic homepage hero). */}
          <Link href="/" className="m4m-nav__logo" aria-label="Match4Marriage home">
            <img className="m4m-nav__logo-img" src="/images/logo.png" alt="Match4Marriage" />
          </Link>

          {/* Desktop nav (centre column — auto-centred regardless of side widths).
              Display + layout owned by the .m4m-nav__center rule in globals.css.
              Hidden in the app variant — members have their own sidebar. */}
          {!isAppVariant && (
          <div className="m4m-nav__center">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className={`m4m-nav__link ${isActive(href) ? "is-active" : ""}`}
              >
                <span>{label}</span>
              </Link>
            ))}

            {/* Help dropdown */}
            <div ref={helpRef} className="m4m-nav__help">
              <button
                type="button"
                onClick={() => setHelpOpen((v) => !v)}
                aria-expanded={helpOpen}
                aria-haspopup="menu"
                className={`m4m-nav__link m4m-nav__help-btn ${helpOpen ? "is-active" : ""}`}
              >
                <span>Help</span>
                <motion.span
                  className="m4m-nav__help-chevron"
                  animate={{ rotate: helpOpen ? 180 : 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 24 }}
                >
                  <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                </motion.span>
              </button>

              <AnimatePresence>
                {helpOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 30 }}
                    className="m4m-nav__dropdown"
                  >
                    <span className="m4m-nav__dropdown-arrow" aria-hidden />
                    {helpLinks.map(({ label, href }) => (
                      <Link
                        key={label}
                        href={href}
                        onClick={() => setHelpOpen(false)}
                        className="m4m-nav__dropdown-item"
                        role="menuitem"
                      >
                        {label}
                      </Link>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
          )}

          {/* Right column — auth-aware: signed-in users get Bell/Messages/Avatar,
              anonymous visitors get Log In + Register CTAs. While auth is
              still resolving we render nothing on this side to avoid the
              flicker of CTAs flashing on for a signed-in user. */}
          <div className="m4m-nav__right">
            {auth.status === "signed-in" ? (
              <>
                <Link href="/notifications" className="m4m-nav__icon-btn hidden sm:inline-flex" aria-label="Notifications">
                  <Bell className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </Link>
                <Link href="/messages" className="m4m-nav__icon-btn hidden sm:inline-flex" aria-label="Messages">
                  <MessageCircle className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </Link>
                <Link
                  href="/profile/me"
                  className="m4m-nav__avatar"
                  aria-label="My profile"
                  style={photoUrl ? {
                    backgroundImage: `url(${photoUrl})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    color: "transparent",
                  } : undefined}
                >
                  {photoUrl ? "" : auth.initial}
                </Link>
              </>
            ) : auth.status === "anonymous" ? (
              <>
                <Link href="/auth/login" className="m4m-nav__login hidden sm:inline-flex">
                  Log In
                </Link>
                <Link href="/auth/register" className="m4m-nav__register hidden sm:inline-flex">
                  <Heart className="m4m-nav__register-heart h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                  <span>Register Free</span>
                </Link>
              </>
            ) : null}

            {/* Burger — visibility owned by .m4m-nav__burger media query in globals.css.
                In the app variant the member sidebar drawer has its own opener
                (a floating button in (app)/layout.tsx), so we hide this one
                to avoid a confusing second hamburger on mobile. */}
            {!isAppVariant && (
            <button
              type="button"
              className="m4m-nav__burger"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label="Toggle menu"
              aria-expanded={mobileOpen}
            >
              <span className="m4m-nav__burger-bar" data-state={mobileOpen ? "open-1" : "closed"} />
              <span className="m4m-nav__burger-bar" data-state={mobileOpen ? "open-2" : "closed"} />
              <span className="m4m-nav__burger-bar" data-state={mobileOpen ? "open-3" : "closed"} />
            </button>
            )}
          </div>
        </div>

        {/* Mobile drawer — only the public variant carries marketing links;
            the app variant suppresses this entirely (members use the sidebar). */}
        <AnimatePresence initial={false}>
          {!isAppVariant && mobileOpen && (
            <motion.div
              key="mobile-drawer"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: "spring", stiffness: 240, damping: 30 }}
              className="m4m-nav__mobile lg:hidden"
            >
              <div className="m4m-nav__mobile-inner">
                {navLinks.map(({ label, href }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * i + 0.05, type: "spring", stiffness: 380, damping: 28 }}
                  >
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className={`m4m-nav__mobile-link ${isActive(href) ? "is-active" : ""}`}
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}

                <p className="m4m-nav__mobile-section">Help</p>
                {helpLinks.map(({ label, href }, i) => (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.04 * (navLinks.length + i) + 0.05, type: "spring", stiffness: 380, damping: 28 }}
                  >
                    <Link
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="m4m-nav__mobile-sublink"
                    >
                      {label}
                    </Link>
                  </motion.div>
                ))}

                {auth.status === "signed-in" ? (
                  <div className="m4m-nav__mobile-cta">
                    <Link href="/profile/me" onClick={() => setMobileOpen(false)} className="m4m-nav__mobile-login">
                      My Profile
                    </Link>
                    <Link href="/messages" onClick={() => setMobileOpen(false)} className="m4m-nav__mobile-register">
                      <MessageCircle className="h-3.5 w-3.5" strokeWidth={2} />
                      <span>Messages</span>
                    </Link>
                  </div>
                ) : auth.status === "anonymous" ? (
                  <div className="m4m-nav__mobile-cta">
                    <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="m4m-nav__mobile-login">
                      Log In
                    </Link>
                    <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="m4m-nav__mobile-register">
                      <Heart className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                      <span>Register Free</span>
                    </Link>
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

    </>
  );
}
