"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Lock, ArrowRight, Check } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/* ────────────────────────────────────────────────────────────────
   Pricing — editorial. Quiet hero, plans presented as four numbered
   tiers in a single horizontal row at lg, stacked on smaller views.
   ──────────────────────────────────────────────────────────────── */

interface Plan {
  name: string;
  tagline: string;
  price: string;
  period: string;
  bestFor: string;
  features: string[];
  cta: string;
  ctaHref: string;
  recommended?: boolean;
  bespoke?: boolean;
}

const plans: Plan[] = [
  {
    name: "Basic",
    tagline: "Begin the conversation.",
    price: "£0",
    period: "for 3 months",
    bestFor: "Early enquiries",
    features: ["Curated match suggestions", "View profiles", "Compatibility insights", "Standard search filters"],
    cta: "Get started",
    ctaHref: "/auth/register",
  },
  {
    name: "Premium",
    tagline: "When you are ready to engage.",
    price: "£300",
    period: "for 6 months",
    bestFor: "Most members",
    features: ["Unlimited expressions of interest", "Direct messaging", "Photo access", "Advanced search filters", "Compatibility insights", "Priority placement"],
    cta: "Choose Premium",
    ctaHref: "/auth/register",
    recommended: true,
  },
  {
    name: "Elite",
    tagline: "Personally guided throughout.",
    price: "£1,000",
    period: "for 6 months",
    bestFor: "Concierge support",
    features: ["Everything in Premium", "Dedicated relationship advisor", "Background verification", "Privacy shield", "Featured placement", "WhatsApp support", "Profile boosting (4× / month)", "Horoscope matching", "Family background check"],
    cta: "Choose Elite",
    ctaHref: "/auth/register",
  },
  {
    name: "VIP Concierge",
    tagline: "Tailored to your family.",
    price: "Bespoke",
    period: "tailored to you",
    bestFor: "By application",
    features: ["Everything in Elite", "Personal matchmaker assigned", "Hand-curated profiles", "1-on-1 strategy call", "Profile photography consultation", "Family liaison service", "Unlimited profile boosts", "Financial due diligence", "24 / 7 WhatsApp concierge"],
    cta: "Schedule a call",
    ctaHref: "/contact?subject=VIP+Concierge",
    bespoke: true,
  },
];

