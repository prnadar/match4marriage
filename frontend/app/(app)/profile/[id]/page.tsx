"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Shield, MapPin, Briefcase, GraduationCap, Heart, MessageCircle,
  CheckCircle, ArrowLeft, Brain, Star, Users, Music, Book,
  Globe, Calendar, Ruler, Sparkles,
} from "lucide-react";

const profileData: Record<string, {
  name: string; age: number; city: string; state: string;
  profession: string; company: string; education: string;
  religion: string; caste: string; height: string; language: string;
  verified: boolean; trustScore: number; compatibility: number;
  photo: string; grad: string;
  about: string; hobbies: string[]; familyType: string; siblings: string;
  diet: string; smoke: string; drink: string;
  income: string; partnerPrefs: string;
  dimensions: Record<string, number>;
  verifications: { label: string; done: boolean }[];
}> = {
  "1": {
    name: "Priya Sharma", age: 27, city: "Mumbai", state: "Maharashtra",
    profession: "Senior Software Engineer", company: "Google",
    education: "IIT Bombay · B.Tech CSE", religion: "Hindu", caste: "Brahmin",
    height: "5'4\"", language: "Hindi, English, Marathi", verified: true,
    trustScore: 96, compatibility: 92,
    photo: "PS", grad: "linear-gradient(135deg,#dc1e3c,#a0153c)",
    about: "Love Carnatic music, trekking in Himalayas, and building side projects on weekends. Currently building a EdTech startup on the side. Looking for a partner who values growth, laughter, and deep conversations equally.",
    hobbies: ["Carnatic Music", "Trekking", "Side Projects", "Cooking", "Photography"],
    familyType: "Nuclear", siblings: "1 younger brother",
    diet: "Vegetarian", smoke: "No", drink: "Occasionally",
    income: "₹40–50 LPA", partnerPrefs: "Engineer / Doctor, 27–32, open to all states",
    dimensions: { values: 94, lifestyle: 90, family: 96, ambition: 88, communication: 92 },
    verifications: [
      { label: "Aadhaar Verified", done: true },
      { label: "PAN Verified", done: true },
      { label: "Photo Liveness", done: true },
      { label: "Education Verified", done: true },
      { label: "LinkedIn Verified", done: false },
    ],
  },
  "2": {
    name: "Anjali Patel", age: 26, city: "Ahmedabad", state: "Gujarat",
    profession: "Resident Doctor", company: "AIIMS Delhi",
    education: "AIIMS Delhi · MBBS", religion: "Hindu", caste: "Patel",
    height: "5'3\"", language: "Gujarati, Hindi, English", verified: true,
    trustScore: 92, compatibility: 87,
    photo: "AP", grad: "linear-gradient(135deg,#dc1e3c,#a0153c)",
    about: "Passionate about medicine and mental health advocacy. Enjoy cooking Gujarati food, reading, and travelling off the beaten path. Family-oriented, looking for a life partner who understands the demands of medicine.",
    hobbies: ["Cooking", "Reading", "Travel", "Mental Health", "Yoga"],
    familyType: "Joint", siblings: "1 elder sister",
    diet: "Vegetarian", smoke: "No", drink: "No",
    income: "₹12–15 LPA (residency)",
    partnerPrefs: "Any profession, 27–32, Gujarat or pan-India",
    dimensions: { values: 90, lifestyle: 85, family: 92, ambition: 84, communication: 86 },
    verifications: [
      { label: "Aadhaar Verified", done: true },
      { label: "PAN Verified", done: true },
      { label: "Photo Liveness", done: true },
      { label: "Education Verified", done: true },
      { label: "LinkedIn Verified", done: true },
    ],
  },
};

const fallback = profileData["1"];

