"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield, Brain, Heart, X, ChevronRight, MapPin, Briefcase,
  GraduationCap, CheckCircle, Clock, Loader2,
} from "lucide-react";
import { matchApi, profileApi } from "@/lib/api";

const brand = {
  bg: "#fdfbf9",
  card: "#fff",
  cardBorder: "1px solid rgba(220,30,60,0.08)",
  cardRadius: "16px",
  primary: "#dc1e3c",
  gradient: "linear-gradient(135deg, #dc1e3c, #a0153c)",
  gold: "#C89020",
  textPrimary: "#1a0a14",
  textMuted: "#888",
  playfair: "var(--font-playfair, serif)",
  poppins: "var(--font-poppins, sans-serif)",
};

const GRADIENTS = [
  "linear-gradient(135deg, #E8426A, #E8A060)",
  "linear-gradient(135deg, #9A6B00, #C89020)",
  "linear-gradient(135deg, #5C7A52, #8DB870)",
  "linear-gradient(135deg, #0F766E, #14B8A6)",
  "linear-gradient(135deg, #7A5200, #C89020)",
];

const TAG_STYLES = [
  { tag: "Top Match", tagBg: "rgba(220,30,60,0.1)", tagColor: "#dc1e3c" },
  { tag: "Great Match", tagBg: "rgba(200,144,32,0.1)", tagColor: "#C89020" },
  { tag: "Good Match", tagBg: "rgba(92,122,82,0.1)", tagColor: "#5C7A52" },
  { tag: "Compatible", tagBg: "rgba(26,10,20,0.06)", tagColor: "rgba(26,10,20,0.55)" },
];

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

