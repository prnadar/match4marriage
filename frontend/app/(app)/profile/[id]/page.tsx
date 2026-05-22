"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import {
  Shield, MapPin, Briefcase, GraduationCap, Heart, MessageCircle,
  CheckCircle, ArrowLeft, Star, Users, Globe, Calendar, Ruler,
  Sparkles, Lock, AlertCircle, Loader2,
} from "lucide-react";
import { profileApi, matchApi, ApiError } from "@/lib/api";
import { Portrait } from "@/components/ui/portrait";
import { LuxeButton } from "@/components/ui/luxe-button";
import { RevealText } from "@/components/ui/reveal-text";
import { useEntitlements } from "@/lib/useEntitlements";
import { UpgradeOverlay } from "@/components/ui/upgrade-lock";

/* ── Types ─────────────────────────────────────────────────────────── */

interface RemoteProfile {
  user_id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string | null;
  gender?: string | null;
  marital_status?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  religion?: string | null;
  caste?: string | null;
  sub_caste?: string | null;
  mother_tongue?: string | null;
  languages?: string[];
  height_cm?: number | null;
  education_level?: string | null;
  education_field?: string | null;
  college?: string | null;
  occupation?: string | null;
  employer?: string | null;
  annual_income_inr?: number | null;
  bio?: string | null;
  about_family?: string | null;
  photos?: Array<{ url?: string | null; key?: string; is_primary?: boolean; is_premium?: boolean; locked?: boolean }>;
  completeness_score?: number;
  is_manglik?: boolean | null;
  birth_time?: string | null;
  birth_place?: string | null;
  visa_status?: string | null;
  willing_to_relocate?: boolean;
  verification_status?: string;
  family_details?: Record<string, unknown>;
  partner_prefs?: Record<string, unknown>;
  kundali_data?: Record<string, unknown>;
}

/* ── Helpers ───────────────────────────────────────────────────────── */