export default function ProfilePage({ params }: { params: { id: string } }) {
  const profile = profileData[params.id] || { ...fallback, name: "Profile", id: params.id };
  const [interestSent, setInterestSent] = useState(false);

  return (
    <div style={{ padding: "2rem", maxWidth: "56rem", background: "#fdfbf9", minHeight: "100%" }}>

      {/* Back */}
      <Link
        href="/matches"
        style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.875rem", color: "#888", textDecoration: "none", marginBottom: "1.5rem" }}
      >
        <ArrowLeft style={{ width: 16, height: 16 }} />
        Back to Browse
      </Link>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1.5rem", alignItems: "start" }}>

        {/* ── Left column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* Photo card */}
          <div style={{ borderRadius: 16, overflow: "hidden", background: "#fff", border: "1px solid rgba(220,30,60,0.08)", boxShadow: "0 4px 24px rgba(220,30,60,0.08)" }}>

            {/* Crimson hero */}
            <div style={{ height: 288, background: "linear-gradient(135deg,#dc1e3c,#a0153c)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>

              {/* Profile initial circle */}
              <div style={{
                width: 112, height: 112, borderRadius: "50%",
                background: "rgba(255,255,255,0.18)",
                border: "3px solid rgba(255,255,255,0.45)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}>
                <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "2.5rem", fontWeight: 400, color: "#fff" }}>
                  {profile.photo}
                </span>
              </div>

              {/* Badges */}
              <div style={{ position: "absolute", bottom: 16, left: 16, right: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.75rem", fontWeight: 600,
                  color: "#fff", padding: "5px 12px", borderRadius: 9999,
                  background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)",
                  border: "1px solid rgba(255,255,255,0.3)",
                }}>
                  <Shield style={{ width: 12, height: 12 }} />
                  Trust {profile.trustScore}
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.75rem", fontWeight: 600,
                  color: "#fff", padding: "5px 12px", borderRadius: 9999,
                  background: "rgba(200,144,32,0.85)", backdropFilter: "blur(8px)",
                  border: "1px solid rgba(200,144,32,0.4)",
                  boxShadow: "0 2px 8px rgba(200,144,32,0.4)",
                }}>
                  <Sparkles style={{ width: 12, height: 12 }} />
                  {profile.compatibility}% match
                </span>
              </div>
            </div>

            {/* Name / location */}
            <div style={{ padding: "1rem 1.25rem" }}>
              <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "1.25rem", fontWeight: 600, color: "#1a0a14" }}>
                {profile.name}, {profile.age}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, color: "#888" }}>
                <MapPin style={{ width: 14, height: 14 }} />
                <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.875rem" }}>
                  {profile.city}, {profile.state}
                </span>
              </div>

              {/* Verifications */}
              <div style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {profile.verifications.map((v) => (
                  <div key={v.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle style={{ width: 16, height: 16, flexShrink: 0, color: v.done ? "#dc1e3c" : "rgba(26,10,20,0.18)" }} />
                    <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.75rem", color: v.done ? "rgba(26,10,20,0.7)" : "rgba(26,10,20,0.3)" }}>
                      {v.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <button
                  onClick={() => setInterestSent(true)}
                  disabled={interestSent}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.875rem", fontWeight: 600,
                    color: "#fff", padding: "12px 24px", borderRadius: 10,
                    background: interestSent ? "rgba(220,30,60,0.4)" : "linear-gradient(135deg,#dc1e3c,#a0153c)",
                    boxShadow: interestSent ? "none" : "0 4px 16px rgba(220,30,60,0.25)",
                    border: "none", cursor: interestSent ? "default" : "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Heart style={{ width: 16, height: 16, fill: interestSent ? "transparent" : "#fff" }} />
                  {interestSent ? "Interest Sent ✓" : "Send Interest"}
                </button>
                <Link
                  href="/messages"
                  style={{
                    width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                    fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.875rem", fontWeight: 500,
                    color: "rgba(26,10,20,0.6)", padding: "12px 24px", borderRadius: 10,
                    border: "1px solid rgba(220,30,60,0.15)", textDecoration: "none",
                    transition: "border-color 0.2s ease",
                  }}
                >
                  <MessageCircle style={{ width: 16, height: 16 }} />
                  Send Message
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

          {/* About */}
          <Section title="About" icon={<Sparkles style={{ width: 16, height: 16, color: "#dc1e3c" }} />}>
            <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.875rem", color: "rgba(26,10,20,0.65)", lineHeight: 1.7 }}>
              {profile.about}
            </p>
          </Section>

          {/* Basic Info */}
          <Section title="Basic Info" icon={<Star style={{ width: 16, height: 16, color: "#C89020" }} />}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <InfoRow icon={<GraduationCap style={{ width: 14, height: 14 }} />} label="Education"       value={profile.education} />
              <InfoRow icon={<Briefcase     style={{ width: 14, height: 14 }} />} label="Works at"        value={`${profile.profession} · ${profile.company}`} />
              <InfoRow icon={<Ruler         style={{ width: 14, height: 14 }} />} label="Height"          value={profile.height} />
              <InfoRow icon={<Globe         style={{ width: 14, height: 14 }} />} label="Languages"       value={profile.language} />
              <InfoRow icon={<Book          style={{ width: 14, height: 14 }} />} label="Religion / Caste" value={`${profile.religion} · ${profile.caste}`} />
              <InfoRow icon={<Users         style={{ width: 14, height: 14 }} />} label="Family"          value={`${profile.familyType} · ${profile.siblings}`} />
              <InfoRow icon={<Calendar      style={{ width: 14, height: 14 }} />} label="Diet"            value={profile.diet} />
              <InfoRow icon={<Star          style={{ width: 14, height: 14 }} />} label="Income"          value={profile.income} />
            </div>
          </Section>

          {/* AI Compatibility */}
          <Section title="AI Compatibility Breakdown" icon={<Brain style={{ width: 16, height: 16, color: "#dc1e3c" }} />}>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {Object.entries(profile.dimensions).map(([dim, score]) => (
                <div key={dim}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.75rem", fontWeight: 500, color: "rgba(26,10,20,0.65)", textTransform: "capitalize" }}>
                      {dim}
                    </span>
                    <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "0.875rem", fontWeight: 700, color: "#C89020" }}>
                      {score}%
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, overflow: "hidden", background: "rgba(26,10,20,0.06)" }}>
                    <div style={{ height: "100%", borderRadius: 99, width: `${score}%`, background: "linear-gradient(90deg,#dc1e3c,#C89020)", transition: "width 0.8s ease" }} />
                  </div>
                </div>
              ))}
            </div>
            <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.75rem", color: "#888", marginTop: "0.75rem", fontStyle: "italic" }}>
              Based on 60-question psychometric assessment
            </p>
          </Section>

          {/* Hobbies */}
          <Section title="Hobbies & Interests" icon={<Music style={{ width: 16, height: 16, color: "#C89020" }} />}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {profile.hobbies.map((h) => (
                <span
                  key={h}
                  style={{
                    fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.75rem", fontWeight: 500,
                    padding: "0.375rem 0.875rem", borderRadius: 9999,
                    background: "rgba(220,30,60,0.06)", border: "1px solid rgba(220,30,60,0.18)", color: "#dc1e3c",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>
          </Section>

          {/* Partner Prefs */}
          <Section title="Partner Preferences" icon={<Heart style={{ width: 16, height: 16, color: "#dc1e3c" }} />}>
            <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.875rem", color: "rgba(26,10,20,0.65)", lineHeight: 1.7 }}>
              {profile.partnerPrefs}
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ─── Section card ─── */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ padding: "1.25rem", background: "#fff", border: "1px solid rgba(220,30,60,0.08)", borderRadius: 16, boxShadow: "0 2px 16px rgba(220,30,60,0.06)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
        {icon}
        <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "1.125rem", fontWeight: 600, color: "#1a0a14" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ─── Info row ─── */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ marginTop: 2, flexShrink: 0, color: "rgba(26,10,20,0.35)" }}>{icon}</span>
      <div>
        <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.625rem", color: "rgba(26,10,20,0.4)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {label}
        </p>
        <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "0.875rem", color: "rgba(26,10,20,0.8)", fontWeight: 500 }}>
          {value}
        </p>
      </div>
    </div>
  );
}
