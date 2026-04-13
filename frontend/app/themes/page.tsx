"use client";

import { useState } from "react";
import { Heart, Shield, Brain, ArrowRight, Check } from "lucide-react";

const themes = [
  {
    id: "crimson-gold",
    name: "Crimson & Gold",
    subtitle: "Current — Indian Wedding Silk",
    tag: "CURRENT",
    isDark: true,
    bg: "#0F0A0A",
    bgMesh: "radial-gradient(at 20% 30%, rgba(139,26,26,0.28) 0px, transparent 55%), radial-gradient(at 80% 10%, rgba(201,149,42,0.18) 0px, transparent 45%)",
    primary: "#8B1A1A",
    primaryGrad: "linear-gradient(135deg, #8B1A1A, #B02020)",
    accent: "#C9952A",
    accentGrad: "linear-gradient(135deg, #C9952A, #E8B04A)",
    text: "#F5F0E8",
    textMuted: "rgba(245,240,232,0.5)",
    glass: "rgba(255,255,255,0.06)",
    glassBorder: "rgba(201,149,42,0.22)",
    cardShadow: "0 0 40px rgba(139,26,26,0.15)",
    headingGrad: "linear-gradient(135deg, #C9952A 0%, #F0C060 50%, #C9952A 100%)",
    navBg: "rgba(15,10,10,0.8)",
  },
  {
    id: "obsidian-champagne",
    name: "Obsidian & Champagne",
    subtitle: "Rolls Royce — Pure Luxury",
    tag: "PREMIUM",
    isDark: true,
    bg: "#0C0A09",
    bgMesh: "radial-gradient(at 30% 40%, rgba(201,163,100,0.12) 0px, transparent 55%), radial-gradient(at 75% 20%, rgba(68,64,60,0.4) 0px, transparent 50%)",
    primary: "#1C1917",
    primaryGrad: "linear-gradient(135deg, #292524, #44403C)",
    accent: "#C9A264",
    accentGrad: "linear-gradient(135deg, #C9A264, #E8C98A)",
    text: "#FAFAF9",
    textMuted: "rgba(250,250,249,0.45)",
    glass: "rgba(255,255,255,0.04)",
    glassBorder: "rgba(201,162,100,0.18)",
    cardShadow: "0 0 40px rgba(201,162,100,0.08)",
    headingGrad: "linear-gradient(135deg, #C9A264 0%, #E8C98A 50%, #C9A264 100%)",
    navBg: "rgba(12,10,9,0.85)",
  },
  {
    id: "midnight-navy",
    name: "Midnight Navy & Gold",
    subtitle: "Ritz-Carlton — Heritage Prestige",
    tag: "CLASSIC",
    isDark: true,
    bg: "#080E1F",
    bgMesh: "radial-gradient(at 20% 35%, rgba(30,58,138,0.35) 0px, transparent 55%), radial-gradient(at 80% 15%, rgba(202,138,4,0.15) 0px, transparent 45%)",
    primary: "#1E3A8A",
    primaryGrad: "linear-gradient(135deg, #1E3A8A, #2D4FB3)",
    accent: "#CA8A04",
    accentGrad: "linear-gradient(135deg, #CA8A04, #E8A820)",
    text: "#F8FAFC",
    textMuted: "rgba(248,250,252,0.45)",
    glass: "rgba(30,58,138,0.12)",
    glassBorder: "rgba(202,138,4,0.2)",
    cardShadow: "0 0 40px rgba(30,58,138,0.2)",
    headingGrad: "linear-gradient(135deg, #CA8A04 0%, #F0CC50 50%, #CA8A04 100%)",
    navBg: "rgba(8,14,31,0.85)",
  },
  {
    id: "burgundy-rose",
    name: "Burgundy & Rose Gold",
    subtitle: "Mughal Court — Rich Indian Heritage",
    tag: "INDIAN LUXURY",
    isDark: true,
    bg: "#0D0509",
    bgMesh: "radial-gradient(at 25% 35%, rgba(124,45,18,0.3) 0px, transparent 55%), radial-gradient(at 75% 15%, rgba(185,113,100,0.2) 0px, transparent 45%)",
    primary: "#7C2D12",
    primaryGrad: "linear-gradient(135deg, #7C2D12, #9A3A1A)",
    accent: "#C97E6E",
    accentGrad: "linear-gradient(135deg, #C97E6E, #E8A090)",
    text: "#FEF2F2",
    textMuted: "rgba(254,242,242,0.45)",
    glass: "rgba(124,45,18,0.12)",
    glassBorder: "rgba(201,126,110,0.22)",
    cardShadow: "0 0 40px rgba(124,45,18,0.2)",
    headingGrad: "linear-gradient(135deg, #C97E6E 0%, #E8B0A0 50%, #C97E6E 100%)",
    navBg: "rgba(13,5,9,0.85)",
  },
  {
    id: "onyx-emerald",
    name: "Onyx & Emerald",
    subtitle: "Bulgari — Jewellery Box Opulence",
    tag: "BOLD",
    isDark: true,
    bg: "#030A06",
    bgMesh: "radial-gradient(at 25% 40%, rgba(4,120,87,0.2) 0px, transparent 55%), radial-gradient(at 78% 18%, rgba(16,185,129,0.1) 0px, transparent 45%)",
    primary: "#064E3B",
    primaryGrad: "linear-gradient(135deg, #064E3B, #065F46)",
    accent: "#10B981",
    accentGrad: "linear-gradient(135deg, #10B981, #34D399)",
    text: "#ECFDF5",
    textMuted: "rgba(236,253,245,0.45)",
    glass: "rgba(4,120,87,0.1)",
    glassBorder: "rgba(16,185,129,0.2)",
    cardShadow: "0 0 40px rgba(4,120,87,0.15)",
    headingGrad: "linear-gradient(135deg, #10B981 0%, #6EE7B7 50%, #10B981 100%)",
    navBg: "rgba(3,10,6,0.85)",
  },

  /* ── LIGHT INDIAN WEDDING THEMES ──────────────────────────────────── */
  {
    id: "cream-rose",
    name: "Ivory & Marigold",
    subtitle: "Sabyasachi — Luxury Wedding Invite",
    tag: "LIGHT · WEDDING GOLD",
    isDark: false,
    bg: "#FFFAF8",
    bgMesh: "radial-gradient(at 20% 30%, rgba(212,96,26,0.12) 0px, transparent 55%), radial-gradient(at 80% 10%, rgba(184,134,11,0.14) 0px, transparent 45%), radial-gradient(at 55% 80%, rgba(228,163,58,0.08) 0px, transparent 50%)",
    primary: "#E8426A",
    primaryGrad: "linear-gradient(135deg, #E8426A 0%, #FF8FA3 100%)",
    accent: "#9A6B00",
    accentGrad: "linear-gradient(135deg, #9A6B00 0%, #C89020 100%)",
    text: "#1A0A12",
    textMuted: "rgba(28,15,6,0.5)",
    glass: "rgba(196,82,15,0.07)",
    glassBorder: "rgba(154,107,0,0.22)",
    cardShadow: "0 8px 40px rgba(196,82,15,0.1)",
    headingGrad: "linear-gradient(135deg, #9A6B00 0%, #C89020 45%, #7A5200 100%)",
    navBg: "rgba(250,246,238,0.94)",
  },
  {
    id: "pearl-sindoor",
    name: "Pearl & Sindoor",
    subtitle: "Kanjivaram Silk — Sacred Tradition",
    tag: "LIGHT · SINDOOR RED",
    isDark: false,
    bg: "#FEF8F5",
    bgMesh: "radial-gradient(at 22% 32%, rgba(155,28,28,0.09) 0px, transparent 55%), radial-gradient(at 78% 15%, rgba(201,149,42,0.12) 0px, transparent 45%), radial-gradient(at 50% 78%, rgba(220,38,38,0.06) 0px, transparent 50%)",
    primary: "#9B1C1C",
    primaryGrad: "linear-gradient(135deg, #9B1C1C 0%, #B91C1C 100%)",
    accent: "#9A6B00",
    accentGrad: "linear-gradient(135deg, #9A6B00 0%, #C89020 100%)",
    text: "#1A0505",
    textMuted: "rgba(26,5,5,0.48)",
    glass: "rgba(155,28,28,0.06)",
    glassBorder: "rgba(154,107,0,0.2)",
    cardShadow: "0 8px 40px rgba(155,28,28,0.08)",
    headingGrad: "linear-gradient(135deg, #9A6B00 0%, #C89020 50%, #9A6B00 100%)",
    navBg: "rgba(254,248,245,0.94)",
  },
  {
    id: "parchment-peacock",
    name: "Parchment & Peacock",
    subtitle: "Rajasthani Palace — Royal Heritage",
    tag: "LIGHT · PEACOCK TEAL",
    isDark: false,
    bg: "#FBF5E6",
    bgMesh: "radial-gradient(at 25% 35%, rgba(15,118,110,0.1) 0px, transparent 55%), radial-gradient(at 75% 18%, rgba(180,83,9,0.1) 0px, transparent 45%), radial-gradient(at 50% 75%, rgba(20,184,166,0.07) 0px, transparent 50%)",
    primary: "#0F766E",
    primaryGrad: "linear-gradient(135deg, #0F766E 0%, #0D9488 100%)",
    accent: "#9A5800",
    accentGrad: "linear-gradient(135deg, #9A5800 0%, #C47800 100%)",
    text: "#0D1F1A",
    textMuted: "rgba(13,31,26,0.48)",
    glass: "rgba(15,118,110,0.08)",
    glassBorder: "rgba(154,88,0,0.2)",
    cardShadow: "0 8px 40px rgba(15,118,110,0.1)",
    headingGrad: "linear-gradient(135deg, #0F766E 0%, #14B8A6 50%, #0A5C56 100%)",
    navBg: "rgba(251,245,230,0.94)",
  },
];

