"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search, SlidersHorizontal, Shield, MapPin, Briefcase,
  GraduationCap, CheckCircle, Heart, X, ChevronDown, Loader2,
} from "lucide-react";
import { matchApi } from "@/lib/api";

interface Profile {
  id: string;
  name: string;
  age: number;
  city: string;
  profession: string;
  education: string;
  religion: string;
  height: string;
  verified: boolean;
  trustScore: number;
  compatibility: number;
  photo: string;
  grad: string;
}

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

const GRADIENTS = [
  "linear-gradient(135deg,#E8426A,#E8A060)",
  "linear-gradient(135deg,#9A6B00,#C89020)",
  "linear-gradient(135deg,#5C7A52,#8DB870)",
  "linear-gradient(135deg,#0F766E,#14B8A6)",
  "linear-gradient(135deg,#7A5200,#C89020)",
  "linear-gradient(135deg,#E8426A99,#9A6B0099)",
  "linear-gradient(135deg,#9B1C1C,#C9952A)",
  "linear-gradient(135deg,#7C3AED,#A78BFA)",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapApiProfile(p: any, idx: number): Profile {
  const firstName = p.first_name || p.firstName || "";
  const lastName = p.last_name || p.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || "Unknown";
  return {
    id: p.id || p.user_id || String(idx),
    name,
    age: p.age ?? 0,
    city: p.city || p.location || "",
    profession: p.profession || p.occupation || "",
    education: p.education_level || p.education || "",
    religion: p.religion || "",
    height: p.height_cm ? cmToFeetInches(p.height_cm) : p.height || "",
    verified: p.is_verified ?? p.verified ?? false,
    trustScore: p.trust_score ?? p.trustScore ?? 0,
    compatibility: p.compatibility ?? p.match_score ?? 0,
    photo: getInitials(name),
    grad: GRADIENTS[idx % GRADIENTS.length],
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const religions = ["All", "Hindu", "Sikh", "Christian", "Jain", "Muslim"];
const ageRanges = ["All", "22–25", "25–28", "28–32", "32+"];
const cities = ["All", "Mumbai", "Delhi", "Bangalore", "Hyderabad", "Chennai", "Ahmedabad", "Pune"];

export default function MatchesPage() {
  const [search, setSearch] = useState("");
  const [religion, setReligion] = useState("All");
  const [ageRange, setAgeRange] = useState("All");
  const [city, setCity] = useState("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (religion !== "All") params.religion = religion;
      if (city !== "All") params.city = city;
      if (verifiedOnly) params.verified = "true";

      const res = await matchApi.browseProfiles(params);
      const data = res.data;
      const list = Array.isArray(data) ? data : data?.results ?? data?.profiles ?? data?.data ?? [];
      setProfiles(list.map(mapApiProfile));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to load profiles";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [religion, city, verifiedOnly]);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const handleLike = async (id: string) => {
    const wasLiked = liked.has(id);
    setLiked((prev) => {
      const s = new Set(prev);
      wasLiked ? s.delete(id) : s.add(id);
      return s;
    });
    if (!wasLiked) {
      try {
        await matchApi.sendInterest(id);
      } catch {
        // revert on failure
        setLiked((prev) => {
          const s = new Set(prev);
          s.delete(id);
          return s;
        });
      }
    }
  };

  const filtered = profiles.filter((p) => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.city.toLowerCase().includes(search.toLowerCase())) return false;
    if (ageRange !== "All") {
      const [lo, hi] = ageRange.replace("+", "–99").split("–").map(Number);
      if (p.age < lo || p.age > hi) return false;
    }
    return true;
  });

  return (
    <div style={{ background: "#fdfbf9", minHeight: "100vh", padding: "32px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1 style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "30px", fontWeight: 300, color: "#1a0a14", margin: 0, lineHeight: 1.2 }}>
          Browse Profiles
        </h1>
        <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", color: "#888", marginTop: "4px", marginBottom: 0 }}>
          {loading ? "Loading…" : `${filtered.length} profiles match your preferences`}
        </p>
      </div>

      {/* Search + Filter bar */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
        <div
          style={{
            flex: 1, display: "flex", alignItems: "center", gap: "8px",
            padding: "0 16px", background: "#fff",
            border: "1px solid rgba(220,30,60,0.15)", borderRadius: "10px", height: "44px",
          }}
        >
          <Search style={{ width: "16px", height: "16px", color: "rgba(26,10,20,0.35)", flexShrink: 0 }} />
          <input
            type="text"
            placeholder="Search by name or city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1, background: "transparent",
              fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px",
              color: "#1a0a14", border: "none", outline: "none",
            }}
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: "flex", alignItems: "center", gap: "8px",
            padding: "0 16px", height: "44px", borderRadius: "10px",
            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", fontWeight: 500,
            cursor: "pointer", transition: "all 0.2s ease",
            background: showFilters ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "#fff",
            color: showFilters ? "#fff" : "rgba(26,10,20,0.60)",
            border: showFilters ? "none" : "1px solid rgba(220,30,60,0.15)",
            boxShadow: showFilters ? "0 4px 16px rgba(220,30,60,0.25)" : "none",
          }}
        >
          <SlidersHorizontal style={{ width: "16px", height: "16px" }} />
          Filters
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div
          style={{
            background: "#fff", border: "1px solid rgba(220,30,60,0.08)",
            borderRadius: "16px", padding: "20px", marginBottom: "24px",
            boxShadow: "0 2px 12px rgba(220,30,60,0.06)",
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "16px" }}>
            <FilterSelect label="Religion" value={religion} options={religions} onChange={setReligion} />
            <FilterSelect label="Age Range" value={ageRange} options={ageRanges} onChange={setAgeRange} />
            <FilterSelect label="City" value={city} options={cities} onChange={setCity} />
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px", color: "rgba(26,10,20,0.5)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Options
              </label>
              <button
                onClick={() => setVerifiedOnly(!verifiedOnly)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 12px", borderRadius: "10px", cursor: "pointer",
                  fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", fontWeight: 500,
                  background: verifiedOnly ? "rgba(220,30,60,0.08)" : "rgba(26,10,20,0.04)",
                  color: verifiedOnly ? "#dc1e3c" : "rgba(26,10,20,0.55)",
                  border: verifiedOnly ? "1px solid rgba(220,30,60,0.2)" : "1px solid rgba(26,10,20,0.08)",
                  transition: "all 0.2s ease",
                }}
              >
                <Shield style={{ width: "14px", height: "14px" }} />
                Verified Only
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div style={{ padding: "80px 0", textAlign: "center" }}>
          <Loader2
            style={{
              width: "36px", height: "36px", color: "#dc1e3c",
              margin: "0 auto 12px", animation: "spin 1s linear infinite",
            }}
          />
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888" }}>
            Finding your best matches…
          </p>
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        </div>
      )}

      {/* Error state */}
      {!loading && error && (
        <div style={{ padding: "60px 0", textAlign: "center" }}>
          <X style={{ width: "40px", height: "40px", color: "#dc1e3c", margin: "0 auto 12px" }} />
          <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888", marginBottom: "12px" }}>
            {error}
          </p>
          <button
            onClick={fetchProfiles}
            style={{
              padding: "8px 20px", borderRadius: "10px", cursor: "pointer",
              background: "linear-gradient(135deg,#dc1e3c,#a0153c)", color: "#fff",
              fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", fontWeight: 600,
              border: "none", boxShadow: "0 4px 16px rgba(220,30,60,0.25)",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && !error && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
            {filtered.map((p) => (
              <ProfileCard key={p.id} profile={p} liked={liked} onToggleLike={handleLike} />
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: "80px 0", textAlign: "center" }}>
              <Heart style={{ width: "40px", height: "40px", color: "rgba(26,10,20,0.2)", margin: "0 auto 12px" }} />
              <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "14px", color: "#888" }}>
                No profiles match your filters. Try adjusting your criteria.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ProfileCard({
  profile,
  liked,
  onToggleLike,
}: {
  profile: Profile;
  liked: Set<string>;
  onToggleLike: (id: string) => void;
}) {
  const isLiked = liked.has(profile.id);

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid rgba(220,30,60,0.08)",
        borderRadius: "16px",
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.2s ease",
        boxShadow: "0 2px 12px rgba(220,30,60,0.06)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 28px rgba(220,30,60,0.14)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = "0 2px 12px rgba(220,30,60,0.06)";
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
      }}
    >
      {/* Photo area */}
      <div style={{ position: "relative", height: "144px", display: "flex", alignItems: "center", justifyContent: "center", background: profile.grad }}>
        <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "30px", fontWeight: 300, color: "rgba(255,255,255,0.9)" }}>
          {profile.photo}
        </span>

        {/* Like button */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleLike(profile.id); }}
          style={{
            position: "absolute", top: "8px", right: "8px",
            width: "28px", height: "28px", borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center",
            background: isLiked ? "#dc1e3c" : "rgba(255,255,255,0.92)",
            border: "none", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            transition: "all 0.2s ease",
          }}
        >
          <Heart
            style={{
              width: "14px", height: "14px",
              color: isLiked ? "#fff" : "rgba(26,10,20,0.5)",
              fill: isLiked ? "#fff" : "none",
            }}
          />
        </button>

        {/* Trust score */}
        {profile.trustScore > 0 && (
          <div
            style={{
              position: "absolute", bottom: "8px", left: "8px",
              display: "flex", alignItems: "center", gap: "4px",
              padding: "2px 6px", borderRadius: "20px",
              background: "rgba(253,251,249,0.92)",
            }}
          >
            <Shield style={{ width: "10px", height: "10px", color: "#C89020" }} />
            <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "10px", fontWeight: 700, color: "#1a0a14" }}>
              {profile.trustScore}
            </span>
          </div>
        )}

        {/* Verified badge */}
        {profile.verified && (
          <div style={{ position: "absolute", top: "8px", left: "8px" }}>
            <CheckCircle style={{ width: "16px", height: "16px", color: "#dc1e3c", fill: "rgba(220,30,60,0.15)" }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "12px" }}>
        <h3 style={{
          fontFamily: "var(--font-playfair, serif)", fontSize: "14px", fontWeight: 600,
          color: "#1a0a14", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {profile.name}{profile.age > 0 ? `, ${profile.age}` : ""}
        </h3>

        {profile.city && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "4px", marginBottom: "6px" }}>
            <MapPin style={{ width: "10px", height: "10px", color: "#888", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.city}
            </span>
          </div>
        )}

        {profile.profession && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "10px" }}>
            <Briefcase style={{ width: "10px", height: "10px", color: "#888", flexShrink: 0 }} />
            <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {profile.profession}
            </span>
          </div>
        )}

        {/* Compatibility */}
        {profile.compatibility > 0 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", color: "rgba(26,10,20,0.4)" }}>Match</span>
            <span style={{ fontFamily: "var(--font-playfair, serif)", fontSize: "14px", fontWeight: 700, color: "#C89020" }}>
              {profile.compatibility}%
            </span>
          </div>
        )}

        <Link
          href={`/profile/${profile.id}`}
          style={{
            display: "block", width: "100%", textAlign: "center",
            background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
            color: "#fff", borderRadius: "10px",
            padding: "8px 0",
            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "12px", fontWeight: 600,
            boxShadow: "0 2px 8px rgba(220,30,60,0.25)",
            textDecoration: "none", transition: "all 0.2s ease",
          }}
        >
          View Profile
        </Link>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label style={{
        fontFamily: "var(--font-poppins, sans-serif)", fontSize: "11px",
        color: "rgba(26,10,20,0.5)", textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: "100%", appearance: "none",
            fontFamily: "var(--font-poppins, sans-serif)", fontSize: "13px", color: "#1a0a14",
            background: "rgba(255,255,255,0.8)", borderRadius: "10px",
            padding: "8px 32px 8px 12px",
            border: "1px solid rgba(220,30,60,0.15)", outline: "none", cursor: "pointer",
          }}
        >
          {options.map((o) => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", width: "14px", height: "14px", color: "rgba(26,10,20,0.4)", pointerEvents: "none" }} />
      </div>
    </div>
  );
}
