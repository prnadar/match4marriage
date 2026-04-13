"use client";

import { useState } from "react";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf9", fontFamily: "var(--font-poppins, sans-serif)" }}>
      <PublicHeader />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 50%, #3b3fa0 100%)", padding: "72px 24px 56px", textAlign: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.2em", display: "block", marginBottom: "12px" }}>
          Get In Touch
        </span>
        <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
          Speak to Our Team
        </h1>
        <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)", maxWidth: "480px", margin: "0 auto" }}>
          Our advisors are here to help, no pressure, just a friendly conversation. We typically respond within a few hours.
        </p>
      </div>

      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: "48px", alignItems: "start" }}>

          {/* Left — contact info */}
          <div>
            <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "24px", fontWeight: 700, color: "#1a0a14", marginBottom: "24px" }}>
              Contact Details
            </h2>

            {[
              { icon: "✉️", label: "Email Us", value: "enquiry@match4marriage.com", href: "mailto:enquiry@match4marriage.com", color: "rgba(220,30,60,0.07)" },
              { icon: "📞", label: "Call Us", value: "+44 7476 212655", href: "tel:+447476212655", color: "rgba(220,30,60,0.07)" },
              { icon: "💬", label: "WhatsApp", value: "Message us on WhatsApp", href: "https://wa.me/447476212655", color: "rgba(37,211,102,0.08)" },
              { icon: "📍", label: "Address", value: "282 Warwick Road, Solihull, England, B92 7AF", href: null, color: "rgba(220,30,60,0.07)" },
            ].map((c) => (
              <div key={c.label} style={{ display: "flex", gap: "16px", alignItems: "flex-start", marginBottom: "24px" }}>
                <div style={{ width: "48px", height: "48px", borderRadius: "14px", background: c.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>
                  {c.icon}
                </div>
                <div>
                  <p style={{ fontSize: "11px", fontWeight: 700, color: "#bbb", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>{c.label}</p>
                  {c.href ? (
                    <a href={c.href} target={c.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
                      style={{ fontSize: "14px", color: c.label === "WhatsApp" ? "#25d366" : "#1a0a14", fontWeight: 600, textDecoration: "none" }}>
                      {c.value}
                    </a>
                  ) : (
                    <p style={{ fontSize: "14px", color: "#1a0a14", fontWeight: 500, margin: 0, lineHeight: 1.5 }}>{c.value}</p>
                  )}
                </div>
              </div>
            ))}

            {/* Office hours */}
            <div style={{ marginTop: "32px", padding: "24px", background: "#fff", borderRadius: "16px", border: "1px solid rgba(220,30,60,0.08)" }}>
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#1a0a14", marginBottom: "12px" }}>🕐 Office Hours</h3>
              {[
                { day: "Monday to Friday", hours: "9:00 AM to 6:00 PM BST" },
                { day: "Saturday", hours: "10:00 AM to 4:00 PM BST" },
                { day: "Sunday", hours: "Closed" },
              ].map(({ day, hours }) => (
                <div key={day} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", color: "#666" }}>{day}</span>
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#1a0a14" }}>{hours}</span>
                </div>
              ))}
            </div>

            <p style={{ marginTop: "24px", fontSize: "13px", color: "#aaa" }}>
              Have a general question? Check our{" "}
              <Link href="/faq" style={{ color: "#dc1e3c", fontWeight: 600, textDecoration: "none" }}>FAQ page</Link> first.
            </p>
          </div>

          {/* Right — enquiry form */}
          <div style={{ background: "#fff", borderRadius: "20px", padding: "40px", boxShadow: "0 4px 32px rgba(26,10,20,0.08)", border: "1px solid rgba(220,30,60,0.08)" }}>
            {sent ? (
              <div style={{ textAlign: "center", padding: "40px 0" }}>
                <p style={{ fontSize: "48px", marginBottom: "16px" }}>💌</p>
                <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "24px", fontWeight: 700, color: "#1a0a14", marginBottom: "12px" }}>
                  Message Sent!
                </h3>
                <p style={{ fontSize: "14px", color: "#888", lineHeight: 1.7 }}>
                  Thank you for reaching out. Our team will get back to you within 24 hours.
                </p>
                <button onClick={() => setSent(false)} style={{ marginTop: "24px", background: "none", border: "none", cursor: "pointer", fontSize: "13px", color: "#dc1e3c", fontWeight: 600 }}>
                  Send another message
                </button>
              </div>
            ) : (
              <>
                <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "22px", fontWeight: 700, color: "#1a0a14", marginBottom: "28px" }}>
                  Send an Enquiry
                </h3>
                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    {[
                      { key: "name", label: "Your Name", placeholder: "Prabhakar Sharma", type: "text" },
                      { key: "email", label: "Email Address", placeholder: "you@email.com", type: "email" },
                    ].map(({ key, label, placeholder, type }) => (
                      <div key={key}>
                        <label style={{ fontSize: "11px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>{label}</label>
                        <input
                          type={type}
                          placeholder={placeholder}
                          value={(form as Record<string, string>)[key]}
                          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                          required
                          style={{ width: "100%", padding: "12px 16px", border: "1px solid rgba(220,30,60,0.15)", borderRadius: "10px", fontSize: "13px", color: "#1a0a14", background: "#fdfbf9", outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    ))}
                  </div>

                  {[
                    { key: "phone", label: "Phone Number", placeholder: "+44 7XXX XXXXXX", type: "tel" },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={(form as Record<string, string>)[key]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        style={{ width: "100%", padding: "12px 16px", border: "1px solid rgba(220,30,60,0.15)", borderRadius: "10px", fontSize: "13px", color: "#1a0a14", background: "#fdfbf9", outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  ))}

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>Subject</label>
                    <select
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      style={{ width: "100%", padding: "12px 16px", border: "1px solid rgba(220,30,60,0.15)", borderRadius: "10px", fontSize: "13px", color: form.subject ? "#1a0a14" : "#aaa", background: "#fdfbf9", outline: "none", appearance: "none", boxSizing: "border-box", cursor: "pointer" }}
                    >
                      <option value="">Select a subject</option>
                      <option>General Enquiry</option>
                      <option>Registration Help</option>
                      <option>Subscription & Billing</option>
                      <option>Profile Verification</option>
                      <option>Report an Issue</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: "11px", fontWeight: 700, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: "6px" }}>Message</label>
                    <textarea
                      placeholder="How can we help you?"
                      rows={4}
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      style={{ width: "100%", padding: "12px 16px", border: "1px solid rgba(220,30,60,0.15)", borderRadius: "10px", fontSize: "13px", color: "#1a0a14", background: "#fdfbf9", outline: "none", resize: "none", boxSizing: "border-box" }}
                    />
                  </div>

                  <button
                    type="submit"
                    style={{ background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff", padding: "14px", borderRadius: "10px", fontSize: "14px", fontWeight: 700, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(220,30,60,0.25)" }}
                  >
                    Send Enquiry
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
