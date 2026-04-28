"use client";
import Link from "next/link";
import { useAuthState, getCTA } from "@/lib/useVerification";
import {
  Crown, ShieldCheck, Lock, Handshake, Gem, Sparkles, Globe, MessageCircle, Heart,
  Users, Award, Star,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CountryFlag } from "@/components/ui/country-flag";

import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const metadata = {
  title: "About Us | Match4Marriage, Elite Indian Matrimony",
  description:
    "Match4Marriage is a UK-based boutique Indian matrimonial service. Hand-picked, personally verified profiles for the British Indian community and diaspora.",
};

interface Pillar { Icon: LucideIcon; title: string; desc: string; }

const pillars: Pillar[] = [
  { Icon: Crown,       title: "Hand-Picked Profiles Only",     desc: "We do not accept everyone. Every profile on Match4Marriage is individually reviewed and approved, ensuring you meet only genuine, quality individuals." },
  { Icon: ShieldCheck, title: "Personally Verified",           desc: "Every member is manually verified. Not just ID-checked, personally assessed. You can trust that every connection is real." },
  { Icon: Lock,        title: "Complete Discretion",           desc: "Your details, your journey, your privacy. We handle everything with the utmost confidentiality and care." },
  { Icon: Handshake,   title: "Dedicated Guidance",            desc: "We are with you every step of the way: personal support, honest advice, and genuine care for your outcome." },
  { Icon: Globe,       title: "Built in the UK, For Global Indians", desc: "Built in the United Kingdom for the global Indian community, connecting Indians across the UK, India, USA, Canada, UAE, Australia, and beyond." },
  { Icon: Gem,         title: "Marriages That Last",           desc: "We have already helped families celebrate successful marriages. Small in number, profound in meaning." },
];

const values: Pillar[] = [
  { Icon: Users,         title: "Family First",                desc: "We understand that marriage in Tamil culture is a union of families, not just individuals. Our platform is built around this truth." },
  { Icon: ShieldCheck,   title: "Trust & Safety",              desc: "Every profile is manually verified with government ID. Your privacy is protected at every step." },
  { Icon: Handshake,     title: "Respect & Dignity",           desc: "We treat every family with respect regardless of caste, community, or background within the Tamil diaspora." },
  { Icon: Globe,         title: "Global Tamil Community",      desc: "Connecting Tamil families across India, Singapore, UK, USA, Canada, Malaysia, and beyond." },
  { Icon: Sparkles,      title: "Tradition Meets Technology",  desc: "Our AI matching engine understands cultural compatibility, not just age and location." },
  { Icon: MessageCircle, title: "Always Here",                 desc: "Our relationship advisors are available 7 days a week to support families through every step." },
];

const milestones = [
  { year: "2020", event: "Match4Marriage founded in the United Kingdom with a clear vision: a curated, trustworthy matrimonial service for the Indian community." },
  { year: "2021", event: "First hand-picked profiles added. Personal vetting process established. Every profile individually reviewed before joining." },
  { year: "2022", event: "First marriages celebrated. Proof that a personal, quality-first approach creates real, lasting connections." },
  { year: "2023", event: "Reached 50+ elite verified profiles across UK, India, and the global Indian diaspora." },
  { year: "2024", event: "Platform refined with enhanced privacy, profile quality controls, and dedicated relationship guidance." },
  { year: "2025", event: "Growing steadily: more successful matches, a stronger community, and an unwavering commitment to quality over quantity." },
];