interface DailyMatch {
  id: string;
  name: string;
  age: number;
  city: string;
  state: string;
  profession: string;
  company: string;
  education: string;
  religion: string;
  height: string;
  verified: boolean;
  trustScore: number;
  compatibility: number;
  about: string;
  photo: string;
  photoGrad: string;
  tag: string;
  tagBg: string;
  tagColor: string;
  dimensions: Record<string, number>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapMatch(p: any, idx: number): DailyMatch {
  const firstName = p.first_name || p.firstName || "";
  const lastName = p.last_name || p.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || p.name || "Unknown";
  const tagStyle = TAG_STYLES[Math.min(idx, TAG_STYLES.length - 1)];
  return {
    id: p.id || p.user_id || String(idx),
    name,
    age: p.age ?? 0,
    city: p.city || p.location || "",
    state: p.state || "",
    profession: p.profession || p.occupation || "",
    company: p.company || "",
    education: p.education_level || p.education || "",
    religion: p.religion || "",
    height: p.height_cm ? cmToFeetInches(p.height_cm) : p.height || "",
    verified: p.is_verified ?? p.verified ?? false,
    trustScore: p.trust_score ?? p.trustScore ?? 0,
    compatibility: p.compatibility ?? p.match_score ?? 0,
    about: p.about || p.bio || "",
    photo: getInitials(name),
    photoGrad: GRADIENTS[idx % GRADIENTS.length],
    ...tagStyle,
    dimensions: p.dimensions || {},
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

export default function DashboardPage() {
  const [interests, setInterests] = useState<Record<string, "sent" | "passed">>({});
  const [matches, setMatches] = useState<DailyMatch[]>([]);
  const [trustScore, setTrustScore] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [matchRes, trustRes] = await Promise.allSettled([
          matchApi.getDailyMatches(),
          profileApi.getTrustScore(),
        ]);

        if (matchRes.status === "fulfilled") {
          const data = matchRes.value.data;
          const list = Array.isArray(data) ? data : data?.results ?? data?.matches ?? data?.data ?? [];
          setMatches(list.map(mapMatch));
        }

        if (trustRes.status === "fulfilled") {
          const data = trustRes.value.data;
          setTrustScore(data?.trust_score ?? data?.trustScore ?? data?.score ?? null);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to load dashboard";
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const sendInterest = async (id: string) => {
    setInterests((p) => ({ ...p, [id]: "sent" }));
    try {
      await matchApi.sendInterest(id);
    } catch {
      setInterests((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  };
  const pass = (id: string) => setInterests((p) => ({ ...p, [id]: "passed" }));

  const active = matches.filter((m) => !interests[m.id]);
  const sent = matches.filter((m) => interests[m.id] === "sent");

  const displayScore = trustScore ?? 84;

  return (
    <div style={{ padding: "32px", maxWidth: "1200px", background: brand.bg, minHeight: "100vh", fontFamily: brand.poppins }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "32px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <p style={{ fontFamily: brand.poppins, fontSize: "15px", marginBottom: "4px", color: brand.gold }}>
            Welcome back
          </p>
          <h1 style={{ fontFamily: brand.playfair, fontSize: "30px", fontWeight: 300, color: brand.textPrimary, margin: "0 0 8px 0" }}>
            Your Daily Matches
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontFamily: brand.poppins, fontSize: "13px", color: "rgba(26,10,20,0.45)" }}>
              {loading ? "Loading…" : `${matches.length} curated matches`} ·
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: brand.primary }}>
              <Clock style={{ width: "14px", height: "14px" }} />
              <span style={{ fontFamily: brand.poppins, fontSize: "13px", fontWeight: 500 }}>Refreshes at 6:00 AM IST</span>
            </div>
          </div>
        </div>

        {/* Trust score card */}
        <div style={{
          background: brand.card,
          border: "1px solid rgba(220,30,60,0.12)",
          borderRadius: brand.cardRadius,
          boxShadow: "0 2px 12px rgba(220,30,60,0.06)",
          padding: "16px 20px",
          minWidth: "180px",
          textAlign: "right",
        }}>
          <p style={{ fontFamily: brand.poppins, fontSize: "11px", color: "rgba(26,10,20,0.45)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Your Trust Score</p>
          {loading ? (
            <Loader2 style={{ width: "24px", height: "24px", color: "#dc1e3c", animation: "spin 1s linear infinite", marginLeft: "auto" }} />
          ) : (
            <p style={{ fontFamily: brand.playfair, fontSize: "40px", fontWeight: 700, background: brand.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", margin: 0 }}>{displayScore}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px", marginTop: "4px" }}>
            <Shield style={{ width: "12px", height: "12px", color: "#5C7A52" }} />
            <span style={{ fontFamily: brand.poppins, fontSize: "11px", color: "#5C7A52", fontWeight: 500 }}>Verified</span>
          </div>
          <Link href="/profile/me" style={{ fontFamily: brand.poppins, fontSize: "11px", color: brand.primary, fontWeight: 600, display: "block", marginTop: "8px", textDecoration: "none" }}>
            Boost Score →
          </Link>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Profile completeness banner */}
      <div style={{
        background: brand.card,
        border: brand.cardBorder,
        borderRadius: brand.cardRadius,
        boxShadow: "0 2px 12px rgba(220,30,60,0.06)",
        padding: "16px 20px",
        marginBottom: "32px",
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <span style={{ fontFamily: brand.poppins, fontSize: "13px", fontWeight: 600, color: brand.textPrimary }}>Profile completeness: 68%</span>
            <span style={{ fontFamily: brand.poppins, fontSize: "11px", color: brand.gold, fontWeight: 500 }}>+28pts trust score if complete</span>
          </div>
          <div style={{ height: "8px", background: "rgba(26,10,20,0.08)", borderRadius: "99px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: "68%", background: "linear-gradient(90deg, #dc1e3c, #a0153c)", borderRadius: "99px" }} />
          </div>
        </div>
        <Link href="/profile/me" style={{
          fontFamily: brand.poppins,
          fontSize: "12px",
          fontWeight: 600,
          color: "#fff",
          background: brand.gradient,
          borderRadius: "10px",
          padding: "10px 18px",
          textDecoration: "none",
          whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(220,30,60,0.25)",
        }}>
          Complete Profile
        </Link>
      </div>

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "80px 0", textAlign: "center" }}>
          <Loader2 style={{ width: "36px", height: "36px", color: "#dc1e3c", margin: "0 auto 12px", animation: "spin 1s linear infinite" }} />
          <p style={{ fontFamily: brand.poppins, fontSize: "14px", color: "#888" }}>Loading your matches…</p>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <X style={{ width: "40px", height: "40px", color: "#dc1e3c", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: brand.poppins, fontSize: "14px", color: "#888" }}>{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Sent interests strip */}
          {sent.length > 0 && (
            <div style={{
              marginBottom: "24px",
              padding: "14px 18px",
              borderRadius: brand.cardRadius,
              background: "rgba(92,122,82,0.08)",
              border: "1px solid rgba(92,122,82,0.2)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Heart style={{ width: "16px", height: "16px", color: "#5C7A52" }} />
                <span style={{ fontFamily: brand.poppins, fontSize: "13px", fontWeight: 500, color: "#5C7A52" }}>
                  Interest sent to {sent.map((m) => m.name.split(" ")[0]).join(", ")} · awaiting response
                </span>
              </div>
            </div>
          )}

          {/* Match cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "24px" }}>
            {active.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                onInterest={() => sendInterest(match.id)}
                onPass={() => pass(match.id)}
              />
            ))}

            {active.length === 0 && (
              <div style={{ gridColumn: "1 / -1", padding: "80px 0", textAlign: "center" }}>
                <Heart style={{ width: "48px", height: "48px", color: "rgba(220,30,60,0.3)", margin: "0 auto 16px" }} />
                <h3 style={{ fontFamily: brand.playfair, fontSize: "20px", color: "rgba(26,10,20,0.6)", marginBottom: "8px" }}>
                  {matches.length === 0 ? "No matches yet" : "All done for today"}
                </h3>
                <p style={{ fontFamily: brand.poppins, fontSize: "13px", color: "rgba(26,10,20,0.4)" }}>New matches arrive at 6:00 AM IST</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MatchCard({ match: m, onInterest, onPass }: {
  match: DailyMatch;
  onInterest: () => void;
  onPass: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [hovered, setHovered] = useState(false);

  const hasDimensions = Object.keys(m.dimensions).length > 0;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.25s ease",
        boxShadow: hovered ? "0 8px 32px rgba(220,30,60,0.14)" : "0 2px 12px rgba(220,30,60,0.06)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Photo placeholder */}
      <div style={{ position: "relative", height: "208px", display: "flex", alignItems: "center", justifyContent: "center", background: m.photoGrad }}>
        <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "48px", fontWeight: 300, color: "rgba(255,255,255,0.9)" }}>{m.photo}</span>

        {/* Tag */}
        <div style={{
          position: "absolute", top: "12px", left: "12px",
          padding: "4px 10px", borderRadius: "99px",
          background: m.tagBg, color: m.tagColor,
          fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", fontWeight: 600,
        }}>
          {m.tag}
        </div>

        {/* Trust score */}
        {m.trustScore > 0 && (
          <div style={{
            position: "absolute", top: "12px", right: "12px",
            display: "flex", alignItems: "center", gap: "4px",
            padding: "4px 8px", borderRadius: "99px",
            background: "rgba(253,251,249,0.92)",
          }}>
            <Shield style={{ width: "12px", height: "12px", color: "#5C7A52" }} />
            <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", fontWeight: 700, color: "#1a0a14" }}>{m.trustScore}</span>
          </div>
        )}

        {/* Compatibility ring */}
        {m.compatibility > 0 && (
          <div style={{
            position: "absolute", bottom: "12px", right: "12px",
            width: "48px", height: "48px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(253,251,249,0.95)",
            border: "2px solid rgba(200,144,32,0.3)",
          }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "12px", fontWeight: 700, color: "#C89020", lineHeight: 1, margin: 0 }}>{m.compatibility}%</p>
              <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "8px", color: "rgba(26,10,20,0.4)", lineHeight: 1, marginTop: "2px" }}>match</p>
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "4px" }}>
          <div>
            <h3 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "18px", fontWeight: 600, color: "#1a0a14", margin: "0 0 2px 0" }}>
              {m.name}{m.age > 0 ? `, ${m.age}` : ""}
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "4px", color: "rgba(26,10,20,0.5)" }}>
              <MapPin style={{ width: "12px", height: "12px" }} />
              <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px" }}>{[m.city, m.state].filter(Boolean).join(", ") || "—"}</span>
              {m.verified && <CheckCircle style={{ width: "12px", height: "12px", color: "#5C7A52", marginLeft: "4px" }} />}
            </div>
          </div>
        </div>

        <div style={{ marginTop: "8px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "4px" }}>
          {m.profession && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(26,10,20,0.6)" }}>
              <Briefcase style={{ width: "12px", height: "12px", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {[m.profession, m.company].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
          {m.education && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "rgba(26,10,20,0.6)" }}>
              <GraduationCap style={{ width: "12px", height: "12px", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {m.education}
              </span>
            </div>
          )}
        </div>

        {/* Compatibility breakdown */}
        {hasDimensions && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: "100%", textAlign: "left", marginBottom: "12px",
              background: "none", border: "none", padding: 0, cursor: "pointer",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: expanded ? "8px" : 0 }}>
              <Brain style={{ width: "14px", height: "14px", color: "#dc1e3c" }} />
              <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", fontWeight: 600, color: "rgba(26,10,20,0.7)" }}>Compatibility Breakdown</span>
              <ChevronRight style={{
                width: "14px", height: "14px", color: "rgba(26,10,20,0.3)",
                marginLeft: "auto", transition: "transform 0.2s",
                transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
              }} />
            </div>
            {expanded && (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {Object.entries(m.dimensions).map(([dim, score]) => (
                  <div key={dim} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", color: "rgba(26,10,20,0.5)", textTransform: "capitalize", width: "88px" }}>{dim}</span>
                    <div style={{ flex: 1, height: "6px", background: "rgba(26,10,20,0.08)", borderRadius: "99px", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${score}%`, background: "linear-gradient(90deg, #dc1e3c, #a0153c)", borderRadius: "99px" }} />
                    </div>
                    <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", fontWeight: 700, color: "#C89020", width: "28px", textAlign: "right" }}>{score}</span>
                  </div>
                ))}
              </div>
            )}
          </button>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={onPass}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "9px 0", border: "1px solid rgba(26,10,20,0.15)", borderRadius: "10px",
              background: "none", fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", fontWeight: 500,
              color: "rgba(26,10,20,0.5)", cursor: "pointer", transition: "all 0.2s",
            }}
          >
            <X style={{ width: "14px", height: "14px" }} />
            Pass
          </button>
          <Link
            href={`/profile/${m.id}`}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "9px 16px", border: "1px solid rgba(26,10,20,0.15)", borderRadius: "10px",
              fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", fontWeight: 500,
              color: "rgba(26,10,20,0.5)", textDecoration: "none", transition: "background 0.2s",
            }}
          >
            View
          </Link>
          <button
            onClick={onInterest}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
              padding: "9px 0", background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
              border: "none", borderRadius: "10px",
              fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", fontWeight: 600,
              color: "#fff", cursor: "pointer",
              boxShadow: "0 4px 16px rgba(220,30,60,0.25)", transition: "all 0.2s",
            }}
          >
            <Heart style={{ width: "14px", height: "14px", fill: "#fff" }} />
            Interest
          </button>
        </div>
      </div>
    </div>
  );
}
