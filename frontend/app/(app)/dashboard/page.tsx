"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  motion, useReducedMotion, useInView, useMotionValue,
  useTransform, animate, type Variants,
} from "framer-motion";
import {
  Shield, Heart, Clock, Sparkles, Search, ArrowRight, AlertCircle,
  Check, Plus, Crown, Compass, RotateCw, SlidersHorizontal,
} from "lucide-react";
import { matchApi, profileApi, api, ApiError } from "@/lib/api";
import { ApprovalGate } from "@/components/ApprovalGate";
import { ProfileCard, type ProfileCardData } from "@/components/ui/profile-card";
import { LuxeButton } from "@/components/ui/luxe-button";
import { RevealText } from "@/components/ui/reveal-text";

/* ── Helpers ────────────────────────────────────────────────────────── */

const EASE = [0.22, 1, 0.36, 1] as const;
const MotionLink = motion(Link);

/* Count-up number that animates once it scrolls into view. */
function CountUp({
  to, suffix = "", duration = 1.1, className,
}: { to: number; suffix?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const reduce = useReducedMotion();
  const count = useMotionValue(0);
  const text = useTransform(count, (v) => `${Math.round(v)}${suffix}`);
  useEffect(() => {
    if (reduce) { count.set(to); return; }
    if (!inView) return;
    const controls = animate(count, to, { duration, ease: EASE });
    return controls.stop;
  }, [inView, to, reduce, duration, count]);
  return <motion.span ref={ref} className={className}>{text}</motion.span>;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function titleCase(v: string): string {
  return v ? v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, " ") : "";
}

type FeedCard = ProfileCardData & { tier: "preferred" | "broader"; interestSent: boolean };

/** Map a MatchRead (with `other_profile` card) from /matches/daily. */
function mapMatch(m: any, idx: number): FeedCard | null {
  const p = m?.other_profile;
  if (!p?.user_id) return null; // never render a card we can't link to a real member
  const relaxed: string[] = Array.isArray(m.relaxed_on) ? m.relaxed_on : [];
  const tier = m.match_tier === "broader" ? "broader" : "preferred";
  return {
    id: String(p.user_id),
    name: (p.first_name || "Member").trim(),
    age: p.age ?? 0,
    city: p.city || "",
    state: p.state || "",
    profession: p.occupation || "",
    education: p.education_level || "",
    religion: titleCase(p.religion || ""),
    verified: p.is_verified ?? false,
    compatibility: Math.round(Number(m.compatibility_score) || 0),
    photoUrl: p.primary_photo_url || null,
    reasons: Array.isArray(m.reasons) ? m.reasons : [],
    note: tier === "broader" && relaxed.length
      ? `Outside your ${relaxed.join(", ")} preference`
      : undefined,
    ribbon: tier === "preferred" && idx === 0 ? "Top match" : undefined,
    tier,
    interestSent: Boolean(m.interest_sent),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/* ── Page ───────────────────────────────────────────────────────────── */

interface CompletionInfo {
  score: number;
  status: string;
  missing: Array<{ key: string; label: string; tab: string }>;
  badges: Record<"email" | "phone" | "photo" | "id", "verified" | "pending" | "locked">;
}

export default function DashboardPage() {
  return (
    <ApprovalGate feature="view your matches">
      <DashboardContent />
    </ApprovalGate>
  );
}

function DashboardContent() {
  const [interests, setInterests] = useState<Record<string, "sent" | "passed">>({});
  const [matches, setMatches] = useState<FeedCard[]>([]);
  const [feedMeta, setFeedMeta] = useState<{
    hasPreferences: boolean; candidates: number; emptyReason: string | null;
  }>({ hasPreferences: true, candidates: 0, emptyReason: null });
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);
  const [membershipNumber, setMembershipNumber] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interestError, setInterestError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const sessionSent = useRef<Set<string>>(new Set());

  const reduce = useReducedMotion();
  const fadeUp: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 22 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };
  const stagger: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
  };
  const reveal = {
    variants: fadeUp,
    initial: "hidden" as const,
    whileInView: "show" as const,
    viewport: { once: true, margin: "-40px" },
  };
  const hoverLift = reduce ? undefined : { y: -4, transition: { type: "spring" as const, stiffness: 300, damping: 22 } };

  useEffect(() => {
    async function load() {
      setLoading(true); setError(null);
      try {
        const [matchRes, completionRes, meRes, limitsRes] = await Promise.allSettled([
          matchApi.getDailyMatches(),
          profileApi.getCompletion(),
          api.get("/api/v1/auth/me"),
          api.get("/api/v1/subscriptions/limits"),
        ]);

        if (meRes.status === "fulfilled") {
          const d = (meRes.value.data as any)?.data ?? meRes.value.data;
          setMembershipNumber(d?.membership_number ?? null);
        }

        if (limitsRes.status === "fulfilled") {
          const d = (limitsRes.value.data as any)?.data ?? limitsRes.value.data;
          if (d?.plan) setPlan(String(d.plan).toLowerCase());
        }

        // Backend envelope: APIResponse{success, data: T} for singular,
        // PaginatedResponse{success, data: T[], ...} for paginated.
        // `*.value.data` is the whole envelope, so the payload is at `.data.data`.
        if (matchRes.status === "fulfilled") {
          const payload = (matchRes.value.data as any)?.data;
          const list: any[] = payload?.matches ?? [];
          const cards = list
            .map((m, i) => mapMatch(m, i))
            .filter((c): c is FeedCard => c !== null);
          setMatches(cards);
          setFeedMeta({
            hasPreferences: payload?.has_preferences ?? true,
            candidates: payload?.candidates_considered ?? 0,
            emptyReason: payload?.empty_reason ?? null,
          });
          // Hearts reflect interests already sent in earlier sessions.
          setInterests((prev) => {
            const next = { ...prev };
            cards.forEach((c) => { if (c.interestSent) next[c.id] = "sent"; });
            return next;
          });
        } else {
          setError("We couldn't load your matches right now. Please try again in a moment.");
        }

        if (completionRes.status === "fulfilled") {
          const d = (completionRes.value.data as any)?.data ?? completionRes.value.data;
          if (d && typeof d.score === "number") setCompletion(d as CompletionInfo);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [reloadKey]);

  const sendInterest = async (id: string) => {
    if (interests[id] === "sent") return; // already expressed — hearts are one-way here
    sessionSent.current.add(id);
    setInterests((p) => ({ ...p, [id]: "sent" }));
    setInterestError(null);
    try {
      await matchApi.sendInterest(id);
    } catch (err) {
      // 409: already sent. Leave the optimistic "sent" badge in place
      // because that's the truthful state on the backend. Any other
      // failure rolls back so the user can retry.
      if (err instanceof ApiError && err.status === 409) return;
      sessionSent.current.delete(id);
      setInterests((p) => { const n = { ...p }; delete n[id]; return n; });
      if (err instanceof ApiError && err.status === 403) {
        // Basic plan quota exhausted — surface the server's message.
        setInterestError(
          err.message?.replace(/^\d+:\s*/, "") ||
            "You've reached your Basic plan limit — upgrade to Premium for unlimited expressions of interest.",
        );
      }
    }
  };

  const preferred = matches.filter((m) => m.tier === "preferred");
  const broader = matches.filter((m) => m.tier === "broader");
  // Strip only lists interests sent in THIS visit (earlier ones show as filled hearts).
  const sent = matches.filter((m) => interests[m.id] === "sent" && sessionSent.current.has(m.id));
  const completionScore = completion?.score ?? 0;

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)" }}
    >
      {/* Ambient backdrop — matches the Subscription page */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="m4m-dash-aurora m4m-dash-aurora-rose" />
        <span className="m4m-dash-aurora m4m-dash-aurora-gold" />
        <span className="m4m-dash-aurora m4m-dash-aurora-plum" />
        <span className="m4m-dash-dots" />
        <span className="m4m-dash-vignette" />
      </div>

      <div className="relative mx-auto max-w-[1200px] px-6 py-8 lg:px-8 lg:py-10">

        {/* ── Hero strip ─────────────────────────────────────────────── */}
        <motion.section
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center"
        >
          <motion.div variants={fadeUp}>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-[#f3c9a8]">
              Welcome back
            </p>
            <h1 className="font-display text-[34px] font-semibold leading-tight text-white sm:text-[40px]">
              <RevealText as="span" split="word" className="font-display">
                Your curated matches
              </RevealText>
            </h1>
            {membershipNumber && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] backdrop-blur-sm">
                <span className="uppercase text-[#f3c9a8]/70">Member</span>
                <span className="font-mono tabular-nums text-white">{membershipNumber}</span>
              </div>
            )}
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-white/55">
              {loading ? (
                "Finding members who match your profile and partner preferences…"
              ) : matches.length === 0 ? (
                "We'll show your best matches here as soon as compatible members are approved."
              ) : (
                <>
                  <CountUp to={matches.length} className="font-semibold text-white" />{" "}
                  verified {matches.length === 1 ? "member" : "members"} ranked by compatibility with your profile and partner preferences.
                </>
              )}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.05] px-3 py-1 text-white/70 ring-1 ring-white/10">
                <Clock className="h-3.5 w-3.5 text-[#f3c9a8]" />
                Updates as new members are approved
              </span>
              <Link
                href="/matches"
                className="inline-flex items-center gap-1 text-[#f3c9a8] transition-colors hover:text-white"
              >
                Browse all profiles <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </motion.div>

          {/* Profile strength card */}
          <motion.div
            variants={fadeUp}
            whileHover={hoverLift}
            className="relative flex items-center gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
            style={{ minWidth: 300 }}
          >
            <div className="flex flex-col gap-1.5">
              {/* The pill must reflect the member's actual verification state —
                  showing "Verified member" to every viewer contradicted the
                  global "Complete your profile & verify your ID" banner that
                  appears on the same screen for unverified members. */}
              {completion?.badges?.id === "verified" ? (
                <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/25">
                  <Shield className="h-3 w-3" /> Verified member
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-300/12 px-2 py-0.5 text-[10px] font-semibold text-amber-100 ring-1 ring-amber-300/25">
                  <Shield className="h-3 w-3" /> Verification pending
                </div>
              )}
              <p className="font-display text-[15px] text-white">
                A complete profile gets noticed
              </p>
              <p className="text-[12px] leading-snug text-white/55">
                Members with full profiles and photos receive far more interest.
              </p>
              <Link
                href="/profile/me"
                className="mt-1 inline-flex items-center gap-1 self-start text-[12px] font-semibold text-[#f3c9a8] hover:text-white"
              >
                Complete your profile <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </motion.div>
        </motion.section>

        {/* ── Membership / upgrade ───────────────────────────────────── */}
        {(() => {
          // Tier → plan name, matching the DB pricing_plans members pay against
          // (config.py): silver=Basic, gold=Premium, platinum=Elite. "free" = no
          // active subscription. (An earlier off-by-one map labelled gold
          // "Elite", so a Premium member's dashboard + plan panel read "Elite".)
          const PLAN_LABEL: Record<string, string> = {
            free: "Basic", silver: "Basic", gold: "Premium", platinum: "Elite",
          };
          const label = PLAN_LABEL[plan] ?? "Basic";
          const isTopTier = plan === "platinum";
          return (
            <motion.section
              {...reveal}
              whileHover={hoverLift}
              className="mt-7 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
            >
              <div className="flex items-center gap-4 min-w-[240px]">
                <motion.span
                  initial={reduce ? false : { rotate: -12, scale: 0.8, opacity: 0 }}
                  whileInView={{ rotate: 0, scale: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dc1e3c]/15 text-[#ff8aa3] ring-1 ring-[#dc1e3c]/30"
                >
                  <Crown className="h-5 w-5" />
                </motion.span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#f3c9a8]/70">
                    Your membership
                  </p>
                  <p className="font-display text-[20px] font-semibold text-white leading-tight">
                    {label} plan
                  </p>
                </div>
              </div>

              {isTopTier ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/12 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 ring-1 ring-emerald-400/25">
                  <Check className="h-3.5 w-3.5" /> You're on our highest tier
                </span>
              ) : (
                <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
                  <p className="text-[13px] leading-snug text-white/55 max-w-sm">
                    {plan === "free"
                      ? "Unlock direct messaging, contact access and priority introductions."
                      : "Upgrade for more contacts, priority placement and concierge support."}
                  </p>
                  <MotionLink
                    href="/subscription"
                    whileHover={hoverLift}
                    whileTap={reduce ? undefined : { scale: 0.97 }}
                    className="group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_10px_28px_-6px_rgba(220,30,60,0.6)] transition-all hover:shadow-[0_14px_34px_-6px_rgba(220,30,60,0.75)]"
                    style={{ background: "linear-gradient(135deg, #dc1e3c, #a0153c)" }}
                  >
                    {plan === "free" ? "Upgrade your plan" : "See higher tiers"}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </MotionLink>
                </div>
              )}
            </motion.section>
          );
        })()}

        {/* ── Profile completeness ───────────────────────────────────── */}
        <motion.section
          {...reveal}
          className="mt-7 flex flex-wrap items-center gap-5 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
        >
          <div className="flex-1 min-w-[260px]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-white">
                Profile completeness · <CountUp to={completionScore} suffix="%" className="font-display text-[#f3c9a8]" />
              </span>
              {completionScore < 100 && (
                <span className="text-[11px] font-medium text-amber-200/90">
                  +{100 - completionScore} pts to unlock all introductions
                </span>
              )}
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: "linear-gradient(90deg,#dc1e3c 0%,#C9954A 100%)",
                  boxShadow: "0 0 14px rgba(220,30,60,0.45)",
                }}
                initial={{ width: 0 }}
                whileInView={{ width: `${completionScore}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, ease: EASE, delay: 0.1 }}
              />
            </div>
            {completion && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {/* Real verification badges */}
                {(["email","phone","photo","id"] as const).map((k) => {
                  const state = completion.badges[k];
                  const label = k === "id" ? "ID verified" : k === "phone" ? "Phone verified" : k === "email" ? "Email verified" : "Photos uploaded";
                  if (state === "verified") {
                    return (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2.5 py-1 text-[11px] font-medium text-emerald-200 ring-1 ring-emerald-400/25">
                        <Check className="h-3 w-3" strokeWidth={2.4} /> {label}
                      </span>
                    );
                  }
                  if (state === "pending") {
                    return (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-amber-300/12 px-2.5 py-1 text-[11px] font-medium text-amber-100 ring-1 ring-amber-300/25">
                        <Clock className="h-3 w-3" strokeWidth={2} /> {label} · pending
                      </span>
                    );
                  }
                  return (
                    <span key={k} className="inline-flex items-center gap-1 rounded-full bg-[#dc1e3c]/12 px-2.5 py-1 text-[11px] font-medium text-rose-200 ring-1 ring-[#dc1e3c]/25">
                      <Plus className="h-3 w-3" strokeWidth={2.4} /> {label}
                    </span>
                  );
                })}
                {/* Missing field hints (top 3) */}
                {completion.missing.slice(0, 3).map((m) => (
                  <span key={m.key} className="inline-flex items-center gap-1 rounded-full bg-[#dc1e3c]/12 px-2.5 py-1 text-[11px] font-medium text-rose-200 ring-1 ring-[#dc1e3c]/25">
                    <Plus className="h-3 w-3" strokeWidth={2.4} /> {m.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <LuxeButton asChild size="md" className="shrink-0">
            <Link href="/profile/me">
              Complete profile <ArrowRight />
            </Link>
          </LuxeButton>
        </motion.section>

        {/* ── Interest quota notice ──────────────────────────────────── */}
        {interestError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-[13px] text-rose-100 backdrop-blur-sm"
          >
            <span className="flex items-center gap-2">
              <Heart className="h-4 w-4 flex-shrink-0 text-[#ff8aa3]" />
              {interestError}
            </span>
            <Link
              href="/subscription"
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(220,30,60,0.35)]"
            >
              Upgrade to Premium <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}

        {/* ── Sent interest strip ────────────────────────────────────── */}
        {sent.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex items-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-[13px] text-emerald-100 backdrop-blur-sm"
          >
            <Heart className="h-4 w-4 fill-emerald-300 text-emerald-300" />
            <span>
              Interest sent to <strong className="text-white">{sent.map((m) => m.name.split(" ")[0]).join(", ")}</strong> · awaiting response
            </span>
          </motion.div>
        )}

        {/* ── Section heading ────────────────────────────────────────── */}
        <motion.div {...reveal} className="mt-10 mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f3c9a8]">
              <Sparkles className="mr-1 inline h-3 w-3" /> My matches
            </p>
            <h2 className="font-display mt-1 text-[24px] font-semibold text-white">
              Matched to your preferences
            </h2>
            {!loading && preferred.length > 0 && (
              <p className="mt-1 text-[13px] text-white/50">
                {preferred.length} {preferred.length === 1 ? "member meets" : "members meet"} every preference you've set, best match first.
              </p>
            )}
          </div>
          <Link
            href="/matches"
            className="hidden items-center gap-1 text-[13px] font-semibold text-[#f3c9a8] transition-colors hover:text-white sm:inline-flex"
          >
            Browse all profiles <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>

        {/* ── Partner-preference nudge ───────────────────────────────── */}
        {!loading && !error && matches.length > 0 && !feedMeta.hasPreferences && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#C9954A]/25 bg-[#C9954A]/10 px-4 py-3 text-[13px] text-[#f3c9a8]">
            <span className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 flex-shrink-0" />
              You haven't set partner preferences yet, so these are ranked on your profile alone.
            </span>
            <Link
              href="/profile/me"
              className="inline-flex items-center gap-1 font-semibold text-white transition-colors hover:text-[#f3c9a8]"
            >
              Set preferences <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* ── Loading skeletons ──────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04]"
              >
                <div className="h-[260px] animate-pulse bg-white/[0.06]" />
                <div className="p-4">
                  <div className="mb-2 h-4 w-2/3 animate-pulse rounded bg-white/10" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-white/[0.07]" />
                  <div className="mt-3 flex gap-1.5">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-white/[0.07]" />
                    <div className="h-5 w-20 animate-pulse rounded-full bg-white/[0.07]" />
                  </div>
                </div>
                <div className="space-y-1.5 border-t border-white/[0.06] px-4 pb-4 pt-3">
                  <div className="h-2.5 w-20 animate-pulse rounded bg-white/[0.07]" />
                  <div className="h-3 w-4/5 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-3/5 animate-pulse rounded bg-white/[0.06]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={<AlertCircle className="h-7 w-7 text-rose-300/70" />}
            title="We couldn't load your matches"
            body={error}
            action={
              <LuxeButton size="md" onClick={() => setReloadKey((k) => k + 1)}>
                <RotateCw /> Try again
              </LuxeButton>
            }
          />
        )}

        {/* ── Match grids ────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {matches.length === 0 ? (
              <EmptyState
                icon={<Heart className="h-7 w-7 text-[#ff8aa3]/70" />}
                title={feedMeta.emptyReason === "no_profile" ? "Complete your profile to see matches" : "No matches just yet"}
                body={
                  feedMeta.emptyReason === "no_profile"
                    ? "We match members on their profile and partner preferences. Finish yours and we'll start ranking compatible members for you."
                    : "There are no approved members to match with you yet. New members appear here the moment our team approves them, and our advisors can also hand-pick introductions."
                }
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <LuxeButton asChild size="md" variant="outline">
                      <Link href="/profile/me">Review partner preferences</Link>
                    </LuxeButton>
                    <LuxeButton asChild size="md">
                      <Link href="/matches">
                        <Search /> Browse all profiles
                      </Link>
                    </LuxeButton>
                  </div>
                }
              />
            ) : (
              <>
                {preferred.length > 0 && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {preferred.map((m, i) => (
                      <ProfileCard
                        key={m.id}
                        data={m}
                        index={i}
                        liked={interests[m.id] === "sent"}
                        onToggleLike={() => sendInterest(m.id)}
                      />
                    ))}
                  </div>
                )}

                {broader.length > 0 && (
                  <section className={preferred.length > 0 ? "mt-12" : ""} aria-labelledby="broader-heading">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-t border-white/[0.08] pt-6">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f3c9a8]/80">
                          <Compass className="mr-1 inline h-3 w-3" /> Broader matches
                        </p>
                        <h3 id="broader-heading" className="font-display mt-1 text-[20px] font-semibold text-white">
                          {preferred.length === 0 ? "Close to what you're looking for" : "Worth a second look"}
                        </h3>
                        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-white/50">
                          {preferred.length === 0
                            ? "No one meets every preference you've set yet, so here are the closest members. Each card shows where they differ."
                            : "These members fall slightly outside one of your preferences but score well on everything else."}
                        </p>
                      </div>
                      <Link
                        href="/profile/me"
                        className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#f3c9a8] transition-colors hover:text-white"
                      >
                        Adjust preferences <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                      {broader.map((m, i) => (
                        <ProfileCard
                          key={m.id}
                          data={m}
                          index={i}
                          liked={interests[m.id] === "sent"}
                          onToggleLike={() => sendInterest(m.id)}
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .m4m-dash-aurora { position: absolute; border-radius: 50%; filter: blur(120px); pointer-events: none; will-change: transform; }
        .m4m-dash-aurora-rose { width: 540px; height: 540px; top: -150px; right: -120px; background: radial-gradient(circle, rgba(220,30,60,0.5), transparent 60%); opacity: 0.5; animation: m4mDashRose 28s ease-in-out infinite alternate; }
        .m4m-dash-aurora-gold { width: 560px; height: 560px; bottom: -190px; left: -150px; background: radial-gradient(circle, rgba(201,149,74,0.4), transparent 60%); opacity: 0.42; animation: m4mDashGold 34s ease-in-out infinite alternate; }
        .m4m-dash-aurora-plum { width: 380px; height: 380px; top: 42%; right: 28%; background: radial-gradient(circle, rgba(124,58,137,0.4), transparent 60%); opacity: 0.26; animation: m4mDashPlum 30s ease-in-out infinite alternate; }
        @keyframes m4mDashRose { from { transform: translate(0,0) scale(1); } to { transform: translate(-90px,70px) scale(1.12); } }
        @keyframes m4mDashGold { from { transform: translate(0,0) scale(1); } to { transform: translate(90px,-60px) scale(0.92); } }
        @keyframes m4mDashPlum { from { transform: translate(0,0) scale(1); } to { transform: translate(-60px,60px) scale(1.1); } }
        .m4m-dash-dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px); background-size: 30px 30px; opacity: 0.06; -webkit-mask-image: radial-gradient(ellipse at 50% 0%, black 5%, transparent 70%); mask-image: radial-gradient(ellipse at 50% 0%, black 5%, transparent 70%); }
        .m4m-dash-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%); }
        @media (prefers-reduced-motion: reduce) {
          .m4m-dash-aurora-rose, .m4m-dash-aurora-gold, .m4m-dash-aurora-plum { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */

function EmptyState({
  icon, title, body, action,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center backdrop-blur-sm">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] ring-1 ring-white/10">
        {icon}
      </div>
      <h3 className="font-display text-[20px] font-semibold text-white">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
