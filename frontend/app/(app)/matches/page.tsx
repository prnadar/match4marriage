"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Search, Shield, X, Loader2, AlertCircle, Heart, SlidersHorizontal, ChevronDown, RotateCw,
} from "lucide-react";
import Link from "next/link";
import { matchApi, ApiError } from "@/lib/api";
import { ProfileCard, type ProfileCardData } from "@/components/ui/profile-card";
import { LuxeButton } from "@/components/ui/luxe-button";
import { RevealText } from "@/components/ui/reveal-text";
import { useEntitlements } from "@/lib/useEntitlements";
import { ApprovalGate } from "@/components/ApprovalGate";

/* ── Types & helpers ────────────────────────────────────────────────── */

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function titleCase(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ") : "";
}

function mapApiProfile(p: any, idx: number): ProfileCardData {
  const firstName = p.first_name || p.firstName || "";
  const lastName = p.last_name || p.lastName || "";
  const name = `${firstName} ${lastName}`.trim() || p.name || "Member";
  return {
    id: p.user_id || p.id || String(idx),
    name,
    age: p.age ?? 0,
    city: p.city || p.location || "",
    state: p.state || "",
    profession: p.profession || p.occupation || "",
    company: p.company || "",
    education: p.education_level || p.education || "",
    religion: titleCase(p.religion || ""),
    height: p.height_cm ? cmToFeetInches(p.height_cm) : p.height || "",
    verified: p.is_verified ?? p.verified ?? false,
    premium: p.is_premium ?? p.premium ?? false,
    compatibility: p.compatibility ?? p.match_score ?? 0,
    // Backend ProfileCard field is `primary_photo_url` (never a premium photo).
    photoUrl: p.primary_photo_url || p.profile_photo || p.photo_url || p.photoUrl || null,
    gender: p.gender,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const PAGE_SIZE = 24;
const RELIGIONS = ["All", "Hindu", "Sikh", "Christian", "Jain", "Muslim", "Buddhist"];
const AGE_RANGES: Array<{ label: string; lo?: number; hi?: number }> = [
  { label: "All" },
  { label: "22–25", lo: 22, hi: 25 },
  { label: "25–28", lo: 25, hi: 28 },
  { label: "28–32", lo: 28, hi: 32 },
  { label: "32+",   lo: 32 },
];
const COUNTRIES = ["All", "United Kingdom", "India", "United States", "Canada", "Australia", "UAE", "Singapore", "New Zealand"];
const SHOW = ["All", "Brides", "Grooms"];

/* ── Page ───────────────────────────────────────────────────────────── */

export default function MatchesPage() {
  return (
    <ApprovalGate feature="browse profiles">
      <BrowseContent />
    </ApprovalGate>
  );
}

function BrowseContent() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [religion, setReligion] = useState("All");
  const [ageLabel, setAgeLabel] = useState("All");
  const [country, setCountry] = useState("All");
  const [show, setShow] = useState("All");
  const [showFilters, setShowFilters] = useState(true);

  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<ProfileCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);        // first page
  const [loadingMore, setLoadingMore] = useState(false); // subsequent pages
  const [error, setError] = useState<string | null>(null);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [interestIsQuota, setInterestIsQuota] = useState(false);

  const { entitlements } = useEntitlements();
  const requestId = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Debounce free-text search so we don't hit the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // All filtering happens server-side so totals and pagination are honest.
  const params = useMemo(() => {
    const out: Record<string, string> = { limit: String(PAGE_SIZE) };
    // Backend `religion` is a lowercase enum (hindu, sikh, …).
    if (religion !== "All") out.religion = religion.toLowerCase();
    if (country !== "All") out.country = country;
    const range = AGE_RANGES.find((r) => r.label === ageLabel);
    if (range?.lo) out.min_age = String(range.lo);
    if (range?.hi) out.max_age = String(range.hi);
    if (show === "Brides") out.gender = "female";
    if (show === "Grooms") out.gender = "male";
    if (debouncedSearch) out.q = debouncedSearch;
    return out;
  }, [religion, country, ageLabel, show, debouncedSearch]);

  const fetchPage = useCallback(async (pageToLoad: number) => {
    const id = ++requestId.current;
    if (pageToLoad === 1) { setLoading(true); setError(null); }
    else { setLoadingMore(true); setMoreError(null); }
    try {
      const res = await matchApi.browseProfiles({ ...params, page: String(pageToLoad) });
      if (id !== requestId.current) return; // a newer filter change superseded this
      // PaginatedResponse[ProfileCard] — envelope at `.data`, items at `.data.data`.
      const body = res.data as any;
      const list: any[] = body?.data ?? [];
      const mapped = list.map(mapApiProfile);
      setProfiles((prev) => {
        if (pageToLoad === 1) return mapped;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...mapped.filter((p) => !seen.has(p.id))];
      });
      setTotal(typeof body?.total === "number" ? body.total : mapped.length);
      setHasNext(Boolean(body?.has_next));
      setPage(pageToLoad);
    } catch (err: unknown) {
      if (id !== requestId.current) return;
      const msg = err instanceof Error ? err.message : "Failed to load profiles";
      if (pageToLoad === 1) setError(msg); else setMoreError(msg);
    } finally {
      if (id === requestId.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [params]);

  // Any filter / search change resets to page 1.
  useEffect(() => { fetchPage(1); }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasNext || moreError) return;
    fetchPage(page + 1);
  }, [loading, loadingMore, hasNext, moreError, page, fetchPage]);

  // Infinite scroll: load the next page as the sentinel approaches the viewport.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNext) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNext, loadMore]);

  const QUOTA_MESSAGE =
    "You've reached your Basic plan limit — upgrade to Premium for unlimited expressions of interest.";

  const handleLike = async (id: string) => {
    const wasLiked = liked.has(id);
    // Proactive gate: a Basic member with 0 remaining (not unlimited) shouldn't
    // even fire the request — show the upgrade prompt up front. -1 = unlimited.
    if (!wasLiked && entitlements.interestsRemaining === 0) {
      setInterestError(QUOTA_MESSAGE);
      setInterestIsQuota(true);
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
          setInterestIsQuota(true);
        } else {
          setInterestError(err instanceof Error ? err.message : "Could not send interest. Please try again.");
          setInterestIsQuota(false);
        }
      }
    }
  };

  const activeFilterCount =
    (religion !== "All" ? 1 : 0) +
    (ageLabel !== "All" ? 1 : 0) +
    (country !== "All" ? 1 : 0) +
    (show !== "All" ? 1 : 0);
  const anyFilter = activeFilterCount > 0 || !!debouncedSearch;

  const clearAll = () => {
    setReligion("All"); setAgeLabel("All"); setCountry("All"); setShow("All"); setSearch("");
  };

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

      <div className="relative mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="fade-in-up mb-7 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-[#f3c9a8]">
              Discover
            </p>
            <h1 className="font-display text-[34px] font-semibold leading-tight text-white sm:text-[40px]">
              <RevealText as="span" split="word" className="font-display">
                Browse verified profiles
              </RevealText>
            </h1>
            <p className="mt-1 max-w-xl text-[14px] leading-relaxed text-white/60" aria-live="polite">
              {loading ? (
                <span className="inline-block h-4 w-56 animate-pulse rounded bg-white/10 align-middle" />
              ) : total === 0 ? (
                anyFilter ? "No profiles match these filters yet." : "No verified profiles to show yet."
              ) : (
                <>
                  Showing <span className="font-semibold tabular-nums text-white">{profiles.length}</span> of{" "}
                  <span className="font-semibold tabular-nums text-white">{total}</span>{" "}
                  {anyFilter ? "matching" : "verified"} {total === 1 ? "profile" : "profiles"}
                </>
              )}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1.5 text-[12px] font-medium text-emerald-200 ring-1 ring-emerald-400/20">
            <Shield className="h-3.5 w-3.5" />
            Every profile is reviewed by our team
          </span>
        </header>

        {/* ── Search + filter toggle ─────────────────────────────────── */}
        <div className="fade-in-up mb-4 flex flex-wrap items-center gap-2.5" style={{ animationDelay: "60ms" }}>
          <label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 shadow-[0_2px_10px_rgba(220,30,60,0.04)] transition-[border-color,box-shadow] focus-within:border-rose-300 focus-within:shadow-[0_4px_16px_rgba(220,30,60,0.10)]">
            <Search className="h-4 w-4 text-[#ff8aa3]" aria-hidden />
            <span className="sr-only">Search profiles</span>
            <input
              type="search"
              placeholder="Search by name, city, country or profession…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 flex-1 bg-transparent text-[14px] text-white outline-none placeholder:text-white/35"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="text-[#ff8aa3] hover:text-white"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 text-[13px] font-semibold text-white shadow-[0_2px_10px_rgba(220,30,60,0.04)] transition-[border-color,box-shadow] hover:border-white/20 hover:shadow-[0_4px_16px_rgba(220,30,60,0.10)]"
          >
            <SlidersHorizontal className="h-4 w-4 text-[#ff8aa3]" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
          {anyFilter && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex h-11 items-center gap-1.5 rounded-2xl px-3 text-[13px] font-medium text-white/60 transition-colors hover:text-white"
            >
              <X className="h-3.5 w-3.5" /> Clear all
            </button>
          )}
        </div>

        {/* ── Filter chip rows ───────────────────────────────────────── */}
        {showFilters && (
          <div
            className="fade-in-up mb-8 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"
            style={{ animationDelay: "100ms" }}
          >
            <ChipRow label="Show"       options={SHOW}                              value={show}     onChange={setShow} />
            <ChipRow label="Religion"   options={RELIGIONS}                         value={religion} onChange={setReligion} />
            <ChipRow label="Age"        options={AGE_RANGES.map((r) => r.label)}    value={ageLabel} onChange={setAgeLabel} />
            <ChipRow label="Country"    options={COUNTRIES}                         value={country}  onChange={setCountry} />
          </div>
        )}

        {/* ── Interest quota notice ──────────────────────────────────── */}
        {interestError && (
          <div role="alert" className="fade-in-up mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-[13px] text-rose-100 backdrop-blur-sm">
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4 flex-shrink-0 text-[#ff8aa3]" />
              {interestError}
            </span>
            <div className="flex items-center gap-2">
              {interestIsQuota && (
                <Link
                  href="/subscription"
                  className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(220,30,60,0.25)]"
                >
                  Upgrade to Premium
                </Link>
              )}
              <button
                type="button"
                onClick={() => setInterestError(null)}
                className="text-[#ff8aa3] hover:text-white"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Loading (first page) ───────────────────────────────────── */}
        {loading && <SkeletonGrid count={8} />}

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
              type="button"
              onClick={() => fetchPage(1)}
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
            >
              <RotateCw className="h-3.5 w-3.5" /> Try again
            </button>
          </div>
        )}

        {/* ── Grid ───────────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {profiles.length === 0 ? (
              <div className="fade-in-up rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-sm">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
                  <Heart className="h-7 w-7 text-[#ff8aa3]/70" />
                </div>
                <h3 className="font-display text-[20px] font-semibold text-white">
                  {anyFilter ? "No profiles with these filters" : "No verified profiles yet"}
                </h3>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
                  {anyFilter
                    ? "Try widening your filters. Our advisors can also hand-pick profiles for you."
                    : "New members appear here as soon as our team approves them. Our advisors can also hand-pick profiles for you."}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  {anyFilter && (
                    <LuxeButton variant="outline" size="md" onClick={clearAll}>
                      Clear filters
                    </LuxeButton>
                  )}
                  <LuxeButton asChild size="md">
                    <Link href="/contact">Speak to an advisor</Link>
                  </LuxeButton>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {profiles.map((p, i) => (
                    <ProfileCard
                      key={p.id}
                      data={p}
                      index={i % PAGE_SIZE}
                      variant="grid"
                      liked={liked.has(p.id)}
                      onToggleLike={handleLike}
                    />
                  ))}
                </div>

                {loadingMore && <div className="mt-5"><SkeletonGrid count={4} /></div>}

                {/* Infinite-scroll sentinel + accessible manual fallback */}
                <div ref={sentinelRef} aria-hidden className="h-px" />
                <div className="mt-10 flex flex-col items-center gap-3 text-center">
                  {hasNext ? (
                    <>
                      {moreError && (
                        <p role="alert" className="text-[13px] text-rose-200/90">
                          Couldn't load more profiles. {moreError}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => { setMoreError(null); fetchPage(page + 1); }}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 py-2.5 text-[13px] font-semibold text-white transition-[border-color,background-color,transform] hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.98] disabled:cursor-wait disabled:opacity-60"
                      >
                        {loadingMore ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5 text-[#ff8aa3]" />}
                        {loadingMore ? "Loading…" : moreError ? "Try again" : `Load more · ${total - profiles.length} remaining`}
                      </button>
                    </>
                  ) : (
                    <p className="text-[12px] tracking-wide text-white/40">
                      You've seen all {total} {total === 1 ? "profile" : "profiles"}
                      {anyFilter ? " matching these filters" : ""}.
                    </p>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <style jsx>{`.m4m-aura{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}.m4m-aura-rose{width:540px;height:540px;top:-150px;right:-120px;background:radial-gradient(circle,rgba(220,30,60,0.5),transparent 60%);opacity:.5;}.m4m-aura-gold{width:560px;height:560px;bottom:-190px;left:-150px;background:radial-gradient(circle,rgba(201,149,74,0.4),transparent 60%);opacity:.42;}.m4m-aura-plum{width:380px;height:380px;top:42%;right:28%;background:radial-gradient(circle,rgba(124,58,137,0.4),transparent 60%);opacity:.26;}.m4m-aura-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.5) 100%);}`}</style>
    </div>
  );
}

/* ── Skeleton grid ──────────────────────────────────────────────────── */

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="h-[220px] animate-pulse bg-white/[0.07]" />
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
            type="button"
            aria-pressed={active}
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