function ageFromDob(dob?: string | null): number | undefined {
  if (!dob) return undefined;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return undefined;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

function cmToFeetInches(cm?: number | null): string | undefined {
  if (!cm) return undefined;
  const total = cm / 2.54;
  const feet = Math.floor(total / 12);
  const inches = Math.round(total % 12);
  return `${feet}'${inches}"`;
}

function lakhsFromInr(inr?: number | null): string | undefined {
  if (inr == null) return undefined;
  if (inr >= 10_000_000) return `₹${(inr / 10_000_000).toFixed(1)} Cr`;
  if (inr >= 100_000)    return `₹${(inr / 100_000).toFixed(1)} LPA`;
  return `₹${inr.toLocaleString("en-IN")}`;
}

function titleCase(s?: string | null): string | undefined {
  if (!s) return undefined;
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ── Page ──────────────────────────────────────────────────────────── */

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { entitlements, isLoading: entLoading } = useEntitlements();

  const [profile, setProfile] = useState<RemoteProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [interestSent, setInterestSent] = useState(false);
  const [interestPending, setInterestPending] = useState(false);
  const [interestError, setInterestError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await profileApi.getById(params.id);
      const data = (res.data as any)?.data ?? res.data;
      setProfile(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError({ status: err.status, message: err.message });
      } else {
        setError({ status: 0, message: err instanceof Error ? err.message : "Could not load profile" });
      }
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  const sendInterest = async () => {
    if (!profile || interestPending || interestSent) return;
    setInterestPending(true);
    setInterestError(null);
    try {
      await matchApi.sendInterest(profile.user_id);
      setInterestSent(true);
    } catch (err) {
      // 409: an interest already exists — treat as sent rather than an error.
      if (err instanceof ApiError && err.status === 409) {
        setInterestSent(true);
      } else if (err instanceof ApiError && err.status === 403) {
        // Basic plan quota exhausted — surface the server's message.
        setInterestError(
          err.message?.replace(/^\d+:\s*/, "") ||
            "You've reached your Basic plan limit — upgrade to Premium for unlimited expressions of interest.",
        );
      } else {
        setInterestError(
          err instanceof Error ? err.message : "Could not send interest. Please try again.",
        );
      }
    } finally {
      setInterestPending(false);
    }
  };

  /* ── Loading skeleton ──────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: "#fdfbf9" }}>
        <div className="mx-auto max-w-[1100px] px-6 py-6 lg:px-8 lg:py-8">
          <div className="m4m-skeleton mb-5 h-4 w-32" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
            <div className="m4m-skeleton aspect-[4/5] w-full rounded-3xl" />
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-3xl border border-rose-100/70 bg-white p-5">
                  <div className="m4m-skeleton mb-3 h-5 w-40" />
                  <div className="m4m-skeleton mb-2 h-3 w-full" />
                  <div className="m4m-skeleton h-3 w-3/4" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Error / not-found ─────────────────────────────────────────── */
  if (error || !profile) {
    return (
      <div className="min-h-screen" style={{ background: "#fdfbf9" }}>
        <div className="mx-auto flex max-w-[680px] flex-col items-center px-6 py-24 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
            <AlertCircle className="h-7 w-7 text-rose-700/70" />
          </div>
          <h1 className="font-display mt-4 text-[24px] font-semibold text-[#1a0a14]">
            {error?.status === 404 ? "Profile not found" : "We couldn't load this profile"}
          </h1>
          <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[#6a5560]">
            {error?.status === 404
              ? "This member's profile may have been removed or is not visible to you."
              : error?.message ?? "Please try again in a moment."}
          </p>
          <div className="mt-5 flex gap-2">
            <LuxeButton asChild variant="outline" size="md">
              <Link href="/matches">Back to browse</Link>
            </LuxeButton>
            {error?.status !== 404 && (
              <LuxeButton onClick={load} size="md">
                <Loader2 /> Retry
              </LuxeButton>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ── Derived display values ────────────────────────────────────── */
  const fullName  = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Member";
  const age       = ageFromDob(profile.date_of_birth);
  const height    = cmToFeetInches(profile.height_cm);
  const income    = lakhsFromInr(profile.annual_income_inr);
  const isVerified = profile.verification_status === "approved";

  // A photo is locked when the backend masks it from this viewer: either an
  // explicit `locked` flag, or a premium photo returned without a url.
  const isLockedPhoto = (p: { url?: string | null; is_premium?: boolean; locked?: boolean }) =>
    p.locked === true || (!!p.is_premium && !p.url);

  const allPhotos = profile.photos ?? [];
  // The hero/primary is always a main photo with a real url → always shown.
  const photoUrl  = allPhotos.find((p) => p.is_primary && p.url)?.url
        ?? allPhotos.find((p) => !p.is_premium && p.url)?.url
        ?? allPhotos.find((p) => p.url)?.url
        ?? null;
  // Remaining photos for the thumbnail strip — keep locked entries so we can
  // render a per-photo upgrade overlay rather than dropping them.
  const galleryItems = allPhotos
    .filter((p) => p.url !== photoUrl || isLockedPhoto(p))
    .map((p) => ({ url: p.url ?? null, locked: isLockedPhoto(p) }))
    .filter((g) => g.locked || !!g.url)
    .slice(0, 6);
  const lockedCount = galleryItems.filter((g) => g.locked).length;
  // Don't flash a lock to paid members while entitlements are still loading.
  const showUpgradeHint = !entLoading && !entitlements.canViewPremiumPhotos && lockedCount > 0;

  const educationLine = [profile.education_level, profile.education_field, profile.college]
    .filter(Boolean).join(" · ") || undefined;
  const careerLine = [profile.occupation, profile.employer]
    .filter(Boolean).join(" · ") || undefined;
  const religionLine = [titleCase(profile.religion), profile.caste, profile.sub_caste]
    .filter(Boolean).join(" · ") || undefined;
  const familyLine = profile.about_family || (profile.family_details && Object.keys(profile.family_details).length
      ? Object.entries(profile.family_details).map(([k, v]) => `${titleCase(k)}: ${String(v)}`).join(" · ")
      : undefined);

  const partnerLines: string[] = [];
  if (profile.partner_prefs) {
    const pp: any = profile.partner_prefs;
    if (pp.age_min || pp.age_max) partnerLines.push(`Age ${pp.age_min ?? "?"}–${pp.age_max ?? "?"}`);
    if (pp.religion) partnerLines.push(`Religion: ${pp.religion}`);
    if (pp.country)  partnerLines.push(`Country: ${pp.country}`);
    if (pp.education_level) partnerLines.push(`Education: ${pp.education_level}`);
    if (pp.occupation) partnerLines.push(`Profession: ${pp.occupation}`);
  }

  return (
    <div className="min-h-screen" style={{ background: "#fdfbf9" }}>
      <div className="mx-auto max-w-[1100px] px-6 py-6 lg:px-8 lg:py-8">

        <Link
          href="/matches"
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-rose-700/70 transition-colors hover:text-rose-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to browse
        </Link>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr] lg:items-start">

          {/* ── Left ─────────────────────────────────────────────── */}
          <aside className="fade-in-up flex flex-col gap-4 lg:sticky lg:top-[80px]">
            <div className="overflow-hidden rounded-3xl border border-rose-100/70 bg-white shadow-luxe">
              <ParallaxPortrait
                src={photoUrl}
                name={fullName}
                seed={profile.user_id}
                gender={profile.gender ?? undefined}
              >
                <div className="absolute right-3 top-3 z-[2] flex flex-col items-end gap-1.5">
                  {isVerified && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-rose-700 backdrop-blur"
                      style={{ boxShadow: "0 4px 14px rgba(0,0,0,0.10)" }}
                    >
                      <Shield className="h-3 w-3" /> Verified
                    </span>
                  )}
                  {profile.completeness_score !== undefined && profile.completeness_score >= 80 && (
                    <span
                      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur"
                      style={{
                        background: "linear-gradient(135deg,#C9954A,#8A5E20)",
                        boxShadow: "0 4px 14px rgba(201,149,74,0.32)",
                      }}
                    >
                      <Sparkles className="h-3 w-3" /> Complete
                    </span>
                  )}
                </div>
              </ParallaxPortrait>

              <div className="px-5 py-4">
                <h1 className="font-display text-[22px] font-semibold leading-tight text-[#1a0a14]">
                  <RevealText as="span" split="char" className="font-display">
                    {fullName}
                  </RevealText>
                  {age ? <span className="font-normal text-[#1a0a14]/85">, {age}</span> : null}
                </h1>
                {(profile.city || profile.state || profile.country) && (
                  <div className="mt-1 flex items-center gap-1 text-[13px] text-[#6a5560]">
                    <MapPin className="h-3.5 w-3.5" />
                    {[profile.city, profile.state, profile.country].filter(Boolean).join(", ")}
                  </div>
                )}

                {/* CTAs */}
                <div className="mt-5 space-y-2">
                  {interestSent ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-50 px-5 py-3 text-[14px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <Heart className="fill-emerald-700" /> Interest sent
                    </div>
                  ) : (
                    <LuxeButton
                      onClick={sendInterest}
                      loading={interestPending}
                      size="lg"
                      className="w-full"
                    >
                      <Heart className="fill-white" />
                      Send interest
                    </LuxeButton>
                  )}
                  <LuxeButton asChild variant="outline" size="lg" className="w-full">
                    <Link href="/messages">
                      <MessageCircle />
                      Send message
                    </Link>
                  </LuxeButton>
                </div>

                {interestError && (
                  <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50/70 px-3.5 py-2.5 text-[12px] leading-relaxed text-rose-800">
                    {interestError}
                    <Link
                      href="/subscription"
                      className="mt-1 inline-flex items-center gap-1 font-semibold text-rose-700 hover:text-rose-800"
                    >
                      View plans <Sparkles className="h-3 w-3" />
                    </Link>
                  </div>
                )}

                <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#6a5560]">
                  <Lock className="h-3 w-3" />
                  Contact details are revealed only after mutual consent.
                </p>
              </div>
            </div>

            {/* Thumbnail strip — main photos render normally; premium photos
                the viewer can't see render a per-photo upgrade overlay. */}
            {galleryItems.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {galleryItems.map((g, i) =>
                    g.locked ? (
                      <div
                        key={i}
                        className="relative aspect-square overflow-hidden rounded-2xl border border-rose-100/70"
                        style={{ background: "linear-gradient(135deg, rgba(220,30,60,0.10), rgba(220,30,60,0.04))" }}
                      >
                        <UpgradeOverlay label="Premium" message="Upgrade to view premium photos" />
                      </div>
                    ) : (
                      <Portrait
                        key={i}
                        src={g.url ?? undefined}
                        name={fullName}
                        seed={`${profile.user_id}-${i}`}
                        rounded="card"
                        className="aspect-square w-full border border-rose-100/70"
                      />
                    )
                  )}
                </div>
                {showUpgradeHint && (
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-rose-700/80">
                    <Lock className="h-3 w-3" />
                    {lockedCount} premium photo{lockedCount === 1 ? "" : "s"} — upgrade to view
                  </p>
                )}
              </>
            )}
          </aside>

          {/* ── Right ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-4">

            {profile.bio ? (
              <Section title="About" icon={<Sparkles className="h-4 w-4 text-rose-700" />} delay={60}>
                <p className="text-[14px] leading-[1.75] text-[#1a0a14]/75">{profile.bio}</p>
              </Section>
            ) : null}

            <Section title="Basic information" icon={<Star className="h-4 w-4 text-amber-700" />} delay={120}>
              <div className="grid grid-cols-1 gap-y-3.5 sm:grid-cols-2">
                {educationLine && <InfoRow icon={<GraduationCap className="h-3.5 w-3.5" />} label="Education" value={educationLine} />}
                {careerLine    && <InfoRow icon={<Briefcase     className="h-3.5 w-3.5" />} label="Career"    value={careerLine}    />}
                {height        && <InfoRow icon={<Ruler         className="h-3.5 w-3.5" />} label="Height"    value={height}        />}
                {(profile.languages?.length || profile.mother_tongue) && (
                  <InfoRow
                    icon={<Globe className="h-3.5 w-3.5" />}
                    label="Languages"
                    value={(profile.languages?.length ? profile.languages.join(", ") : profile.mother_tongue) || ""}
                  />
                )}
                {religionLine && <InfoRow icon={<Star      className="h-3.5 w-3.5" />} label="Community"      value={religionLine} />}
                {profile.marital_status && (
                  <InfoRow icon={<Heart  className="h-3.5 w-3.5" />} label="Marital status" value={titleCase(profile.marital_status) || ""} />
                )}
                {profile.willing_to_relocate !== undefined && (
                  <InfoRow icon={<Globe className="h-3.5 w-3.5" />} label="Open to relocation" value={profile.willing_to_relocate ? "Yes" : "No"} />
                )}
                {profile.visa_status && <InfoRow icon={<Globe    className="h-3.5 w-3.5" />} label="Visa status" value={profile.visa_status}             />}
                {income           && <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Annual income" value={income}                       />}
                {profile.is_manglik !== null && profile.is_manglik !== undefined && (
                  <InfoRow icon={<Star className="h-3.5 w-3.5" />} label="Manglik" value={profile.is_manglik ? "Yes" : "No"} />
                )}
              </div>
            </Section>

            {familyLine && (
              <Section title="Family" icon={<Users className="h-4 w-4 text-rose-700" />} delay={180}>
                <p className="text-[14px] leading-[1.75] text-[#1a0a14]/75">{familyLine}</p>
              </Section>
            )}

            {(profile.birth_time || profile.birth_place) && (
              <Section title="Astrological" icon={<Sparkles className="h-4 w-4 text-amber-700" />} delay={220}>
                <div className="grid grid-cols-1 gap-y-3.5 sm:grid-cols-2">
                  {profile.birth_time  && <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Birth time"  value={profile.birth_time}  />}
                  {profile.birth_place && <InfoRow icon={<MapPin   className="h-3.5 w-3.5" />} label="Birth place" value={profile.birth_place} />}
                </div>
              </Section>
            )}

            {partnerLines.length > 0 && (
              <Section title="Partner preferences" icon={<Heart className="h-4 w-4 text-rose-700" />} delay={260}>
                <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {partnerLines.map((line, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13.5px] text-[#1a0a14]/75">
                      <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                      {line}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Parallax portrait wrapper — gentle scroll-driven shift on the photo ── */

function ParallaxPortrait({
  src, name, seed, gender, children,
}: {
  src?: string | null;
  name?: string;
  seed?: string;
  gender?: string;
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  // Subtle parallax: photo translates 24px slower than scroll, with a tiny scale.
  const y     = useTransform(scrollYProgress, [0, 1], [-24, 24]);
  const scale = useTransform(scrollYProgress, [0, 0.5, 1], [1.03, 1.0, 1.04]);

  return (
    <div ref={ref} className="relative overflow-hidden">
      <motion.div
        style={reduced ? undefined : { y, scale, willChange: "transform" }}
        className="absolute inset-0"
      >
        <Portrait
          src={src}
          name={name}
          seed={seed}
          gender={gender}
          rounded="none"
          className="aspect-[4/5] w-full"
        />
      </motion.div>
      {/* Spacer to keep aspect ratio while photo is positioned absolutely */}
      <div className="pointer-events-none aspect-[4/5] w-full" />
      {children}
    </div>
  );
}

/* ── Section card ──────────────────────────────────────────────────── */

function Section({
  title, icon, children, delay = 0, caption,
}: {
  title: string; icon: React.ReactNode; children: React.ReactNode;
  delay?: number; caption?: string;
}) {
  return (
    <section
      className="fade-in-up rounded-3xl border border-rose-100/70 bg-white p-5 shadow-[0_2px_14px_rgba(220,30,60,0.05)]"
      style={{ animationDelay: `${delay}ms` }}
    >
      <header className="mb-3.5 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-[17px] font-semibold text-[#1a0a14]">{title}</h2>
      </header>
      {children}
      {caption && (
        <p className="mt-3 text-[11px] italic text-[#6a5560]">{caption}</p>
      )}
    </section>
  );
}

/* ── Info row ──────────────────────────────────────────────────────── */

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1 flex-shrink-0 text-rose-700/40">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-rose-700/60">
          {label}
        </p>
        <p className="mt-0.5 text-[13.5px] font-medium text-[#1a0a14]/85">
          {value}
        </p>
      </div>
    </div>
  );
}
