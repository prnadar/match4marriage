import Link from "next/link";
import { Heart } from "lucide-react";

export default function PublicFooter() {
  return (
    <footer style={{ backgroundColor: "#1a0a14", padding: "48px 24px 24px" }}>
      <div style={{ maxWidth: "1152px", margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "32px", marginBottom: "32px" }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
              <Heart style={{ width: "18px", height: "18px", color: "#dc1e3c" }} />
              <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "20px", fontWeight: 700, color: "#fff" }}>Match<span style={{ color: "#dc1e3c" }}>4</span>Marriage</span>
            </div>
            <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", lineHeight: 1.7, maxWidth: "260px" }}>
              Elite Indian matrimony service — hand-picked, personally verified profiles for the global Indian community.
            </p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)", marginTop: "12px" }}>
              ✉️ enquiry@match4marriage.com
            </p>
          </div>

          {/* Company */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Company</p>
            {[{ label: "Home", href: "/" }, { label: "Browse Profiles", href: "/profiles" }, { label: "Success Stories", href: "/success-stories" }, { label: "About Us", href: "/about" }, { label: "Pricing", href: "/pricing" }].map(({ label, href }) => (
              <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "8px", minHeight: "auto" }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Account */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Account</p>
            {[{ label: "Register", href: "/auth/register" }, { label: "Log In", href: "/auth/login" }, { label: "Dashboard", href: "/dashboard" }, { label: "My Profile", href: "/profile/me" }].map(({ label, href }) => (
              <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "8px", minHeight: "auto" }}>
                {label}
              </Link>
            ))}
          </div>

          {/* Legal */}
          <div>
            <p style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "12px" }}>Legal</p>
            {[{ label: "Privacy Policy", href: "/privacy" }, { label: "Terms of Service", href: "/terms" }, { label: "FAQ", href: "/faq" }, { label: "Contact Us", href: "/contact" }].map(({ label, href }) => (
              <Link key={href} href={href} style={{ display: "block", fontSize: "13px", color: "rgba(255,255,255,0.45)", textDecoration: "none", marginBottom: "8px", minHeight: "auto" }}>
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            © {new Date().getFullYear()} Match4Marriage. All rights reserved. · United Kingdom
          </p>
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.25)" }}>
            Made with ❤️ for love
          </p>
        </div>
      </div>
    </footer>
  );
}
