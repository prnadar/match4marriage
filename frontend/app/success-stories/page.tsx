"use client";

import { useState } from "react";
import { useAuthState, getCTA } from "@/lib/useVerification";
import Link from "next/link";
import { Heart, MapPin, Quote, Star, ChevronRight } from "lucide-react";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

const stories = [
  {
    id: 1,
    names: "Priya & Rahul",
    location: "London, UK",
    married: "December 2024",
    religion: "Hindu",
    community: "Tamil Brahmin",
    photo: null,
    initials: "P&R",
    grad: "linear-gradient(135deg,#dc1e3c,#a0153c)",
    quote:
      "We had both given up on online matchmaking until Match4Marriage. Within weeks, we were introduced to each other, and within months, our families had met. We married in Chennai in December 2024.",
    details: "Met on Match4Marriage · Engaged in 3 months · Married in Chennai",
    rating: 5,
  },
  {
    id: 2,
    names: "Anjali & Suresh",
    location: "Birmingham, UK",
    married: "March 2024",
    religion: "Hindu",
    community: "Telugu",
    photo: null,
    initials: "A&S",
    grad: "linear-gradient(135deg,#9A6B00,#C89020)",
    quote:
      "The personal touch at Match4Marriage made all the difference. Our advisor understood exactly what we were looking for and introduced us within two weeks. We couldn't be happier.",
    details: "Met on Match4Marriage · Married in Birmingham",
    rating: 5,
  },
  {
    id: 3,
    names: "Meera & Vikram",
    location: "Manchester, UK",
    married: "August 2023",
    religion: "Hindu",
    community: "Kannada",
    photo: null,
    initials: "M&V",
    grad: "linear-gradient(135deg,#5C7A52,#8DB870)",
    quote:
      "We were both NRIs living in different cities. Match4Marriage bridged that gap and connected us in a way that felt natural and genuine. Our wedding was the best day of our lives.",
    details: "NRI Match · UK to UK · Married in Leicester",
    rating: 5,
  },
  {
    id: 4,
    names: "Divya & Arjun",
    location: "Leicester, UK",
    married: "June 2024",
    religion: "Hindu",
    community: "Gujarati",
    photo: null,
    initials: "D&A",
    grad: "linear-gradient(135deg,#7C3AED,#A78BFA)",
    quote:
      "From the very first call with Match4Marriage's advisor, we knew this was different. No swiping, no awkward chats. Just a genuine, curated introduction. We are forever grateful.",
    details: "Advisor-curated match · Married in 6 months",
    rating: 5,
  },
  {
    id: 5,
    names: "Kavitha & Senthil",
    location: "Glasgow, UK",
    married: "October 2023",
    religion: "Hindu",
    community: "Tamil",
    photo: null,
    initials: "K&S",
    grad: "linear-gradient(135deg,#0F766E,#14B8A6)",
    quote:
      "Senthil was based in Glasgow and I was in Chennai. Match4Marriage helped coordinate our first meeting during his India visit. Three months later, we were engaged.",
    details: "Cross-country match · UK & India · Tamil wedding",
    rating: 5,
  },
  {
    id: 6,
    names: "Nisha & Alex",
    location: "London, UK",
    married: "January 2025",
    religion: "Christian",
    community: "Kerala Christian",
    photo: "/images/why-different.jpg",
    initials: "N&A",
    grad: "linear-gradient(135deg,#E8426A,#E8A060)",
    quote:
      "We were both introduced through Match4Marriage's family-first approach. Our families connected before we did, which made everything feel right. Best decision we ever made.",
    details: "Family-introduced · Married in London",
    rating: 5,
  },
];

const filters: string[] = [];

