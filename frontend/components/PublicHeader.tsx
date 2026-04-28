"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { Mail, ChevronDown, Heart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
}

export default function PublicHeader({ transparent = false, transparentUntil }: PublicHeaderProps = {}) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [pastHero, setPastHero] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

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
      {/* ── Top Announcement Bar — kept intentionally quiet: just the
              direct enquiry line, right-aligned. The brand identity already
              sits in the nav below, so the bar above doesn't need to repeat
              it. ─── */}
      <div className={`m4m-top-bar${transparent ? " m4m-top-bar--overlay" : ""}${floating ? " is-floating" : ""}`}>
        <span className="m4m-top-bar__shine" aria-hidden />
        <div className="m4m-top-bar__row m4m-top-bar__row--mail-only max-w-7xl mx-auto">
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
          {/* Logo — JPEG when solid, typographic wordmark when floating */}
          <Link href="/" className="m4m-nav__logo" aria-label="Match4Marriage home">
            <img className="m4m-nav__logo-img" src="/images/logo.jpeg" alt="Match4Marriage" />
            <span className="m4m-nav__logo-wordmark font-display" aria-hidden>
              Match
              <em
                className="font-display-alt"
                style={{
                  fontStyle: "italic",
                  fontWeight: 500,
                  background: "linear-gradient(135deg, #FFE4A8 0%, #FFB347 50%, #FFD87A 100%)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  margin: "0 2px",
                }}
              >
                4
              </em>
              Marriage
            </span>
          </Link>

          {/* Desktop nav (centre column — auto-centred regardless of side widths).
              Display + layout owned by the .m4m-nav__center rule in globals.css. */}
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

          {/* Right column — CTAs + burger */}
          <div className="m4m-nav__right">
            <Link href="/auth/login" className="m4m-nav__login hidden sm:inline-flex">
              Log In
            </Link>
            <Link href="/auth/register" className="m4m-nav__register hidden sm:inline-flex">
              <Heart className="m4m-nav__register-heart h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
              <span>Register Free</span>
            </Link>

            {/* Burger — visibility owned by .m4m-nav__burger media query in globals.css */}
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
          </div>
        </div>

        {/* Mobile drawer */}
        <AnimatePresence initial={false}>
          {mobileOpen && (
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

                <div className="m4m-nav__mobile-cta">
                  <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="m4m-nav__mobile-login">
                    Log In
                  </Link>
                  <Link href="/auth/register" onClick={() => setMobileOpen(false)} className="m4m-nav__mobile-register">
                    <Heart className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                    <span>Register Free</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

    </>
  );
}
