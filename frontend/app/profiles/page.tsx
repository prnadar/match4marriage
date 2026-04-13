"use client";
import Link from "next/link";
import { useAuthState, getCTA } from "@/lib/useVerification";

import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const metadata = {
  title: "Browse Profiles | Match4Marriage",
  description: "Browse verified Indian matrimonial profiles on Match4Marriage, Elite Indian matrimony service based in the UK.",
};

const demoProfiles = [
  { id: 1, name: "Priya S.", age: 28, location: "London, UK", profession: "Doctor", religion: "Hindu", community: "Tamil", grad: "linear-gradient(135deg,#dc1e3c,#a0153c)" },
  { id: 2, name: "Arun K.", age: 31, location: "Birmingham, UK", profession: "Software Engineer", religion: "Hindu", community: "Telugu", grad: "linear-gradient(135deg,#9A6B00,#C89020)" },
  { id: 3, name: "Meena R.", age: 27, location: "Manchester, UK", profession: "Accountant", religion: "Hindu", community: "Brahmin", grad: "linear-gradient(135deg,#5C7A52,#8DB870)" },
  { id: 4, name: "Vijay M.", age: 33, location: "Leicester, UK", profession: "Lawyer", religion: "Hindu", community: "Nadar", grad: "linear-gradient(135deg,#7C3AED,#A78BFA)" },
  { id: 5, name: "Divya P.", age: 29, location: "Glasgow, UK", profession: "Pharmacist", religion: "Christian", community: "Kerala", grad: "linear-gradient(135deg,#0F766E,#14B8A6)" },
  { id: 6, name: "Rahul V.", age: 30, location: "Leeds, UK", profession: "Business Analyst", religion: "Hindu", community: "Iyer", grad: "linear-gradient(135deg,#E8426A,#E8A060)" },
];

export default function ProfilesPage() {
  const authState = useAuthState();
  const cta = getCTA(authState);
  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf9", fontFamily: "var(--font-poppins, sans-serif)" }}>
      <PublicHeader />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 50%, #3b3fa0 100%)", padding: "72px 24px 56px", textAlign: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.2em", display: "block", marginBottom: "12px" }}>
          Verified Profiles
        </span>
        <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(28px,4vw,52px)", fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
          Browse Profiles
        </h1>
        <p style={{ fontSize: "15px", color: "rgba(255,255,255,0.85)", maxWidth: "480px", margin: "0 auto 32px" }}>
          Every profile on Match4Marriage is hand-picked and personally verified. Register to view full profiles and connect.
        </p>
        <Link href={cta.href} style={{ display: "inline-block", padding: "12px 32px", borderRadius: "9999px", background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff", fontWeight: 700, fontSize: "14px", textDecoration: "none", boxShadow: "0 4px 20px rgba(220,30,60,0.35)" }}>
          {cta.label}
        </Link>
      </div>

      {/* Profile grid — blurred/locked preview */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "56px 24px" }}>
        <p style={{ textAlign: "center", fontSize: "13px", color: "#aaa", marginBottom: "40px" }}>
          🔒 Register free to see full names, photos, contact details and connect with matches
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: "24px" }}>
          {demoProfiles.map((p) => (
            <div key={p.id} style={{ background: "#fff", borderRadius: "20px", overflow: "hidden", border: "1px solid rgba(220,30,60,0.08)", boxShadow: "0 4px 20px rgba(0,0,0,0.05)", position: "relative" }}>

              {/* Gradient avatar */}
              <div style={{ height: "180px", background: p.grad, display: "flex", alignItems: "center", justifyContent: "center", filter: "blur(2px)" }}>
                <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "56px", fontWeight: 700, color: "rgba(255,255,255,0.8)" }}>
                  {p.name.split(" ").map(w => w[0]).join("")}
                </span>
              </div>

              {/* Lock overlay */}
              <div style={{ position: "absolute", top: "60px", left: "50%", transform: "translateX(-50%)", background: "rgba(26,10,20,0.75)", borderRadius: "9999px", padding: "6px 16px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "14px" }}>🔒</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#fff" }}>{cta.locked}</span>
              </div>

              {/* Info */}
              <div style={{ padding: "20px 24px" }}>
                <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "18px", fontWeight: 700, color: "#1a0a14", margin: "0 0 6px" }}>
                  {p.name} · {p.age}
                </h3>
                <p style={{ fontSize: "12px", color: "#aaa", margin: "0 0 10px" }}>📍 {p.location}</p>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[p.profession, p.religion, p.community].map((tag) => (
                    <span key={tag} style={{ fontSize: "11px", fontWeight: 600, color: "#dc1e3c", background: "rgba(220,30,60,0.07)", padding: "3px 10px", borderRadius: "9999px" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{ textAlign: "center", marginTop: "48px", padding: "40px 24px", background: "#fff", borderRadius: "20px", border: "1px solid rgba(220,30,60,0.08)" }}>
          <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "26px", fontWeight: 700, color: "#1a0a14", marginBottom: "12px" }}>
            See Full Profiles & Connect
          </h2>
          <p style={{ fontSize: "14px", color: "#888", marginBottom: "24px" }}>
            Register free to view complete profiles, photos, contact details and send interests.
          </p>
          <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={cta.href} style={{ display: "inline-block", padding: "13px 36px", borderRadius: "9999px", background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff", fontWeight: 700, fontSize: "14px", textDecoration: "none", boxShadow: "0 4px 20px rgba(220,30,60,0.3)" }}>
              {cta.label}
            </Link>
            <Link href="/auth/login" style={{ display: "inline-block", padding: "13px 36px", borderRadius: "9999px", border: "2px solid #dc1e3c", color: "#dc1e3c", fontWeight: 700, fontSize: "14px", textDecoration: "none" }}>
              Log In
            </Link>
          </div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
