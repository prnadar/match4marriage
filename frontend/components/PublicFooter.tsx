import Link from "next/link";
import { Heart, Mail } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer style={{ backgroundColor: "#1a0a14", padding: "48px 24px 24px" }}>
      <div style={{ maxWidth: "1152px", margin: "0 auto" }}>
        {/* Brand spans full row on mobile; link columns sit 2-up on phones,
            opening to the original 2fr/1fr/1fr/1fr at lg. */}
        <div className="grid grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr] gap-8 mb-8">
          {/* Brand */}
          <div className="col-span-2 lg:col-span-1">
            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ display: "inline-flex", background: "rgba(255,255,255,0.96)", borderRadius: 12, padding: "7px 11px", boxShadow: "0 2px 12px rgba(0,0,0,0.25)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/logo.png" alt="Match 4 Marriage" style={{ height: 32, width: "auto", display: "block" }} />
              </span>
            </div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: "260px" }}>
              Elite Indian matrimony service. Hand-picked, personally verified profiles for the global Indian community.
            </p>
            <a
              href="mailto:enquiry@match4marriage.com"
              style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 12, textDecoration: "none" }}
            >
              <Mail style={{ width: 13, height: 13 }} strokeWidth={1.6} />
              enquiry@match4marriage.com
            </a>
          </div>

          {/* Company */}
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em", marginBottom: "12px" }}>Company</p>
            {[{ label: "Home", href: "/" }, { label: "Browse Profiles", href: "/profiles" }, { label: "Success Stories", href: "/success-stories" }, { label: "About Us", href: "/about" }, { label: "Pricing", href: "/pricing" }].map(({ label, href }) => (
              <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "8px", minHeight: "auto" }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Account */}
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em", marginBottom: "12px" }}>Account</p>
            {[{ label: "Register", href: "/auth/register" }, { label: "Log In", href: "/auth/login" }, { label: "Dashboard", href: "/dashboard" }, { label: "My Profile", href: "/profile/me" }].map(({ label, href }) => (
              <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "8px", minHeight: "auto" }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Legal */}
          <div>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em", marginBottom: "12px" }}>Legal</p>
            {[{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" }, { label: "FAQ", href: "/faq" }, { label: "Contact Us", href: "/contact" }].map(({ label, href }) => (
              <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "8px", minHeight: "auto" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px", flexWrap: "wrap", gap: "8px" }}>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            © {new Date().getFullYear()} Match4Marriage. All rights reserved. · United Kingdom
          </p>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "rgba(255,255,255,0.25)" }}>
            Made with <Heart style={{ width: 12, height: 12, color: "#dc1e3c", fill: "#dc1e3c" }} /> for love
          </p>
        </div>
      </div>
    </footer>
  );
}