export default function AboutPage() {
  const authState = useAuthState();
  const cta = getCTA(authState);
  return (
    <div className="min-h-screen overflow-x-hidden font-poppins" style={{ backgroundColor: "#fdfbf9" }}>

      {/* ── Nav ── */}
      <PublicHeader />

      {/* ── Hero ── */}
      <section
        style={{
          background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 50%, #3b3fa0 100%)",
          padding: "72px 24px 56px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative rings */}
        <div style={{ position: "absolute", top: -40, right: -40, width: 240, height: 240, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)" }} />
        <div style={{ position: "absolute", bottom: -60, left: -60, width: 320, height: 320, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)" }} />

        <div style={{ position: "relative", zIndex: 1, maxWidth: "720px", margin: "0 auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)", borderRadius: "9999px", padding: "6px 20px", fontSize: 12, fontWeight: 600, letterSpacing: "0.16em", textTransform: "uppercase", color: "#fff", marginBottom: 20 }}>
            <CountryFlag code="GB" rounded="sm" />
            UK's Premier Indian Matrimonial Service
          </span>
          <h1
            className="font-playfair"
            style={{ color: "#fff", fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 700, lineHeight: 1.15, marginBottom: "20px", textShadow: "0 2px 20px rgba(0,0,0,0.2)" }}
          >
            A Boutique Matrimonial<br />
            <span style={{ color: "#ffd87a" }}>Service Built on Trust</span>
          </h1>
          <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "15px", lineHeight: 1.7, maxWidth: "620px", margin: "0 auto" }}>
            At Match4Marriage, we recognise that discovering a life partner is a profound life milestone, one that calls for trust, refinement, and exceptional care. Founded in the UK, built for the British Indian community, and open to the global diaspora.
          </p>
        </div>
      </section>

      {/* ── Stats ── */}
      <section style={{ background: "#fff", padding: "0 24px", borderBottom: "1px solid rgba(220,30,60,0.08)" }}>
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4">
          {([
            { Icon: Crown,       num: "100+",          label: "Elite Verified Profiles" },
            { Icon: Award,       num: "Every Profile", label: "Hand-Picked & Verified"  },
            { Icon: null,        num: "UK-Based",      label: "Headquarters", flag: "GB" as const },
            { Icon: Star,        num: "4.9 / 5",       label: "Client Satisfaction"     },
          ] as const).map((s, i) => (
            <div
              key={s.label}
              style={{
                padding: "36px 24px",
                textAlign: "center",
                borderRight: i < 3 ? "1px solid rgba(220,30,60,0.08)" : "none",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg, rgba(220,30,60,0.10), rgba(201,149,74,0.08))", color: "#dc1e3c", marginBottom: 12 }}>
                {s.Icon ? <s.Icon className="h-6 w-6" strokeWidth={1.5} /> : "flag" in s && s.flag ? <CountryFlag code={s.flag} rounded="sm" className="!text-xl" /> : null}
              </div>
              <p className="font-display" style={{ fontSize: "clamp(18px, 2.5vw, 26px)", fontWeight: 700, color: "#1a0a14", lineHeight: 1.2, letterSpacing: "-0.01em" }}>{s.num}</p>
              <p style={{ fontSize: 13, color: "#888", marginTop: 6, fontWeight: 500 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Mission ── */}
      <section style={{ padding: "80px 24px", background: "#fdfbf9" }}>
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.1em" }}>Who We Are</span>
            <h2 className="font-playfair" style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 700, color: "#1a0a14", marginTop: "12px", marginBottom: "20px", lineHeight: 1.2 }}>
              Built for the Global<br />Elite Indian Community
            </h2>
            <p style={{ color: "#555", lineHeight: 1.8, fontSize: "16px", marginBottom: "16px" }}>
              At Match4Marriage, we understand that choosing a life partner is a deeply significant journey, deserving of trust, discretion, and thoughtful guidance. That is why we have made a deliberate choice: to remain small, selective, and genuinely personal.
            </p>
            <p style={{ color: "#555", lineHeight: 1.8, fontSize: "16px", marginBottom: "16px" }}>
              Established in the United Kingdom, we are a boutique matrimonial service with over 100 hand-picked, individually verified profiles. Every member has been personally reviewed, not just registered. We have already had the privilege of celebrating successful marriages, and we take immense pride in each one.
            </p>
            <p style={{ color: "#555", lineHeight: 1.8, fontSize: "16px", marginBottom: "16px" }}>
              Built in the United Kingdom for the global Indian community. We serve Indians across London, Birmingham, Manchester, Leicester, and the wider UK, as well as those rooted in India, USA, Canada, UAE, Australia, and beyond. Wherever you are in the world, if you are seeking a meaningful Indian match, Match4Marriage is for you.
            </p>
            <p style={{ color: "#555", lineHeight: 1.8, fontSize: "16px", marginBottom: "32px" }}>
              We are not trying to be the biggest. We are committed to being the best, for the right people.
            </p>
            <Link
              href="/auth/register"
              style={{
                display: "inline-block",
                background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
                color: "#fff",
                padding: "14px 36px",
                borderRadius: "9999px",
                fontSize: "15px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              Start Your Journey
            </Link>
          </div>
          <div style={{ position: "relative" }}>
            <img
              src="/images/about-hero.jpg"
              alt="Indian wedding couple"
              style={{ width: "100%", borderRadius: "20px", objectFit: "cover", objectPosition: "center 20%", aspectRatio: "4/3", boxShadow: "0 20px 60px rgba(102,69,28,0.12)" }}
            />
            <div style={{ position: "absolute", bottom: -20, left: -20, background: "#fff", borderRadius: 16, padding: "16px 24px", boxShadow: "0 8px 32px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 42, height: 42, borderRadius: 12, background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff" }}>
                <Gem className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <div>
                <p style={{ fontWeight: 700, color: "#1a0a14", fontSize: 15 }}>Successful Matches</p>
                <p style={{ color: "#888", fontSize: 12 }}>and growing</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section style={{ padding: "80px 24px", background: "#fdfbf9" }}>
        <div className="max-w-6xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "64px" }}>
            <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.15em" }}>What We Stand For</span>
            <h2 className="font-playfair" style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 700, color: "#1a0a14", marginTop: "14px", marginBottom: "16px" }}>Our Pillars</h2>
            <div style={{ width: "48px", height: "3px", background: "linear-gradient(135deg, #dc1e3c, #a0153c)", borderRadius: "9999px", margin: "0 auto" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((v, i) => (
              <div
                key={v.title}
                style={{
                  background: "#fff",
                  borderRadius: "20px",
                  padding: "36px 28px",
                  boxShadow: "0 2px 24px rgba(26,10,20,0.06)",
                  borderTop: "3px solid #dc1e3c",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  position: "relative",
                  overflow: "hidden",
                }}
                className="hover:shadow-lg"
              >
                {/* Number watermark */}
                <span style={{
                  position: "absolute", top: "16px", right: "20px",
                  fontSize: "48px", fontWeight: 800, color: "rgba(220,30,60,0.06)",
                  fontFamily: "Playfair Display, serif", lineHeight: 1,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                {/* Icon circle */}
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: "linear-gradient(135deg, rgba(220,30,60,0.10), rgba(201,149,74,0.08))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginBottom: 20, color: "#dc1e3c",
                }}>
                  <v.Icon className="h-5 w-5" strokeWidth={1.6} />
                </div>
                <h3 className="font-playfair" style={{ fontSize: "17px", fontWeight: 700, color: "#1a0a14", marginBottom: "12px", lineHeight: 1.3 }}>{v.title}</h3>
                <p style={{ color: "#777", fontSize: "14px", lineHeight: 1.8, margin: 0 }}>{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Timeline ── */}
      <section style={{ padding: "80px 24px", background: "#fdfbf9" }}>
        <div className="max-w-3xl mx-auto">
          <div style={{ textAlign: "center", marginBottom: "56px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.1em" }}>Our Journey</span>
            <h2 className="font-playfair" style={{ fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 700, color: "#1a0a14", marginTop: "12px" }}>How We Got Here</h2>
          </div>
          <div style={{ position: "relative" }}>
            {/* Vertical line */}
            <div style={{ position: "absolute", left: "20px", top: 0, bottom: 0, width: "2px", background: "rgba(220,30,60,0.15)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
              {milestones.map((m) => (
                <div key={m.year} style={{ display: "flex", gap: "24px", alignItems: "flex-start", paddingLeft: "8px" }}>
                  {/* Dot */}
                  <div style={{ flexShrink: 0, width: "24px", height: "24px", borderRadius: "50%", background: "#dc1e3c", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1, marginTop: "2px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#fff" }} />
                  </div>
                  <div style={{ paddingTop: "2px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#dc1e3c", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.year}</span>
                    <p style={{ color: "#444", fontSize: "15px", lineHeight: 1.6, marginTop: "4px" }}>{m.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Closing Statement ── */}
      <section style={{ padding: "80px 24px", background: "#fff" }}>
        <div className="max-w-3xl mx-auto text-center">
          <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff", marginBottom: 24, boxShadow: "0 12px 32px rgba(220,30,60,0.30)" }}>
            <Gem className="h-7 w-7" strokeWidth={1.4} />
          </span>
          <blockquote className="font-display-alt" style={{ fontSize: "clamp(20px, 3vw, 28px)", fontWeight: 500, color: "#1a0a14", lineHeight: 1.55, marginBottom: 24, fontStyle: "italic", letterSpacing: "-0.01em" }}>
            &ldquo;Our purpose is simple yet meaningful: to help you find not just a match, but a lasting and fulfilling companionship.&rdquo;
          </blockquote>
          <p style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#888", fontSize: 14, letterSpacing: "0.16em", textTransform: "uppercase", fontWeight: 600 }}>
            The Match4Marriage Team
            <CountryFlag code="GB" rounded="sm" />
            United Kingdom
          </p>
          <div style={{ width: 48, height: 3, background: "#dc1e3c", borderRadius: 9999, margin: "24px auto 0" }} />
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: "80px 24px", background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 50%, #3b3fa0 100%)", textAlign: "center" }}>
        <h2 className="font-playfair" style={{ color: "#fff", fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 700, marginBottom: "16px" }}>
          Begin Your Journey Today
        </h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "16px", marginBottom: "36px", maxWidth: "540px", margin: "0 auto 36px" }}>
          Join the UK&apos;s most trusted boutique Indian matrimonial service. Hand-picked profiles. Personal guidance. Meaningful connections.
        </p>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Link
            href={cta.href}
            style={{ background: "#fff", color: "#dc1e3c", padding: "14px 40px", borderRadius: "9999px", fontWeight: 700, fontSize: "15px", textDecoration: "none" }}
          >
            {cta.label}
          </Link>
        </div>
      </section>

      {/* ── Footer ── */}
      <PublicFooter />
    </div>
  );
}
