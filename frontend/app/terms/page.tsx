import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const metadata = {
  title: "Terms & Conditions | Match4Marriage",
  description: "Terms and Conditions of Use for Match4Marriage Limited, the UK elite Indian matrimonial service.",
};

const sections = [
  {
    id: "introduction",
    title: "1. Introduction",
    content: [
      "Welcome to Match4Marriage. These Terms and Conditions govern your use of the Match4Marriage website and services operated by Match4Marriage Limited (Company No. 15272378), a company registered in England and Wales at 282 Warwick Road, Solihull, England, B92 7AF.",
      "By accessing or using our service, you confirm that you have read, understood, and agree to be bound by these Terms and Conditions and our Privacy Policy. If you do not agree to these terms, you may not use the Match4Marriage service.",
      "We reserve the right to modify these Terms at any time. Any changes will be posted on this page. Your continued use of the service following any such modifications constitutes your acceptance of the updated Terms.",
    ],
  },
  {
    id: "eligibility",
    title: "2. Eligibility",
    content: [
      "You must be at least 18 years of age and legally eligible to marry in your country of residence to register as a member of Match4Marriage.",
      "By registering, you represent and warrant that all information you provide is accurate, current, and complete. You agree to update your information promptly if it changes.",
      "Match4Marriage reserves the right to suspend or terminate your account if we have reason to believe you do not meet the eligibility requirements.",
    ],
  },
  {
    id: "registration",
    title: "3. Registration & Account Responsibilities",
    content: [
      "To become a member, you must register by submitting a valid email address, selecting a password, and providing the personal information requested during the registration process.",
      "You are solely responsible for maintaining the confidentiality of your login credentials. All activity that occurs under your account is your responsibility, whether or not you have authorised such use.",
      "You agree to notify Match4Marriage immediately of any unauthorised use of your account or any other breach of security at enquiry@match4marriage.com.",
      "You must not create more than one account, impersonate any person or entity, or misrepresent your identity or affiliation.",
    ],
  },
  {
    id: "conduct",
    title: "4. Acceptable Use",
    content: [
      "You agree to use Match4Marriage solely for lawful, personal, non-commercial purposes related to finding a life partner.",
      "You must not use the service to: harass, abuse, or harm other members; post false, misleading, or fraudulent information; solicit money or financial information from other members; promote or distribute commercial content or spam; or engage in any activity that violates applicable law.",
      "Match4Marriage reserves the right to remove any content and suspend or terminate any account that violates these guidelines, at our sole discretion and without prior notice.",
    ],
  },
  {
    id: "content",
    title: "5. User Content",
    content: [
      "By submitting photos, profile information, or any other content to Match4Marriage, you grant us a non-exclusive, royalty-free, worldwide licence to use, display, and distribute that content solely for the purposes of operating and promoting the service.",
      "You represent and warrant that you own or have the necessary rights to all content you submit, and that it does not infringe the intellectual property or privacy rights of any third party.",
      "You understand and agree that content submitted by all users, including your own, may be collected, aggregated, and anonymised for the purposes of improving the service, subject to our Privacy Policy and applicable UK data protection law.",
    ],
  },
  {
    id: "payments",
    title: "6. Fees & Payments",
    content: [
      "Match4Marriage offers both free and paid membership plans. The features available under each plan are described on our Pricing page and are subject to change.",
      "All fees are displayed in the currency shown at checkout and are inclusive of applicable taxes unless otherwise stated.",
      "Fees once paid are non-refundable except where required by applicable law, including your statutory rights as a consumer under UK law. If you believe you are entitled to a refund, please contact us at enquiry@match4marriage.com.",
      "Subscriptions will auto-renew at the end of each billing period unless cancelled before the renewal date. You may cancel at any time via your account settings.",
    ],
  },
  {
    id: "privacy",
    title: "7. Privacy & Data Protection",
    content: [
      "Match4Marriage is committed to protecting your personal data in accordance with the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.",
      "Your personal information will never be shared with third parties without your explicit consent, except where required by law or for the purposes of operating the service as described in our Privacy Policy.",
      "By using our service, you consent to the collection and processing of your personal data as described in our Privacy Policy, which forms part of these Terms.",
    ],
  },
  {
    id: "liability",
    title: "8. Limitation of Liability",
    content: [
      "Match4Marriage provides a platform to connect individuals seeking matrimonial matches. We do not guarantee that any particular match will result in a relationship or marriage.",
      "To the fullest extent permitted by applicable law, Match4Marriage shall not be liable for any indirect, incidental, special, or consequential loss or damage arising from your use of, or inability to use, the service.",
      "Match4Marriage will not be held liable for the conduct, actions, or representations of any member. You interact with other members at your own risk.",
      "Nothing in these Terms limits our liability for death or personal injury caused by our negligence, fraud, or any other liability that cannot be excluded under English law.",
    ],
  },
  {
    id: "termination",
    title: "9. Termination",
    content: [
      "You may close your account at any time by contacting us at enquiry@match4marriage.com or via your account settings.",
      "Match4Marriage reserves the right to suspend or permanently terminate your account, with or without notice, if you breach these Terms or if we reasonably believe your continued use poses a risk to other members or the service.",
      "Upon termination, your right to use the service will immediately cease. Provisions of these Terms that by their nature should survive termination will do so, including ownership, warranty disclaimers, and limitations of liability.",
    ],
  },
  {
    id: "governing-law",
    title: "10. Governing Law & Disputes",
    content: [
      "These Terms and Conditions are governed by and construed in accordance with the laws of England and Wales.",
      "Any disputes arising out of or in connection with these Terms shall first be subject to good-faith negotiation. If unresolved, disputes shall be subject to the exclusive jurisdiction of the courts of England and Wales.",
      "If you are a consumer based in another part of the UK or EU, you may also be entitled to bring a claim in your local courts.",
    ],
  },
  {
    id: "contact",
    title: "11. Contact Us",
    content: [
      "If you have any questions about these Terms and Conditions, please contact us:",
    ],
    contact: true,
  },
];

