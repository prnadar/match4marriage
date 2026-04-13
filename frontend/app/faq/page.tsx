"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Minus } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const categories = [
  {
    name: "Getting Started",
    faqs: [
      {
        q: "How is Match4Marriage different from other matrimony sites?",
        a: "We are a boutique service, not a mass-market platform. Every profile is hand-picked and personally vetted by our team. We focus on quality introductions, not volume.",
      },
      {
        q: "How does the matching process work?",
        a: "Once you register, our advisors review your profile and preferences. We personally curate compatible introductions for you. No swiping, no endless browsing. Just meaningful, considered matches.",
      },
      {
        q: "Who can register on Match4Marriage?",
        a: "Match4Marriage is open to all Indian and South Asian communities worldwide: Hindu, Muslim, Christian, Sikh, Jain and others. We welcome NRIs and diaspora from the UK, India, UAE, Canada, Australia, USA and beyond.",
      },
    ],
  },
  {
    name: "Privacy & Safety",
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
        a: "Yes. You have full control over your profile visibility. You can hide specific details and only share contact information with matches you choose to connect with.",
      },
    ],
  },
  {
    name: "Matching & Timeline",
    faqs: [
      {
        q: "How long does it typically take to find a match?",
        a: "Every journey is unique. Some of our members have found their match within weeks; others take a few months. We guide you at every stage and never rush the process.",
      },
      {
        q: "Do you serve families outside the UK?",
        a: "Yes. While our primary focus is the British Indian community, we connect families globally, including India, UAE, Canada, Australia, and the USA.",
      },
      {
        q: "Can my family be involved in the process?",
        a: "Absolutely. We actively encourage family involvement. Our Family Mode feature allows trusted family members to browse and suggest matches on your behalf.",
      },
    ],
  },
  {
    name: "Pricing & Plans",
    faqs: [
      {
        q: "Is there a free plan?",
        a: "Yes. Our Basic plan is completely free. You can create a profile, get verified, and receive up to 5 profile introductions per month at no cost.",
      },
      {
        q: "What does the Premium plan include?",
        a: "The Premium plan at £100/3 months gives you unlimited profile views, advanced search filters, unlimited interests, photo access and priority matching.",
      },
      {
        q: "Can I cancel my subscription?",
        a: "Yes, you can cancel at any time. Your subscription remains active until the end of the billing period. We do not offer pro-rata refunds but will always work with you if you have concerns.",
      },
    ],
  },
];

export default function FAQPage() {
  const [open, setOpen] = useState<string | null>(null);

  const toggle = (key: string) => setOpen(open === key ? null : key);

  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf9", fontFamily: "var(--font-poppins, sans-serif)" }}>
      <PublicHeader />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 50%, #3b3fa0 100%)", padding: "72px 24px 56px", textAlign: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.2em", display: "block", marginBottom: "12px" }}>
          Help Centre
        </span>
        <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
          Frequently Asked Questions
        </h1>
        <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)", maxWidth: "500px", margin: "0 auto 32px" }}>
          Everything you need to know about Match4Marriage. Can&apos;t find your answer?{" "}
          <Link href="/contact" style={{ color: "#ffd87a", textDecoration: "none", fontWeight: 600 }}>Contact us</Link>.
        </p>
      </div>

      {/* FAQ content */}
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "64px 24px" }}>
        {categories.map((cat) => (
          <div key={cat.name} style={{ marginBottom: "48px" }}>
            {/* Category header */}
            <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "22px", fontWeight: 700, color: "#1a0a14", marginBottom: "24px", paddingBottom: "12px", borderBottom: "2px solid rgba(220,30,60,0.12)" }}>
              {cat.name}
            </h2>

            {/* FAQ items */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
              {cat.faqs.map((faq, i) => {
                const key = `${cat.name}-${i}`;
                const isOpen = open === key;
                return (
                  <div key={key} style={{ borderBottom: "1px solid rgba(220,30,60,0.08)" }}>
                    <button
                      onClick={() => toggle(key)}
                      style={{
                        width: "100%", padding: "20px 0", background: "none", border: "none",
                        cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px",
                        textAlign: "left",
                      }}
                    >
                      <span style={{ fontSize: "15px", fontWeight: 600, color: "#1a0a14", lineHeight: 1.5 }}>{faq.q}</span>
                      <span style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", background: isOpen ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "rgba(220,30,60,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {isOpen
                          ? <Minus style={{ width: "12px", height: "12px", color: "#fff" }} />
                          : <Plus style={{ width: "12px", height: "12px", color: "#dc1e3c" }} />
                        }
                      </span>
                    </button>
                    {isOpen && (
                      <p style={{ fontSize: "14px", color: "#666", lineHeight: 1.8, paddingBottom: "20px", margin: 0 }}>
                        {faq.a}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Still have questions */}
        <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", textAlign: "center", border: "1px solid rgba(220,30,60,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.05)" }}>
          <p style={{ fontSize: "28px", marginBottom: "12px" }}>💬</p>
          <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "22px", fontWeight: 700, color: "#1a0a14", marginBottom: "8px" }}>
            Still have questions?
          </h3>
          <p style={{ fontSize: "14px", color: "#888", marginBottom: "24px" }}>
            Our team is here to help. Get in touch and we&apos;ll respond within 24 hours.
          </p>
          <Link href="/contact" style={{ display: "inline-block", padding: "12px 32px", borderRadius: "9999px", background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff", fontWeight: 700, fontSize: "14px", textDecoration: "none" }}>
            Contact Us
          </Link>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
