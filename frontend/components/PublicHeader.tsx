"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";

export default function PublicHeader() {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const helpRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (helpRef.current && !helpRef.current.contains(e.target as Node)) setHelpOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

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
      {/* ── Top Bar ── */}
      <div className="w-full text-white text-sm py-2 px-4" style={{ backgroundColor: "#dc1e3c" }}>
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-1">
          <span>💍 Elite Indian Matrimony — Established in the UK 🇬🇧</span>
          <span className="text-xs sm:text-sm">✉️ enquiry@match4marriage.com</span>
        </div>
      </div>

      {/* ── Main Nav ── */}
      <nav className="sticky top-0 z-50 bg-white" style={{ borderBottom: "1px solid rgba(220,30,60,0.12)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">

          {/* Logo */}
          <Link href="/" style={{ display: "flex", alignItems: "center", textDecoration: "none", minHeight: "auto" }}>
            <img src="/images/logo.jpeg" alt="Match4Marriage" style={{ height: "52px", width: "auto", objectFit: "contain" }} />
          </Link>

          {/* Desktop Nav links */}
          <div className="hidden lg:flex items-center gap-7">
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                className="text-sm font-medium transition-colors duration-200 hover:text-[#dc1e3c]"
                style={{
                  color: isActive(href) ? "#dc1e3c" : "#333",
                  textDecoration: "none", minHeight: "auto",
                }}
              >
                {label}
              </Link>
            ))}

            {/* Help dropdown */}
            <div ref={helpRef} style={{ position: "relative" }}>
              <button
                onClick={() => setHelpOpen(!helpOpen)}
                className="text-sm font-medium transition-colors hover:text-[#dc1e3c] flex items-center gap-1"
                style={{ color: helpOpen ? "#dc1e3c" : "#333", background: "none", border: "none", cursor: "pointer", padding: 0, minHeight: "auto" }}
              >
                Help
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transition: "transform 0.2s", transform: helpOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                  <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {helpOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 12px)", left: "50%", transform: "translateX(-50%)",
                  background: "#fff", borderRadius: "12px", minWidth: "180px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)", border: "1px solid rgba(220,30,60,0.1)",
                  overflow: "hidden", zIndex: 100,
                }}>
                  <div style={{ position: "absolute", top: "-6px", left: "50%", transform: "translateX(-50%) rotate(45deg)",
                    width: "12px", height: "12px", background: "#fff",
                    borderTop: "1px solid rgba(220,30,60,0.1)", borderLeft: "1px solid rgba(220,30,60,0.1)",
                  }} />
                  {helpLinks.map(({ label, href }) => (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setHelpOpen(false)}
                      style={{ display: "block", padding: "10px 16px", fontSize: "13px", color: "#333", textDecoration: "none", minHeight: "auto" }}
                      className="hover:bg-[#fff5f6] hover:text-[#dc1e3c] transition-colors"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side: CTA + Burger */}
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              style={{ fontSize: "14px", fontWeight: 600, color: "#333", textDecoration: "none", minHeight: "auto" }}
              className="hover:text-[#dc1e3c] transition-colors hidden sm:inline"
            >
              Log In
            </Link>
            <Link
              href="/auth/register"
              style={{
                fontSize: "13px", fontWeight: 600,
                padding: "9px 22px",
                borderRadius: "9999px",
                background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
                color: "#fff",
                textDecoration: "none",
                minHeight: "auto",
              }}
            >
              Register Free
            </Link>

            {/* Burger — mobile only */}
            <button
              className="lg:hidden flex flex-col justify-center items-center gap-1.5 p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
              style={{ background: "none", border: "none", cursor: "pointer", marginLeft: "4px" }}
            >
              <span style={{
                display: "block", width: "22px", height: "2px",
                background: "#1a0a14", borderRadius: "2px",
                transition: "all 0.25s",
                transform: mobileOpen ? "translateY(7px) rotate(45deg)" : "none",
              }} />
              <span style={{
                display: "block", width: "22px", height: "2px",
                background: "#1a0a14", borderRadius: "2px",
                transition: "all 0.25s",
                opacity: mobileOpen ? 0 : 1,
              }} />
              <span style={{
                display: "block", width: "22px", height: "2px",
                background: "#1a0a14", borderRadius: "2px",
                transition: "all 0.25s",
                transform: mobileOpen ? "translateY(-7px) rotate(-45deg)" : "none",
              }} />
            </button>
          </div>
        </div>

        {/* ── Mobile Menu Drawer ── */}
        {mobileOpen && (
          <div style={{
            background: "#fff",
            borderTop: "1px solid rgba(220,30,60,0.10)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.08)",
            padding: "16px 24px 24px",
          }}
          className="lg:hidden"
          >
            {/* Main nav links */}
            {navLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: "block",
                  padding: "12px 0",
                  fontSize: "15px",
                  fontWeight: isActive(href) ? 700 : 500,
                  color: isActive(href) ? "#dc1e3c" : "#1a0a14",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(220,30,60,0.06)",
                  minHeight: "auto",
                }}
              >
                {label}
              </Link>
            ))}

            {/* Help links */}
            <p style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", marginTop: "16px", marginBottom: "8px" }}>Help</p>
            {helpLinks.map(({ label, href }) => (
              <Link
                key={label}
                href={href}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: "block",
                  padding: "10px 0",
                  fontSize: "14px",
                  fontWeight: 500,
                  color: "#555",
                  textDecoration: "none",
                  borderBottom: "1px solid rgba(220,30,60,0.06)",
                  minHeight: "auto",
                }}
              >
                {label}
              </Link>
            ))}

            {/* Auth buttons */}
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <Link
                href="/auth/login"
                onClick={() => setMobileOpen(false)}
                style={{
                  flex: 1, textAlign: "center",
                  padding: "11px 0", borderRadius: "9999px",
                  fontSize: "14px", fontWeight: 600,
                  border: "2px solid rgba(220,30,60,0.3)",
                  color: "#dc1e3c", textDecoration: "none",
                  minHeight: "auto",
                }}
              >
                Log In
              </Link>
              <Link
                href="/auth/register"
                onClick={() => setMobileOpen(false)}
                style={{
                  flex: 1, textAlign: "center",
                  padding: "11px 0", borderRadius: "9999px",
                  fontSize: "14px", fontWeight: 600,
                  background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
                  color: "#fff", textDecoration: "none",
                  minHeight: "auto",
                }}
              >
                Register Free
              </Link>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}