export default function PricingPage() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>(".editorial-reveal");
    if (!els.length || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#fdf9f4", color: "#1a0a14" }}>
      <PublicHeader />

      {/* ── Editorial hero ───────────────────────────────────── */}
      <section style={{ padding: "clamp(64px, 9vw, 120px) 24px clamp(48px, 6vw, 72px)", background: "linear-gradient(180deg, #fdf9f4 0%, #faf3eb 100%)" }}>
        <div className="max-w-4xl mx-auto" style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#a78a8f", marginBottom: 24 }}>
            <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
            Membership
            <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(28px, 4vw, 52px)",
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              marginBottom: 20,
            }}
          >
            Four ways to{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              begin.
            </span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", lineHeight: 1.7, color: "#4a3a40", maxWidth: 580, margin: "0 auto" }}>
            Choose the level of guidance that suits your family. Every plan
            includes hand-picked introductions, full discretion, and a real
            advisor on the other end of the line.
          </p>
        </div>
      </section>

      {/* ── Plans ─────────────────────────────────────────────── */}
      <section className="editorial-reveal" style={{ padding: "0 24px clamp(56px, 7vw, 88px)", background: "#fdf9f4" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ gap: 0 }}>
          {plans.map((plan, i) => {
            const isDark = !!plan.bespoke;
            const accent = isDark ? "#ffd87a" : "#dc1e3c";
            return (
              <article
                key={plan.name}
                style={{
                  position: "relative",
                  background: isDark ? "#1a0a14" : "#fdf9f4",
                  color: isDark ? "#fdf9f4" : "#1a0a14",
                  padding: "44px 28px 36px",
                  borderTop: "1px solid rgba(26,10,20,0.16)",
                  borderRight: i < plans.length - 1 ? `1px solid ${isDark ? "rgba(255,220,180,0.18)" : "rgba(26,10,20,0.10)"}` : "none",
                  borderBottom: "1px solid rgba(26,10,20,0.16)",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {plan.recommended && (
                  <span
                    style={{
                      position: "absolute",
                      top: -1,
                      left: -1,
                      background: "#dc1e3c",
                      color: "#fdf9f4",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.1em",
                      padding: "6px 14px",
                    }}
                  >
                    Most chosen
                  </span>
                )}

                <h2 className="font-display" style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.01em", marginBottom: 6 }}>
                  {plan.name}
                </h2>
                <p
                  className="font-display-alt"
                  style={{
                    fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                    fontStyle: "italic",
                    fontSize: 16,
                    color: isDark ? "rgba(253,249,244,0.7)" : "#88787f",
                    margin: "0 0 28px",
                    lineHeight: 1.4,
                  }}
                >
                  {plan.tagline}
                </p>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
                  <span className="font-display" style={{ fontSize: plan.bespoke ? 28 : 36, fontWeight: 600, letterSpacing: "-0.02em", color: accent }}>
                    {plan.price}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: isDark ? "rgba(253,249,244,0.55)" : "#88787f", margin: "0 0 6px", letterSpacing: "0.02em" }}>
                  {plan.period}
                </p>
                <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: isDark ? "rgba(255,220,180,0.65)" : "#a78a8f", margin: "12px 0 28px" }}>
                  Best for · {plan.bestFor}
                </p>

                <hr style={{ border: 0, borderTop: `1px solid ${isDark ? "rgba(255,220,180,0.20)" : "rgba(26,10,20,0.10)"}`, margin: "0 0 24px" }} />

                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
                  {plan.features.map((f) => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13.5, lineHeight: 1.55, color: isDark ? "rgba(253,249,244,0.78)" : "#4a3a40" }}>
                      <Check size={13} strokeWidth={2.4} style={{ color: accent, marginTop: 4, flexShrink: 0 }} />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={plan.ctaHref}
                  target={plan.ctaHref.startsWith("http") ? "_blank" : undefined}
                  rel={plan.ctaHref.startsWith("http") ? "noopener noreferrer" : undefined}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    width: "100%",
                    padding: "13px 20px",
                    borderRadius: 9999,
                    fontSize: 13.5,
                    fontWeight: 600,
                    textDecoration: "none",
                    letterSpacing: "0.02em",
                    background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                    color: "#ffffff",
                    border: "1px solid transparent",
                    boxShadow: "0 6px 18px rgba(220,30,60,0.32)",
                    transition: "transform 0.25s cubic-bezier(.2,.7,.2,1), box-shadow 0.25s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-1.5px)";
                    e.currentTarget.style.boxShadow = "0 14px 32px rgba(220,30,60,0.42)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 6px 18px rgba(220,30,60,0.32)";
                  }}
                >
                  {plan.cta}
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
              </article>
            );
          })}
        </div>

        <p style={{ textAlign: "center", marginTop: 36, fontSize: 12.5, color: "#88787f", display: "inline-flex", alignItems: "center", gap: 8, justifyContent: "center", width: "100%", letterSpacing: "0.02em" }}>
          <Lock size={13} strokeWidth={1.8} />
          Secure payment · Cancel anytime · GDPR compliant
        </p>
      </section>

      {/* ── Closing note ──────────────────────────────────────── */}
      <section className="editorial-reveal" style={{ padding: "clamp(72px, 9vw, 120px) 24px", background: "#faf3eb" }}>
        <div className="max-w-3xl mx-auto" style={{ textAlign: "center" }}>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 20, color: "#1a0a14" }}>
            Not sure which is{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              right for you?
            </span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4a3a40", maxWidth: 520, margin: "0 auto 32px" }}>
            Speak to an advisor. We will talk through what you are looking for
            and recommend the level of support that suits your family.
          </p>
          <div style={{ display: "inline-flex", gap: 16, flexWrap: "wrap", justifyContent: "center" }}>
            <Link
              href="/contact"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#1a0a14", color: "#fdf9f4",
                padding: "14px 28px", borderRadius: 9999,
                fontSize: 14, fontWeight: 600, textDecoration: "none", letterSpacing: "0.02em",
              }}
            >
              Speak to an advisor <ArrowRight size={15} strokeWidth={2} />
            </Link>
            <Link
              href="/faq"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                padding: "14px 28px",
                border: "1px solid rgba(26,10,20,0.20)",
                borderRadius: 9999,
                fontSize: 14, fontWeight: 600, color: "#1a0a14", textDecoration: "none",
              }}
            >
              See common questions
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