export default function ThemesPage() {
  const [selected, setSelected] = useState("crimson-gold");
  const active = themes.find((t) => t.id === selected)!;

  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Montserrat', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: "40px 32px 24px", textAlign: "center", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", letterSpacing: "3px", textTransform: "uppercase", marginBottom: "10px" }}>
          UI Pro Max — Design System
        </p>
        <h1 style={{ fontFamily: "'Cormorant', Georgia, serif", color: "#fff", fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 300, margin: 0 }}>
          Choose Your Colour Scheme
        </h1>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "14px", marginTop: "8px" }}>
          Click a theme to preview it full-width below
        </p>
      </div>

      {/* Theme selector pills */}
      <div style={{ display: "flex", gap: "12px", padding: "28px 32px", overflowX: "auto", justifyContent: "center", flexWrap: "wrap" }}>
        {themes.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelected(t.id)}
            style={{
              cursor: "pointer",
              padding: "10px 20px",
              borderRadius: "99px",
              border: selected === t.id ? `1px solid ${t.accent}` : "1px solid rgba(255,255,255,0.1)",
              background: selected === t.id ? `${t.accent}22` : "rgba(255,255,255,0.03)",
              color: selected === t.id ? t.accent : "rgba(255,255,255,0.5)",
              fontSize: "13px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
              minHeight: "44px",
            }}
          >
            <span
              style={{
                width: "10px", height: "10px", borderRadius: "50%",
                background: t.accentGrad, flexShrink: 0,
              }}
            />
            {t.name}
            {t.id === "crimson-gold" && (
              <span style={{ fontSize: "9px", background: "rgba(255,255,255,0.15)", padding: "1px 6px", borderRadius: "4px" }}>CURRENT</span>
            )}
          </button>
        ))}
      </div>

      {/* Live preview */}
      <div style={{ padding: "0 24px 60px" }}>
        <ThemePreview theme={active} />
      </div>

      {/* Apply instruction */}
      <div style={{ textAlign: "center", padding: "0 32px 60px" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "13px" }}>
          Tell me "<strong style={{ color: "rgba(255,255,255,0.6)" }}>Apply [Theme Name]</strong>" to switch the entire site to that scheme.
        </p>
      </div>
    </div>
  );
}

