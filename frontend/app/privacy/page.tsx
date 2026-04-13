import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const metadata = {
  title: "Privacy Policy | Match4Marriage",
  description: "Privacy Policy for Match4Marriage Limited: how we collect, use, and protect your personal information.",
};

const sections = [
  {
    id: "introduction",
    title: "1. Introduction",
    content: [
      "Match4Marriage (www.match4marriage.com) is an electronic web-based platform for exploring matrimonial opportunities and enhancing outreach using online search and other tools available for prospective brides and prospective grooms.",
      "The website is owned and operated by Match4Marriage Limited (\u201cCompany\u201d), a company registered in England and Wales (Company No. 15272378), with its registered office at 282 Warwick Road, Solihull, England, B92 7AF.",
      "Match4Marriage is committed to safeguarding the privacy of its Users. All our users are requested to read the following Privacy Policy to have a complete understanding of how their personal information will be treated as they associate themselves with Match4Marriage and make full use of our services for matrimonial purposes.",
      "This policy is exclusively applicable on the entire platform operated by Match4Marriage and not beyond. Match4Marriage may amend this policy at any time by posting the amended version on this site. Such amended version shall automatically be effective upon its posting. You are advised to check this section at regular intervals to be updated on developments.",
    ],
  },
  {
    id: "information-collection",
    title: "2. Personal Information Collection",
    content: [
      "Match4Marriage collects information from its Users at the time of registration as well as at certain specific instances of usage of our services, wherein they are requested to provide their personal information including contact information.",
      "These forms usually seek information such as name, gender, email address, date of birth, educational qualification, employment details, photos, marital status, and your interests, contact modes and specifics.",
      "As a User using the free or paid services of Match4Marriage, it is deemed that the User has granted Match4Marriage the right to use, without any restriction, the posted information and publish the desired details throughout its platform, including all divisions, sister concerns, ventures, directories, listing, website pages, and associated media.",
      "The personal information requested by Match4Marriage is for usage at Match4Marriage to provide the necessary chosen services and enhancement of services by itself or by any authorised third party of Match4Marriage. If you choose to share it with some User, Visitor, or Third Party explicitly, then Match4Marriage has no role in data protection in such cases. Further, if you think that the information we hold about you is inaccurate or we are not entitled or require the same, you can contact us at enquiry@match4marriage.com.",
    ],
  },
  {
    id: "use-of-information",
    title: "3. Use of Personal Information",
    content: [
      "Match4Marriage uses your personal information to provide, personalise, and improve our matrimonial matching services, to communicate with you about your account and our services, and to send you updates, newsletters, and relevant marketing communications (with your consent).",
      "We may use aggregated, anonymised data for research and analytics purposes to improve the platform and user experience. This data will not identify you personally.",
      "We will never sell your personal information to third parties for their own marketing purposes.",
    ],
  },
  {
    id: "cookies",
    title: "4. Cookies & Tracking Technologies",
    content: [
      "Match4Marriage uses cookies and similar tracking technologies to enhance your experience on our platform. Cookies are small text files stored on your device that help us remember your preferences and understand how you use our site.",
      "We use essential cookies (required for the platform to function), analytical cookies (to understand usage patterns), and preference cookies (to remember your settings).",
      "You can control and manage cookies through your browser settings. Please note that disabling certain cookies may affect the functionality of our service.",
    ],
  },
  {
    id: "data-sharing",
    title: "5. Sharing of Information",
    content: [
      "Match4Marriage does not share your personal information with third parties except in the following circumstances: (a) with your explicit consent; (b) with trusted service providers who assist us in operating the platform, subject to strict confidentiality agreements; (c) where required by law, regulation, or court order; or (d) to protect the rights, property, or safety of Match4Marriage, our users, or the public.",
      "When you express interest in another member or respond to an interest, limited profile information is shared between the two parties to facilitate the introduction. Full contact details are only shared upon mutual consent.",
      "We do not transfer your personal data outside the United Kingdom or European Economic Area without ensuring adequate protections are in place, in accordance with UK GDPR requirements.",
    ],
  },
  {
    id: "data-security",
    title: "6. Data Security",
    content: [
      "Match4Marriage takes the security of your personal information seriously. We implement appropriate technical and organisational measures to protect your data against unauthorised access, alteration, disclosure, or destruction.",
      "All data is transmitted using SSL (Secure Socket Layer) encryption. Our systems and databases are protected by industry-standard security protocols and are regularly reviewed.",
      "However, no method of transmission over the internet or electronic storage is 100% secure. While we strive to protect your personal information, we cannot guarantee its absolute security. In the event of a data breach that is likely to result in a risk to your rights and freedoms, we will notify you and the relevant authorities as required by UK GDPR.",
    ],
  },
  {
    id: "retention",
    title: "7. Data Retention",
    content: [
      "We retain your personal information for as long as your account is active or as needed to provide you with our services. You may request deletion of your account and personal data at any time by contacting us at enquiry@match4marriage.com.",
      "Even after deletion, we may retain certain information as required by law or for legitimate business purposes such as fraud prevention, resolving disputes, and enforcing our agreements.",
      "Anonymised and aggregated data, which cannot identify you personally, may be retained indefinitely for analytical purposes.",
    ],
  },
  {
    id: "your-rights",
    title: "8. Your Rights Under UK GDPR",
    content: [
      "As a data subject under UK GDPR, you have the following rights: (a) the right to access the personal data we hold about you; (b) the right to rectify inaccurate or incomplete data; (c) the right to erasure ('right to be forgotten'); (d) the right to restrict processing; (e) the right to data portability; (f) the right to object to processing; and (g) rights in relation to automated decision making and profiling.",
      "To exercise any of these rights, please contact us at enquiry@match4marriage.com. We will respond to your request within 30 days as required by law.",
      "You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk if you believe your data protection rights have been violated.",
    ],
  },
  {
    id: "third-party",
    title: "9. Third-Party Links",
    content: [
      "Our platform may contain links to third-party websites, apps, or services. This Privacy Policy does not apply to those third-party sites, and we are not responsible for their privacy practices.",
      "We encourage you to read the privacy policies of any third-party sites you visit. The inclusion of a link on our platform does not imply our endorsement of that site or its privacy practices.",
    ],
  },
  {
    id: "children",
    title: "10. Children's Privacy",
    content: [
      "Match4Marriage is intended for users who are 18 years of age or older. We do not knowingly collect personal information from individuals under the age of 18.",
      "If you believe that we have inadvertently collected personal information from a minor, please contact us immediately at enquiry@match4marriage.com and we will take steps to delete such information.",
    ],
  },
  {
    id: "changes",
    title: "11. Changes to This Policy",
    content: [
      "Match4Marriage reserves the right to update or modify this Privacy Policy at any time. When we make material changes, we will notify you by email or by posting a prominent notice on our platform prior to the change becoming effective.",
      "The date of the last revision is indicated at the top of this policy. Your continued use of the Match4Marriage service following the posting of any changes constitutes your acceptance of the revised policy.",
    ],
  },
  {
    id: "contact",
    title: "12. Contact & Grievance",
    content: [
      "If you have any questions, concerns, or complaints regarding this Privacy Policy or the handling of your personal data, please contact us:",
    ],
    contact: true,
  },
];

