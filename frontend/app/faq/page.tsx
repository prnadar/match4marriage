"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Minus, ArrowRight } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/* ────────────────────────────────────────────────────────────────
   FAQ — editorial. Numbered chapters, quiet accordion, restrained
   typography. The same design language as /about and /pricing.
   ──────────────────────────────────────────────────────────────── */

const categories: Array<{ n: string; name: string; intro: string; faqs: { q: string; a: string }[] }> = [
  {
    n: "I",
    name: "Getting started",
    intro: "What to expect when you first reach out.",
    faqs: [
      {
        q: "How is Match4Marriage different from other matrimony sites?",
        a: "We are a boutique service, not a mass-market platform. Every profile is hand-picked and personally vetted by our team. We focus on quality introductions, not volume.",
      },
      {
        q: "How does the matching process work?",
        a: "Once you register, our advisors review your profile and preferences. We personally curate compatible introductions. No swiping, no endless browsing — just meaningful, considered matches.",
      },
      {
        q: "Who can register on Match4Marriage?",
        a: "Match4Marriage is open to all Indian and South Asian communities worldwide — Hindu, Muslim, Christian, Sikh, Jain and others. We welcome NRIs and diaspora from the UK, India, UAE, Canada, Australia, USA and beyond.",
      },
    ],
  },
  {
    n: "II",
    name: "Privacy & safety",
    intro: "How we protect what you share with us.",
    faqs: [
      {
        q: "Is my information kept private?",
        a: "Absolutely. Your contact details and personal information are never shared without your explicit consent. All data is handled in compliance with UK GDPR regulations.",
      },
      {
        q: "How are profiles verified?",
        a: "Every profile undergoes a manual review by our team. Members are ID-verified using government documents, not just auto-checked. We personally assess each profile before approval.",
      },
      {
        q: "Can I control who sees my profile?",
        a: "Yes. You have full control over your profile visibility. You can hide specific details and share contact information only with matches you choose to connect with.",
      },
    ],
  },
  {
    n: "III",
    name: "Matching & timeline",
    intro: "How long, who is involved, and what happens after the introduction.",
    faqs: [
      {
        q: "How long does it typically take to find a match?",
        a: "Every journey is unique. Some members find their match within weeks; others take a few months. We guide you at every stage and never rush the process.",
      },
      {
        q: "Do you serve families outside the UK?",
        a: "Yes. While our primary focus is the British Indian community, we connect families globally — including India, UAE, Canada, Australia, and the USA.",
      },
      {
        q: "Can my family be involved in the process?",
        a: "Absolutely. We actively encourage family involvement. Our Family Mode feature allows trusted family members to browse and suggest matches on your behalf.",
      },
    ],
  },
  {
    n: "IV",
    name: "Pricing & plans",
    intro: "Costs, billing, and how to change or cancel.",
    faqs: [
      {
        q: "Is there a free plan?",
        a: "We offer four membership tiers, starting at £100 for six months. Each plan includes hand-picked introductions and access to your assigned advisor. See the full pricing page for what each tier includes.",
      },
      {
        q: "What does the Premium plan include?",
        a: "Premium (£300 / 6 months) gives you unlimited expressions of interest, direct messaging, photo access, advanced filters and priority placement.",
      },
      {
        q: "Can I cancel my subscription?",
        a: "Yes, you can cancel at any time. Your subscription remains active until the end of the billing period. We do not offer pro-rata refunds but will always work with you if you have concerns.",
      },
    ],
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>("I-0");

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
      <section style={{ padding: "clamp(64px, 9vw, 120px) 24px clamp(48px, 6vw, 80px)", background: "linear-gradient(180deg, #fdf9f4 0%, #faf3eb 100%)" }}>
        <div className="max-w-4xl mx-auto" style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#a78a8f", marginBottom: 24 }}>
            <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
            Help centre
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
            Common{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              questions.
            </span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", lineHeight: 1.7, color: "#4a3a40", maxWidth: 560, margin: "0 auto" }}>
            Most things you might be wondering, in one place. Can&apos;t find
            what you need?{" "}
            <Link href="/contact" style={{ color: "#1a0a14", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid rgba(26,10,20,0.25)" }}>
              Speak to an advisor
            </Link>.
          </p>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────── */}
      <section style={{ padding: "clamp(48px, 7vw, 96px) 24px clamp(56px, 7vw, 88px)", background: "#fdf9f4" }}>
        <div className="max-w-4xl mx-auto">
          {categories.map((cat) => (
            <div key={cat.name} className="editorial-reveal" style={{ marginBottom: 64 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 16 }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#a78a8f" }}>
                  {cat.n} — {cat.name}
                </span>
                <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
              </div>
              <p
                className="font-display-alt"
                style={{
                  fontFamily: "var(--font-display-alt, 'Cormorant', serif)",
                  fontStyle: "italic",
                  fontSize: 18,
                  color: "#4a3a40",
                  marginBottom: 24,
                  lineHeight: 1.5,
                }}
              >
                {cat.intro}
              </p>

              <div>
                {cat.faqs.map((faq, i) => {
                  const key = `${cat.n}-${i}`;
                  const isOpen = open === key;
                  return (
                    <div key={key} style={{ borderBottom: "1px solid rgba(26,10,20,0.10)" }}>
                      <button
                        onClick={() => setOpen(isOpen ? null : key)}
                        style={{
                          width: "100%",
                          padding: "22px 0",
                          background: "none",
                          border: 0,
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 16,
                          textAlign: "left",
                          fontFamily: "inherit",
                          color: "#1a0a14",
                        }}
                        aria-expanded={isOpen}
                      >
                        <span className="font-display" style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.4, letterSpacing: "-0.005em" }}>
                          {faq.q}
                        </span>
                        <span style={{ flexShrink: 0, color: "#dc1e3c" }}>
                          {isOpen ? <Minus size={18} strokeWidth={2} /> : <Plus size={18} strokeWidth={2} />}
                        </span>
                      </button>
                      {isOpen && (
                        <p style={{ paddingBottom: 22, fontSize: 14.5, lineHeight: 1.75, color: "#4a3a40", margin: 0, maxWidth: 680 }}>
                          {faq.a}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────── */}
      <section className="editorial-reveal" style={{ padding: "clamp(72px, 9vw, 120px) 24px", background: "#faf3eb" }}>
        <div className="max-w-3xl mx-auto" style={{ textAlign: "center" }}>
          <h2 className="font-display" style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 500, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 16, color: "#1a0a14" }}>
            Still have a{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              question?
            </span>
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4a3a40", maxWidth: 520, margin: "0 auto 32px" }}>
            Our advisors are here to help. We typically respond within
            twenty-four hours.
          </p>
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
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