function ThemePreview({ theme: t }: { theme: (typeof themes)[0] }) {
  const ghostColor = t.isDark ? "rgba(255,255,255,0.65)" : "rgba(28,15,6,0.55)";
  const ghostBorder = t.isDark ? "rgba(255,255,255,0.18)" : "rgba(28,15,6,0.18)";
  return (
    <div
      style={{
        borderRadius: "20px",
        overflow: "hidden",
        border: `1px solid ${t.glassBorder}`,
        boxShadow: t.cardShadow,
        maxWidth: "900px",
        margin: "0 auto",
      }}
    >
      {/* Mock Navbar */}
      <div style={{ background: t.navBg, backdropFilter: "blur(24px)", padding: "0 28px", height: "56px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${t.glassBorder}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Heart size={16} color={t.accent} fill={t.accent} />
          <span style={{ fontFamily: "'Cormorant', serif", color: t.text, fontSize: "18px", fontWeight: 600 }}>Match4Marriage</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ padding: "6px 18px", borderRadius: "99px", border: `1px solid ${ghostBorder}`, color: ghostColor, fontSize: "12px", cursor: "pointer" }}>
            Log In
          </div>
          <div style={{ padding: "6px 18px", borderRadius: "99px", background: t.primaryGrad, color: "#fff", fontSize: "12px", cursor: "pointer", boxShadow: `0 3px 14px ${t.primary}55` }}>
            Get Started
          </div>
        </div>
      </div>

      {/* Hero */}
      <div
        style={{
          background: t.bg,
          backgroundImage: t.bgMesh,
          padding: "60px 40px 50px",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Tag */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 14px", borderRadius: "99px", border: `1px solid ${t.glassBorder}`, background: `${t.accent}18`, marginBottom: "24px" }}>
          <span style={{ fontSize: "9px", color: t.accent, letterSpacing: "2px", textTransform: "uppercase", fontWeight: 600 }}>{t.tag} — {t.subtitle}</span>
        </div>

        {/* Devanagari */}
        <p style={{ fontFamily: "'Noto Serif Devanagari', serif", color: `${t.accent}99`, fontSize: "16px", letterSpacing: "4px", marginBottom: "16px" }}>
          Match4Marriage · The Sacred Bond
        </p>

        {/* Headline */}
        <h2 style={{ fontFamily: "'Cormorant', Georgia, serif", fontWeight: 300, lineHeight: 1.1, marginBottom: "16px", fontSize: "clamp(2rem, 5vw, 3.6rem)", color: t.text }}>
          Find Your{" "}
          <span style={{ background: t.headingGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontStyle: "italic", fontWeight: 600 }}>
            Life Partner
          </span>
          <br />
          With Confidence &amp; Joy
        </h2>

        <p style={{ color: t.textMuted, fontSize: "14px", maxWidth: "500px", margin: "0 auto 32px", lineHeight: 1.7 }}>
          AI-powered compatibility. Government-grade verification. Cultural depth — for modern India and the global diaspora.
        </p>

        {/* Buttons */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginBottom: "44px", flexWrap: "wrap" }}>
          <button style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", padding: "14px 32px", borderRadius: "99px", background: t.primaryGrad, color: "#fff", fontSize: "14px", fontWeight: 600, border: "none", boxShadow: `0 4px 20px ${t.primary}55` }}>
            Begin Your Journey <ArrowRight size={15} />
          </button>
          <button style={{ cursor: "pointer", padding: "14px 32px", borderRadius: "99px", border: `1px solid ${ghostBorder}`, background: "transparent", color: ghostColor, fontSize: "14px", fontWeight: 500 }}>
            View Matches
          </button>
        </div>

        {/* Stats bar */}
        <div style={{ display: "inline-flex", gap: "32px", padding: "20px 32px", borderRadius: "16px", background: t.glass, border: `1px solid ${t.glassBorder}`, backdropFilter: "blur(20px)", flexWrap: "wrap", justifyContent: "center" }}>
          {[["2M+","Verified Profiles"],["50K+","Engagements"],["28","States"],["99.9%","Uptime"]].map(([val, lbl], i) => (
            <div key={lbl} style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "'Cormorant', serif", fontSize: "26px", fontWeight: 700, background: t.headingGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>{val}</p>
              <p style={{ color: t.textMuted, fontSize: "10px", marginTop: "2px", letterSpacing: "0.5px" }}>{lbl}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Feature cards strip */}
      <div style={{ background: t.bg, padding: "32px 28px 40px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px" }}>
        {[
          { icon: Shield, title: "Government-Grade Trust", desc: "Aadhaar + PAN + photo liveness verification" },
          { icon: Brain, title: "AI Compatibility Engine", desc: "5-dimension psychometric matching daily" },
          { icon: Heart, title: "Privacy First", desc: "Signal E2E encryption, blurred contacts" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} style={{ background: t.glass, border: `1px solid ${t.glassBorder}`, borderRadius: "14px", padding: "20px 16px", backdropFilter: "blur(16px)", cursor: "pointer", transition: "all 0.2s" }}>
            <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: `${t.primary}55`, border: `1px solid ${t.glassBorder}`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
              <Icon size={16} color={t.accent} />
            </div>
            <p style={{ fontFamily: "'Cormorant', serif", color: t.text, fontSize: "15px", fontWeight: 600, marginBottom: "6px" }}>{title}</p>
            <p style={{ color: t.textMuted, fontSize: "11px", lineHeight: 1.6 }}>{desc}</p>
          </div>
        ))}
      </div>

      {/* CTA banner */}
      <div style={{ background: t.bg, padding: "0 28px 40px" }}>
        <div style={{ borderRadius: "16px", padding: "36px", textAlign: "center", background: `linear-gradient(135deg, ${t.primary}40, ${t.accent}18)`, border: `1px solid ${t.glassBorder}` }}>
          <Heart size={28} color={t.accent} fill={`${t.accent}44`} style={{ margin: "0 auto 16px" }} />
          <h3 style={{ fontFamily: "'Cormorant', serif", color: t.text, fontSize: "clamp(1.4rem, 3vw, 2rem)", fontWeight: 300, marginBottom: "8px" }}>
            Your story begins <span style={{ background: t.headingGrad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", fontStyle: "italic", fontWeight: 600 }}>today</span>
          </h3>
          <p style={{ color: t.textMuted, fontSize: "13px", marginBottom: "24px" }}>Join 2 million verified profiles. Free forever.</p>
          <button style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 36px", borderRadius: "99px", background: t.accentGrad, color: t.bg, fontSize: "14px", fontWeight: 700, border: "none", boxShadow: `0 4px 20px ${t.accent}44` }}>
            Create Free Profile <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