export default function PrivacyPage() {
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
            Privacy Policy
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
              }}>
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
            <span style={{ fontSize: "20px", flexShrink: 0 }}>🔒</span>
            <p style={{ fontSize: "13px", color: "#555", lineHeight: 1.7, margin: 0 }}>
              Your privacy matters to us. This policy explains how Match4Marriage collects, uses, and protects your personal information in accordance with the{" "}
              <strong>UK General Data Protection Regulation (UK GDPR)</strong> and the Data Protection Act 2018. If you have any questions, contact us at{" "}
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
                        { icon: "⚖️", label: "Regulator", value: "Information Commissioner's Office (ICO) — ico.org.uk", href: "https://ico.org.uk" },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", gap: "16px", marginBottom: "14px", alignItems: "flex-start" }}>
                          <span style={{ fontSize: "16px", flexShrink: 0, marginTop: "1px" }}>{item.icon}</span>
                          <div>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 2px" }}>{item.label}</p>
                            {item.href ? (
                              <a href={item.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: "14px", color: "#dc1e3c", fontWeight: 600, textDecoration: "none" }}>{item.value}</a>
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
              This Privacy Policy was last updated on <strong>23 March 2026</strong>.
            </p>
            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
              <Link href="/terms" style={{ fontSize: "13px", color: "#dc1e3c", textDecoration: "none", fontWeight: 600 }}>Terms & Conditions →</Link>
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