export default function TermsPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf9", fontFamily: "var(--font-poppins, sans-serif)" }}>

      {/* Nav */}
      <PublicHeader />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #1a0a14 0%, #2d0f20 100%)", padding: "72px 24px 56px" }}>
        <div style={{ maxWidth: "800px", margin: "0 auto", textAlign: "center" }}>
          <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.2em", display: "block", marginBottom: "16px" }}>
            Legal
          </span>
          <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
            Terms & Conditions
          </h1>
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", margin: 0 }}>
            Last updated: 23 March 2026 &nbsp;·&nbsp; Match4Marriage Limited (Co. No. 15272378)
          </p>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: "1152px", margin: "0 auto", padding: "64px 24px", display: "grid", gridTemplateColumns: "240px 1fr", gap: "64px", alignItems: "start" }}>

        {/* Sticky sidebar TOC */}
        <aside style={{ position: "sticky", top: "88px" }} className="hidden lg:block">
          <p style={{ fontSize: "11px", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: "16px" }}>
            Contents
          </p>
          <nav style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {sections.map((s) => (
              <a key={s.id} href={`#${s.id}`} style={{
                fontSize: "13px", color: "#888", textDecoration: "none",
                padding: "6px 12px", borderRadius: "6px",
                borderLeft: "2px solid transparent",
                transition: "all 0.15s",
              }}
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main style={{ minWidth: 0 }}>

          {/* Intro banner */}
          <div style={{
            background: "rgba(220,30,60,0.05)",
            border: "1px solid rgba(220,30,60,0.15)",
            borderRadius: "12px",
            padding: "20px 24px",
            marginBottom: "48px",
            display: "flex", gap: "12px", alignItems: "flex-start",
          }}>
            <span style={{ fontSize: "20px", flexShrink: 0 }}>📋</span>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, margin: 0 }}>
              Please read these Terms and Conditions carefully before using the Match4Marriage service. By registering or continuing to use our platform, you agree to be bound by these terms. If you have any questions, contact us at{" "}
              <a href="mailto:enquiry@match4marriage.com" style={{ color: "#dc1e3c", textDecoration: "none", fontWeight: 600 }}>enquiry@match4marriage.com</a>.
            </p>
          </div>

          {/* Sections */}
          <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
            {sections.map((section) => (
              <section key={section.id} id={section.id} style={{ scrollMarginTop: "88px" }}>
                <h2 style={{
                  fontFamily: "var(--font-playfair, serif)",
                  fontSize: "22px", fontWeight: 700, color: "#1a0a14",
                  marginBottom: "20px", paddingBottom: "12px",
                  borderBottom: "1px solid rgba(220,30,60,0.1)",
                }}>
                  {section.title}
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {section.content.map((para, i) => (
                    <p key={i} style={{ fontSize: "14px", color: "#555", lineHeight: 1.85, margin: 0 }}>
                      {para}
                    </p>
                  ))}
                  {section.contact && (
                    <div style={{
                      background: "#fff",
                      border: "1px solid rgba(220,30,60,0.1)",
                      borderRadius: "12px",
                      padding: "24px",
                      marginTop: "8px",
                    }}>
                      {[
                        { icon: "🏢", label: "Company", value: "Match4Marriage Limited" },
                        { icon: "📋", label: "Company No.", value: "15272378" },
                        { icon: "📍", label: "Address", value: "282 Warwick Road, Solihull, England, B92 7AF" },
                        { icon: "✉️", label: "Email", value: "enquiry@match4marriage.com", href: "mailto:enquiry@match4marriage.com" },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", gap: "16px", marginBottom: "14px", alignItems: "flex-start" }}>
                          <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{item.icon}</span>
                          <div>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 2px" }}>{item.label}</p>
                            {item.href ? (
                              <a href={item.href} style={{ fontSize: "14px", color: "#dc1e3c", fontWeight: 600, textDecoration: "none" }}>{item.value}</a>
                            ) : (
                              <p style={{ fontSize: "14px", color: "#333", margin: 0, fontWeight: 500 }}>{item.value}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>

          {/* Footer note */}
          <div style={{
            marginTop: "64px",
            padding: "24px",
            background: "#fff",
            borderRadius: "12px",
            border: "1px solid rgba(220,30,60,0.08)",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "13px", color: "#888", margin: "0 0 12px" }}>
              These Terms were last updated on <strong>23 March 2026</strong>. If you have any concerns, please contact our team.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/privacy" style={{ fontSize: "13px", color: "#dc1e3c", textDecoration: "none", fontWeight: 600 }}>Privacy Policy →</Link>
              <Link href="/" style={{ fontSize: "13px", color: "#dc1e3c", textDecoration: "none", fontWeight: 600 }}>Back to Home →</Link>
            </div>
          </div>

        </main>
      </div>

      {/* Footer */}
      <PublicFooter />

    </div>
  );
}
