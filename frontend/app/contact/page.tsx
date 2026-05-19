"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail, MapPin, MessageCircle, ArrowRight, Check,
} from "lucide-react";
import { api } from "@/lib/api";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/* ────────────────────────────────────────────────────────────────
   Contact — modern card layout. Left column carries the prose
   greeting and quick contact cards; right column is an elevated
   burgundy form card with rounded inputs and red accent submit.
   ──────────────────────────────────────────────────────────────── */

export default function ContactPage() {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitError(null);
    setSubmitting(true);
    const fullName = `${form.firstName} ${form.lastName}`.trim();
    try {
      await api.post("/api/v1/enquiries", {
        name: fullName,
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        subject: form.subject || undefined,
        message: form.message.trim(),
        source: "contact_form",
      });
      setSent(true);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Could not send your enquiry. Please try again or email us directly.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: "#d4a2a8",
    display: "block",
    marginBottom: 8,
    letterSpacing: "0.01em",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "14px 16px",
    border: "1px solid rgba(253,249,244,0.10)",
    borderRadius: 10,
    background: "rgba(253,249,244,0.04)",
    color: "#fdf9f4",
    fontSize: 15,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    transition: "border-color 0.2s ease, background 0.2s ease",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#fdf9f4", color: "#1a0a14" }}>
      {/* Placeholder + focus styling for the dark form card */}
      <style dangerouslySetInnerHTML={{ __html: `
        .m4m-contact-input::placeholder,
        .m4m-contact-input::-webkit-input-placeholder { color: rgba(253,249,244,0.35); }
        .m4m-contact-input:focus {
          border-color: rgba(220,30,60,0.55) !important;
          background: rgba(253,249,244,0.07) !important;
        }
        .m4m-contact-input:hover:not(:focus) {
          border-color: rgba(253,249,244,0.20) !important;
        }
        .m4m-contact-submit:hover {
          background: #c4172f !important;
          transform: translateY(-1px);
        }
      `}} />

      <PublicHeader />

      <section className="editorial-reveal" style={{ padding: "clamp(72px, 9vw, 120px) 24px clamp(64px, 8vw, 112px)" }}>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">

          {/* ── Left column — heading, intro, contact cards ── */}
          <div className="lg:col-span-5">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 12, fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "#a78a8f", marginBottom: 20 }}>
              <span style={{ width: 28, height: 1, background: "rgba(220,30,60,0.4)" }} />
              Get in touch
            </span>

            <h1
              className="font-display"
              style={{
                fontSize: "clamp(28px, 4vw, 52px)",
                fontWeight: 500,
                lineHeight: 1.04,
                letterSpacing: "-0.025em",
                marginBottom: 24,
                color: "#1a0a14",
              }}
            >
              Speak to{" "}
              <span style={{ fontFamily: "var(--font-display-alt, 'Cormorant', serif)", fontStyle: "italic", color: "#dc1e3c" }}>
                an advisor.
              </span>
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.7, color: "#4a3a40", marginBottom: 48, maxWidth: 460 }}>
              Whether you have a question about our service, want to book a
              private call, or simply want to begin, we are here to help.
              We typically respond within a few hours.
            </p>

            {/* Email card */}
            <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 9999,
                background: "rgba(220,30,60,0.10)",
                display: "grid", placeItems: "center",
                flexShrink: 0,
              }}>
                <Mail size={20} strokeWidth={1.6} style={{ color: "#dc1e3c" }} />
              </div>
              <div>
                <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "#1a0a14", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                  Email Us
                </h3>
                <p style={{ fontSize: 14, color: "#88787f", margin: "0 0 6px" }}>
                  For general enquiries and support
                </p>
                <a href="mailto:enquiry@match4marriage.com" style={{ color: "#dc1e3c", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
                  enquiry@match4marriage.com
                </a>
              </div>
            </div>

            {/* WhatsApp card */}
            <div style={{ display: "flex", gap: 20, marginBottom: 28 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 9999,
                background: "rgba(220,30,60,0.10)",
                display: "grid", placeItems: "center",
                flexShrink: 0,
              }}>
                <MessageCircle size={20} strokeWidth={1.6} style={{ color: "#dc1e3c" }} />
              </div>
              <div>
                <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "#1a0a14", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                  WhatsApp
                </h3>
                <p style={{ fontSize: 14, color: "#88787f", margin: "0 0 6px" }}>
                  Mon to Sat, 9:00 AM to 6:00 PM BST
                </p>
                <a href="https://wa.me/447438612054" target="_blank" rel="noopener noreferrer" style={{ color: "#dc1e3c", fontSize: 15, fontWeight: 600, textDecoration: "none" }}>
                  +44 7438 612054
                </a>
              </div>
            </div>

            {/* Visit Us card */}
            <div style={{ display: "flex", gap: 20 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 9999,
                background: "rgba(220,30,60,0.10)",
                display: "grid", placeItems: "center",
                flexShrink: 0,
              }}>
                <MapPin size={20} strokeWidth={1.6} style={{ color: "#dc1e3c" }} />
              </div>
              <div>
                <h3 className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "#1a0a14", margin: "0 0 4px", letterSpacing: "-0.01em" }}>
                  Visit Us
                </h3>
                <p style={{ fontSize: 14, color: "#88787f", margin: "0 0 6px" }}>
                  Our UK office
                </p>
                <p style={{ fontSize: 15, color: "#1a0a14", margin: 0, lineHeight: 1.55, fontWeight: 500 }}>
                  282 Warwick Road<br />
                  Solihull, England, B92 7AF
                </p>
              </div>
            </div>
          </div>

          {/* ── Right column — elevated form card ── */}
          <div className="lg:col-span-7">
            <div style={{
              background: "#1a0a14",
              borderRadius: 20,
              padding: "clamp(28px, 4vw, 48px)",
              boxShadow: "0 30px 80px -20px rgba(26,10,20,0.30), 0 8px 24px -12px rgba(26,10,20,0.20)",
              border: "1px solid rgba(220,30,60,0.18)",
              position: "relative",
              overflow: "hidden",
            }}>
              {/* subtle radial accent in the corner */}
              <div aria-hidden="true" style={{
                position: "absolute",
                top: -120, right: -120,
                width: 320, height: 320,
                background: "radial-gradient(circle, rgba(220,30,60,0.18) 0%, rgba(220,30,60,0) 70%)",
                pointerEvents: "none",
              }} />

              {sent ? (
                <div style={{ position: "relative", textAlign: "center", padding: "32px 8px" }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 9999,
                    background: "rgba(220,30,60,0.15)",
                    display: "grid", placeItems: "center",
                    margin: "0 auto 20px",
                  }}>
                    <Check size={28} strokeWidth={2} style={{ color: "#dc1e3c" }} />
                  </div>
                  <h3 className="font-display" style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.015em", marginBottom: 12, color: "#fdf9f4" }}>
                    Message received.
                  </h3>
                  <p style={{ fontSize: 15, color: "rgba(253,249,244,0.70)", lineHeight: 1.65, marginBottom: 28, maxWidth: 360, marginLeft: "auto", marginRight: "auto" }}>
                    Thank you. One of our advisors will be in touch within
                    twenty-four hours.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    style={{
                      background: "transparent",
                      border: "1px solid rgba(253,249,244,0.25)",
                      padding: "12px 24px",
                      borderRadius: 9999,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      color: "#fdf9f4",
                    }}
                  >
                    Send another
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} style={{ position: "relative", display: "flex", flexDirection: "column", gap: 22 }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 18 }}>
                    <div>
                      <label htmlFor="cf-firstname" style={labelStyle}>First Name</label>
                      <input
                        id="cf-firstname"
                        type="text"
                        placeholder="John"
                        required
                        className="m4m-contact-input"
                        value={form.firstName}
                        onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="cf-lastname" style={labelStyle}>Last Name</label>
                      <input
                        id="cf-lastname"
                        type="text"
                        placeholder="Doe"
                        required
                        className="m4m-contact-input"
                        value={form.lastName}
                        onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cf-email" style={labelStyle}>Email Address</label>
                    <input
                      id="cf-email"
                      type="email"
                      placeholder="you@example.com"
                      required
                      className="m4m-contact-input"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      style={inputStyle}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 18 }}>
                    <div>
                      <label htmlFor="cf-phone" style={labelStyle}>Phone (optional)</label>
                      <input
                        id="cf-phone"
                        type="tel"
                        placeholder="+44 7000 000000"
                        className="m4m-contact-input"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label htmlFor="cf-subject" style={labelStyle}>Subject</label>
                      <select
                        id="cf-subject"
                        className="m4m-contact-input"
                        value={form.subject}
                        onChange={(e) => setForm({ ...form, subject: e.target.value })}
                        style={{ ...inputStyle, appearance: "none", cursor: "pointer", paddingRight: 36, color: form.subject ? "#fdf9f4" : "rgba(253,249,244,0.50)" }}
                      >
                        <option value="" style={{ color: "#1a0a14" }}>Select a subject</option>
                        <option style={{ color: "#1a0a14" }}>General enquiry</option>
                        <option style={{ color: "#1a0a14" }}>Registration help</option>
                        <option style={{ color: "#1a0a14" }}>Subscription &amp; billing</option>
                        <option style={{ color: "#1a0a14" }}>Profile verification</option>
                        <option style={{ color: "#1a0a14" }}>Report an issue</option>
                        <option style={{ color: "#1a0a14" }}>Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="cf-message" style={labelStyle}>Message</label>
                    <textarea
                      id="cf-message"
                      rows={5}
                      placeholder="How can we help you?"
                      required
                      className="m4m-contact-input"
                      value={form.message}
                      onChange={(e) => setForm({ ...form, message: e.target.value })}
                      style={{ ...inputStyle, resize: "vertical", minHeight: 120, lineHeight: 1.55 }}
                    />
                  </div>

                  {submitError && (
                    <p style={{ fontSize: 13, color: "#ff9fb0", margin: 0, textAlign: "center" }}>
                      {submitError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="m4m-contact-submit"
                    disabled={submitting}
                    style={{
                      width: "100%",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 10,
                      background: "#dc1e3c",
                      color: "#fdf9f4",
                      padding: "16px 28px",
                      borderRadius: 12,
                      fontSize: 15,
                      fontWeight: 600,
                      border: 0,
                      cursor: submitting ? "not-allowed" : "pointer",
                      opacity: submitting ? 0.65 : 1,
                      letterSpacing: "0.01em",
                      marginTop: 6,
                      transition: "background 0.2s ease, transform 0.2s ease",
                    }}
                  >
                    {submitting ? "Sending…" : <>Send Message <ArrowRight size={16} strokeWidth={2} /></>}
                  </button>

                  <p style={{ fontSize: 12, color: "rgba(253,249,244,0.55)", margin: 0, letterSpacing: "0.02em", textAlign: "center" }}>
                    By sending an enquiry you agree to our{" "}
                    <Link href="/privacy" style={{ color: "#fdf9f4", textDecoration: "none", fontWeight: 600, borderBottom: "1px solid rgba(253,249,244,0.30)" }}>privacy policy</Link>.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
