"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail, Phone, MessageCircle, MapPin, Clock, ArrowRight, Check,
} from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/* ────────────────────────────────────────────────────────────────
   Contact — editorial layout. Two columns: left for the prose
   greeting + contact details, right for a quiet enquiry form.
   ──────────────────────────────────────────────────────────────── */

const contactChannels = [
  { Icon: Mail,          label: "Email",   value: "enquiry@match4marriage.com",        href: "mailto:enquiry@match4marriage.com",  external: false },
  { Icon: Phone,         label: "Phone",   value: "+44 7476 212655",                    href: "tel:+447476212655",                  external: false },
  { Icon: MessageCircle, label: "WhatsApp", value: "Message us on WhatsApp",           href: "https://wa.me/447476212655",         external: true  },
] as const;

const officeHours = [
  { day: "Monday — Friday", hours: "9:00 AM — 6:00 PM BST" },
  { day: "Saturday",         hours: "10:00 AM — 4:00 PM BST" },
  { day: "Sunday",           hours: "Closed" },
];

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", subject: "", message: "" });
  const [sent, setSent] = useState(false);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "12px 0",
    border: 0,
    borderBottom: "1px solid rgba(26,10,20,0.18)",
    borderRadius: 0,
    fontSize: 15,
    color: "#1a0a14",
    background: "transparent",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "border-color 0.25s ease",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.22em",
    color: "#a78a8f",
    textTransform: "uppercase",
    display: "block",
    marginBottom: 6,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fdf9f4", color: "#1a0a14" }}>
      <PublicHeader />

      {/* ── Editorial hero ───────────────────────────────────── */}
      <section style={{ padding: "clamp(64px, 9vw, 120px) 24px clamp(48px, 6vw, 80px)", background: "linear-gradient(180deg, #fdf9f4 0%, #faf3eb 100%)" }}>
        <div className="max-w-4xl mx-auto" style={{ textAlign: "center" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", color: "#a78a8f", textTransform: "uppercase", marginBottom: 24 }}>
            <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
            Get in touch
            <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
          </span>
          <h1
            className="font-display"
            style={{
              fontSize: "clamp(40px, 6vw, 80px)",
              fontWeight: 500,
              lineHeight: 1.04,
              letterSpacing: "-0.025em",
              marginBottom: 20,
            }}
          >
            Speak to{" "}
            <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
              an advisor.
            </span>
          </h1>
          <p style={{ fontSize: "clamp(15px, 1.4vw, 18px)", lineHeight: 1.7, color: "#4a3a40", maxWidth: 580, margin: "0 auto" }}>
            No commitment, no pressure — just a friendly conversation about
            what you and your family are looking for. We typically respond
            within a few hours.
          </p>
        </div>
      </section>

      {/* ── Channels + form ──────────────────────────────────── */}
      <section className="editorial-reveal" style={{ padding: "clamp(48px, 7vw, 96px) 24px", background: "#fdf9f4" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">

          {/* Left — channels and hours */}
          <aside className="lg:col-span-5">
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 32 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", color: "#a78a8f", textTransform: "uppercase" }}>
                I — Reach us directly
              </span>
              <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
            </div>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 48px" }}>
              {contactChannels.map((c, i) => (
                <li key={c.label} style={{ borderTop: i === 0 ? "1px solid rgba(26,10,20,0.10)" : "none", borderBottom: "1px solid rgba(26,10,20,0.10)", padding: "20px 0" }}>
                  <a
                    href={c.href}
                    target={c.external ? "_blank" : undefined}
                    rel={c.external ? "noopener noreferrer" : undefined}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "auto 1fr auto",
                      gap: 20,
                      alignItems: "center",
                      textDecoration: "none",
                      color: "#1a0a14",
                    }}
                  >
                    <c.Icon size={18} strokeWidth={1.4} style={{ color: "#dc1e3c", opacity: 0.85 }} />
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.22em", color: "#a78a8f", textTransform: "uppercase", margin: "0 0 4px" }}>
                        {c.label}
                      </p>
                      <p className="font-display" style={{ fontSize: 17, fontWeight: 500, color: "#1a0a14", margin: 0, letterSpacing: "-0.005em" }}>
                        {c.value}
                      </p>
                    </div>
                    <ArrowRight size={14} strokeWidth={1.6} style={{ color: "#a78a8f" }} />
                  </a>
                </li>
              ))}
            </ul>

            {/* Office */}
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 24 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", color: "#a78a8f", textTransform: "uppercase" }}>
                Office hours
              </span>
              <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
            </div>
            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px" }}>
              {officeHours.map((h) => (
                <li key={h.day} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(26,10,20,0.06)", fontSize: 14 }}>
                  <span style={{ color: "#4a3a40" }}>{h.day}</span>
                  <span style={{ color: "#1a0a14", fontWeight: 600 }}>{h.hours}</span>
                </li>
              ))}
            </ul>

            <div style={{ display: "inline-flex", alignItems: "flex-start", gap: 12, fontSize: 13, color: "#88787f", lineHeight: 1.55, marginTop: 12 }}>
              <MapPin size={15} strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>282 Warwick Road, Solihull, England, B92 7AF</span>
            </div>
            <div style={{ display: "inline-flex", alignItems: "flex-start", gap: 12, fontSize: 13, color: "#88787f", lineHeight: 1.55, marginTop: 12 }}>
              <Clock size={15} strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
              <span>
                Have a general question? See our{" "}
                <Link href="/faq" style={{ color: "#1a0a14", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid rgba(26,10,20,0.2)" }}>FAQ</Link>{" "}
                first.
              </span>
            </div>
          </aside>

          {/* Right — enquiry form */}
          <div className="lg:col-span-7">
            <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 32 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.32em", color: "#a78a8f", textTransform: "uppercase" }}>
                II — Send an enquiry
              </span>
              <span style={{ flex: 1, height: 1, background: "rgba(26,10,20,0.10)" }} />
            </div>

            {sent ? (
              <div style={{ padding: "48px 32px", border: "1px solid rgba(26,10,20,0.10)", borderRadius: 4, textAlign: "center", background: "#faf3eb" }}>
                <Check size={36} strokeWidth={1.4} style={{ color: "#dc1e3c", margin: "0 auto 16px" }} />
                <h3 className="font-display" style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.015em", marginBottom: 12 }}>
                  Message received.
                </h3>
                <p style={{ fontSize: 15, color: "#4a3a40", lineHeight: 1.65, marginBottom: 24 }}>
                  Thank you. One of our advisors will be in touch within
                  twenty-four hours.
                </p>
                <button
                  onClick={() => setSent(false)}
                  style={{
                    background: "transparent",
                    border: "1px solid rgba(26,10,20,0.20)",
                    padding: "10px 22px",
                    borderRadius: 9999,
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    color: "#1a0a14",
                  }}
                >
                  Send another
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 28 }}>
                  <div>
                    <label htmlFor="cf-name" style={labelStyle}>Your name</label>
                    <input
                      id="cf-name"
                      type="text"
                      placeholder="—"
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="cf-email" style={labelStyle}>Email</label>
                    <input
                      id="cf-email"
                      type="email"
                      placeholder="—"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 28 }}>
                  <div>
                    <label htmlFor="cf-phone" style={labelStyle}>Phone (optional)</label>
                    <input
                      id="cf-phone"
                      type="tel"
                      placeholder="—"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="cf-subject" style={labelStyle}>Subject</label>
                    <select
                      id="cf-subject"
                      value={form.subject}
                      onChange={(e) => setForm({ ...form, subject: e.target.value })}
                      style={{ ...inputStyle, color: form.subject ? "#1a0a14" : "#a78a8f", appearance: "none", cursor: "pointer", paddingRight: 28 }}
                    >
                      <option value="">Select a subject</option>
                      <option>General enquiry</option>
                      <option>Registration help</option>
                      <option>Subscription &amp; billing</option>
                      <option>Profile verification</option>
                      <option>Report an issue</option>
                      <option>Other</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="cf-message" style={labelStyle}>Message</label>
                  <textarea
                    id="cf-message"
                    rows={5}
                    placeholder="Tell us a little about what you and your family are looking for…"
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    style={{ ...inputStyle, resize: "none", padding: "12px 0", lineHeight: 1.6 }}
                  />
                </div>

                <button
                  type="submit"
                  style={{
                    alignSelf: "flex-start",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    background: "#1a0a14",
                    color: "#fdf9f4",
                    padding: "14px 28px",
                    borderRadius: 9999,
                    fontSize: 14,
                    fontWeight: 600,
                    border: 0,
                    cursor: "pointer",
                    letterSpacing: "0.02em",
                  }}
                >
                  Send enquiry <ArrowRight size={15} strokeWidth={2} />
                </button>

                <p style={{ fontSize: 12, color: "#88787f", margin: 0, letterSpacing: "0.02em" }}>
                  By sending an enquiry you agree to our{" "}
                  <Link href="/privacy" style={{ color: "#1a0a14", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid rgba(26,10,20,0.20)" }}>privacy policy</Link>.
                  Your details are never shared.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