export default function SuccessStoriesPage() {
  const authState = useAuthState();
  const cta = getCTA(authState);
  const [expanded, setExpanded] = useState<number | null>(null);

  const filtered = stories;

  return (
    <div style={{ minHeight: "100vh", background: "#fdfbf9", fontFamily: "var(--font-poppins, sans-serif)" }}>
      <PublicHeader />

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 50%, #3b3fa0 100%)", padding: "72px 24px 56px", textAlign: "center" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, color: "rgba(255,255,255,0.75)", textTransform: "uppercase", letterSpacing: "0.2em", display: "block", marginBottom: "16px" }}>
          Real Love Stories
        </span>
        <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(28px, 4vw, 52px)", fontWeight: 700, color: "#fff", margin: "0 0 16px" }}>
          Success Stories 💍
        </h1>
        <p style={{ fontSize: "16px", color: "rgba(255,255,255,0.85)", maxWidth: "540px", margin: "0 auto 40px" }}>
          Hundreds of families have found their perfect match through Match4Marriage. Here are just a few of their stories.
        </p>

      </div>



      {/* Stories grid */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "28px" }}>
          {filtered.map((story) => (
            <div key={story.id} onClick={() => setExpanded(expanded === story.id ? null : story.id)}
              style={{ background: "#fff", borderRadius: "20px", overflow: "hidden", border: "1px solid rgba(220,30,60,0.08)", boxShadow: "0 4px 24px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", cursor: "pointer" }}>

              {/* Photo / gradient */}
              <div style={{ position: "relative", height: "200px", overflow: "hidden" }}>
                {story.photo ? (
                  <img src={story.photo} alt={story.names} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }} />
                ) : (
                  <div style={{ width: "100%", height: "100%", background: story.grad, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "52px", fontWeight: 700, color: "rgba(255,255,255,0.9)" }}>{story.initials}</span>
                  </div>
                )}
                <div style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(255,255,255,0.95)", borderRadius: "9999px", padding: "4px 12px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Heart style={{ width: "12px", height: "12px", color: "#dc1e3c", fill: "#dc1e3c" }} />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#dc1e3c" }}>Matched</span>
                </div>
              </div>

              {/* Content */}
              <div style={{ padding: "24px", flex: 1, display: "flex", flexDirection: "column" }}>
                <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "22px", fontWeight: 700, color: "#1a0a14", margin: "0 0 8px" }}>{story.names}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#aaa" }}>
                    <MapPin style={{ width: "12px", height: "12px" }} />{story.location}
                  </div>
                  <span style={{ fontSize: "11px", background: "rgba(220,30,60,0.08)", color: "#dc1e3c", fontWeight: 600, padding: "2px 10px", borderRadius: "9999px" }}>
                    Married {story.married}
                  </span>
                </div>
                <div style={{ display: "flex", gap: "2px", marginBottom: "14px" }}>
                  {Array.from({ length: story.rating }).map((_, i) => (
                    <Star key={i} style={{ width: "14px", height: "14px", color: "#ffd87a", fill: "#ffd87a" }} />
                  ))}
                </div>
                <div style={{ position: "relative", flex: 1 }}>
                  <Quote style={{ width: "20px", height: "20px", color: "rgba(220,30,60,0.2)", position: "absolute", top: 0, left: 0 }} />
                  <p style={{ fontSize: "13px", color: "#666", lineHeight: 1.7, paddingLeft: "28px",
                    display: expanded === story.id ? "block" : "-webkit-box",
                    WebkitLineClamp: expanded === story.id ? undefined : 3,
                    WebkitBoxOrient: "vertical" as const,
                    overflow: expanded === story.id ? "visible" : "hidden",
                  }}>{story.quote}</p>
                </div>
                {expanded === story.id && (
                  <div style={{ marginTop: "16px", padding: "12px 16px", background: "rgba(220,30,60,0.04)", borderRadius: "10px", borderLeft: "3px solid #dc1e3c" }}>
                    <p style={{ fontSize: "12px", color: "#dc1e3c", fontWeight: 600, margin: 0 }}>{story.details}</p>
                  </div>
                )}
                <button style={{ background: "none", border: "none", cursor: "pointer", fontSize: "12px", color: "#dc1e3c", fontWeight: 600, padding: "12px 0 0", textAlign: "left", display: "flex", alignItems: "center", gap: "4px" }}>
                  {expanded === story.id ? "Show less" : "Read full story"}
                  <ChevronRight style={{ width: "14px", height: "14px", transform: expanded === story.id ? "rotate(90deg)" : "none", transition: "transform 0.2s" }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div style={{ background: "linear-gradient(135deg, #dc1e3c 0%, #a0153c 50%, #3b3fa0 100%)", padding: "64px 24px", textAlign: "center" }}>
        <h2 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "clamp(26px, 3.5vw, 42px)", fontWeight: 700, color: "#fff", marginBottom: "16px" }}>
          Your Story Could Be Next
        </h2>
        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: "15px", marginBottom: "32px" }}>
          Join the hundreds of families who found their perfect match through Match4Marriage.
        </p>
        <Link href={cta.href} style={{ display: "inline-block", padding: "14px 40px", borderRadius: "9999px", background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff", fontWeight: 700, fontSize: "15px", textDecoration: "none", boxShadow: "0 4px 24px rgba(220,30,60,0.4)" }}>
          {cta.label}
        </Link>
      </div>

      <PublicFooter />
    </div>
  );
}
