"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search, Shield, X, Loader2, AlertCircle, Heart, SlidersHorizontal,
} from "lucide-react";
import Link from "next/link";
import { matchApi, ApiError } from "@/lib/api";
import { ProfileCard, type ProfileCardData } from "@/components/ui/profile-card";
import { LuxeButton } from "@/components/ui/luxe-button";
import { RevealText } from "@/components/ui/reveal-text";
import { useEntitlements } from "@/lib/useEntitlements";

/* ── Types & helpers ────────────────────────────────────────────────── */

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapApiProfile(p: any, idx: number): ProfileCardData {
  const firstName = p.first_name || p.firstName || "";
  const lastName = p.last_name || p.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || p.name || "Member";
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
    premium: p.is_premium ?? p.premium ?? false,
    compatibility: p.compatibility ?? p.match_score ?? 0,
    photoUrl: p.profile_photo || p.photo_url || p.photoUrl || null,
    gender: p.gender,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const RELIGIONS = ["All", "Hindu", "Sikh", "Christian", "Jain", "Muslim", "Buddhist"];
const AGE_RANGES: Array<{ label: string; lo: number; hi: number }> = [
  { label: "All",   lo: 0,  hi: 99 },
  { label: "22–25", lo: 22, hi: 25 },
  { label: "25–28", lo: 25, hi: 28 },
  { label: "28–32", lo: 28, hi: 32 },
  { label: "32+",   lo: 32, hi: 99 },
];
const COUNTRIES = ["All", "United Kingdom", "India", "United States", "Canada", "Australia", "UAE", "Singapore", "New Zealand"];

/* ── Page ───────────────────────────────────────────────────────────── */

export default function MatchesPage() {
  const [search, setSearch] = useState("");
  const [religion, setReligion] = useState("All");
  const [ageLabel, setAgeLabel] = useState("All");
  const [country, setCountry] = useState("All");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<ProfileCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);

  const { entitlements } = useEntitlements();

  const fetchProfiles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params: Record<string, string> = {};
      // The backend `religion` filter is a lowercase enum (hindu, sikh, …);
      // the UI labels are title-case ("Hindu"). Send the enum value or the
      // query 422s and the grid comes back empty.
      if (religion !== "All") params.religion = religion.toLowerCase();
      if (country !== "All") params.country = country;
      if (verifiedOnly) params.verified = "true";

      const res = await matchApi.browseProfiles(params);
      // PaginatedResponse[ProfileCard] — items live at `.data.data`.
      const list: any[] = (res.data as any)?.data ?? [];
      setProfiles(list.map(mapApiProfile));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  }, [religion, country, verifiedOnly]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const QUOTA_MESSAGE =
    "You've reached your Basic plan limit — upgrade to Premium for unlimited expressions of interest.";

  const handleLike = async (id: string) => {
    const wasLiked = liked.has(id);
    // Proactive gate: a Basic member with 0 remaining (not unlimited) shouldn't
    // even fire the request — show the upgrade prompt up front. -1 = unlimited.
    if (!wasLiked && entitlements.interestsRemaining === 0) {
      setInterestError(QUOTA_MESSAGE);
      return;
    }
    setInterestError(null);
    setLiked((prev) => {
      const s = new Set(prev);
      if (wasLiked) s.delete(id); else s.add(id);
      return s;
    });
    if (!wasLiked) {
      try {
        await matchApi.sendInterest(id);
      } catch (err) {
        // 409 means an interest already exists between these users — treat
        // the heart as already-sent rather than yanking it back.
        if (err instanceof ApiError && err.status === 409) return;
        // Revert the optimistic like for any real failure.
        setLiked((prev) => { const s = new Set(prev); s.delete(id); return s; });
        if (err instanceof ApiError && err.status === 403) {
          // Quota exhausted — surface the server's message with an upgrade path.
          setInterestError(err.message?.replace(/^\d+:\s*/, "") || QUOTA_MESSAGE);
        } else {
          setError(err instanceof Error ? err.message : "Could not send interest");
        }
      }
    }
  };

  const filtered = useMemo(() => {
    const range = AGE_RANGES.find((r) => r.label === ageLabel)!;
    return profiles.filter((p) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !p.name.toLowerCase().includes(q) &&
          !(p.city || "").toLowerCase().includes(q) &&
          !(p.profession || "").toLowerCase().includes(q)
        ) return false;
      }
      const a = p.age ?? 0;
      if (a < range.lo || a > range.hi) return ageLabel === "All";
      return true;
    });
  }, [profiles, search, ageLabel]);

  const activeFilterCount =
    (religion !== "All" ? 1 : 0) +
    (ageLabel !== "All" ? 1 : 0) +
    (country !== "All" ? 1 : 0) +
    (verifiedOnly ? 1 : 0);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)", color: "#e7dde0" }}
    >
      {/* Ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="m4m-aura m4m-aura-rose" />
        <span className="m4m-aura m4m-aura-gold" />
        <span className="m4m-aura m4m-aura-plum" />
        <span className="m4m-aura-vignette" />
      </div>

      <div className="relative mx-auto max-w-[1280px] px-6 py-8 lg:px-8 lg:py-10">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="fade-in-up mb-6 flex flex-col gap-1.5">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#f3c9a8]">
            Discover
          </p>
          <h1 className="font-display text-[34px] font-semibold leading-tight text-white sm:text-[40px]">
            <RevealText as="span" split="word" className="font-display">
              Browse verified profiles
            </RevealText>
          </h1>
          <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-white/60">
            {loading
              ? "Loading…"
              : `${filtered.length} verified profiles match your preferences.`}
          </p>
        </header>

        {/* ── Search + filter toggle ─────────────────────────────────── */}
        <div className="fade-in-up mb-4 flex flex-wrap items-center gap-2.5" style={{ animationDelay: "60ms" }}>
          <div className="flex flex-1 min-w-[260px] items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 shadow-[0_2px_10px_rgba(220,30,60,0.04)] focus-within:border-rose-300 focus-within:shadow-[0_4px_16px_rgba(220,30,60,0.10)]">
            <Search className="h-4 w-4 text-[#ff8aa3]" />
            <input
              type="text"
              placeholder="Search by name, country, or profession…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="text-[#ff8aa3] hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(220,30,60,0.04)] hover:border-white/20 hover:shadow-[0_4px_16px_rgba(220,30,60,0.10)]"
          >
            <SlidersHorizontal className="h-4 w-4 text-[#ff8aa3]" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={
              "inline-flex h-11 items-center gap-2 rounded-2xl px-4 text-[13px] font-semibold transition-colors " +
              (verifiedOnly
                ? "bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-400/25"
                : "border border-white/12 bg-white/[0.06] text-white/70 hover:border-emerald-400/25 hover:text-emerald-200")
            }
          >
            <Shield className="h-4 w-4" />
            Verified only
          </button>
        </div>

        {/* ── Filter chip rows ───────────────────────────────────────── */}
        {showFilters && (
          <div className="fade-in-up mb-7 space-y-3" style={{ animationDelay: "100ms" }}>
            <ChipRow label="Religion"   options={RELIGIONS}                         value={religion} onChange={setReligion} />
            <ChipRow label="Age"        options={AGE_RANGES.map((r) => r.label)}    value={ageLabel} onChange={setAgeLabel} />
            <ChipRow label="Country"    options={COUNTRIES}                         value={country}  onChange={setCountry} />
          </div>
        )}

        {/* ── Loading ────────────────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.04]"
              >
                <div className="h-[260px] animate-pulse bg-white/[0.07]" />
                <div className="p-4">
                  <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="mb-3 h-3 w-1/2 animate-pulse rounded bg-white/[0.07]" />
                  <div className="flex gap-1.5">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.07]" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-white/[0.07]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error ──────────────────────────────────────────────────── */}
        {!loading && error && (
          <div className="fade-in-up rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-sm">
            <AlertCircle className="mx-auto h-10 w-10 text-rose-300/70" />
            <h3 className="font-display mt-3 text-[20px] font-semibold text-white">
              We couldn't load profiles
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
              {error}
            </p>
            <button
              onClick={fetchProfiles}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
            >
              <Loader2 className="h-3.5 w-3.5" /> Retry
            </button>
          </div>
        )}

        {/* ── Interest quota notice ──────────────────────────────────── */}
        {interestError && (
          <div className="fade-in-up mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-[13px] text-rose-100 backdrop-blur-sm">
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4 flex-shrink-0 text-[#ff8aa3]" />
              {interestError}
            </span>
            <div className="flex items-center gap-2">
              <Link
                href="/subscription"
                className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(220,30,60,0.25)]"
              >
                Upgrade to Premium
              </Link>
              <button
                onClick={() => setInterestError(null)}
                className="text-[#ff8aa3] hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Grid ───────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {filtered.length === 0 ? (
              <div className="fade-in-up rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-sm">
                <Heart className="mx-auto h-10 w-10 text-[#ff8aa3]/60" />
                <h3 className="font-display mt-3 text-[20px] font-semibold text-white">
                  No matches with these filters
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
                  Try widening your preferences. Our advisors can also hand-pick profiles for you.
                </p>
                <div className="mt-5 flex justify-center gap-3">
                  <LuxeButton
                    variant="outline"
                    size="md"
                    onClick={() => {
                      setReligion("All"); setAgeLabel("All"); setCountry("All"); setVerifiedOnly(false); setSearch("");
                    }}
                  >
                    Clear filters
                  </LuxeButton>
                  <LuxeButton asChild size="md">
                    <Link href="/contact">Speak to an advisor</Link>
                  </LuxeButton>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {filtered.map((p, i) => (
                  <ProfileCard
                    key={p.id}
                    data={p}
                    index={i}
                    variant="grid"
                    liked={liked.has(p.id)}
                    onToggleLike={handleLike}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`.m4m-aura{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}.m4m-aura-rose{width:540px;height:540px;top:-150px;right:-120px;background:radial-gradient(circle,rgba(220,30,60,0.5),transparent 60%);opacity:.5;}.m4m-aura-gold{width:560px;height:560px;bottom:-190px;left:-150px;background:radial-gradient(circle,rgba(201,149,74,0.4),transparent 60%);opacity:.42;}.m4m-aura-plum{width:380px;height:380px;top:42%;right:28%;background:radial-gradient(circle,rgba(124,58,137,0.4),transparent 60%);opacity:.26;}.m4m-aura-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.5) 100%);}`}</style>
    </div>
  );
}

/* ── Chip filter row ────────────────────────────────────────────────── */

function ChipRow({
  label, options, value, onChange,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 min-w-[64px] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#f3c9a8]">
        {label}
      </span>
      {options.map((o) => {
        const active = value === o;
        return (
          <button
            key={o}
            onClick={() => onChange(o)}
            className={
              "rounded-full px-3 py-1.5 text-[12px] font-medium transition-all " +
              (active
                ? "bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] text-white shadow-[0_4px_14px_rgba(220,30,60,0.25)]"
                : "bg-white/[0.05] text-white/70 ring-1 ring-white/15 hover:ring-white/25 hover:text-white")
            }
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
