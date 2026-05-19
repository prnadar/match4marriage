"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Shield, Heart, Clock, Sparkles, Search, ArrowRight, AlertCircle,
  Check, Plus, Crown,
} from "lucide-react";
import { matchApi, profileApi, api, ApiError } from "@/lib/api";
import { ProfileCard, type ProfileCardData } from "@/components/ui/profile-card";
import { LuxeButton } from "@/components/ui/luxe-button";
import { RevealText } from "@/components/ui/reveal-text";

/* ── Helpers ────────────────────────────────────────────────────────── */

function cmToFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
}

const RIBBONS = ["Top Match", "Great Match", "Featured"];

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapMatch(p: any, idx: number): ProfileCardData {
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
    ribbon: idx < RIBBONS.length ? RIBBONS[idx] : undefined,
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
  const [interests, setInterests] = useState<Record<string, "sent" | "passed">>({});
  const [matches, setMatches] = useState<ProfileCardData[]>([]);
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);
  const [membershipNumber, setMembershipNumber] = useState<string | null>(null);
  const [plan, setPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          const list: any[] = payload?.matches ?? (Array.isArray(payload) ? payload : []);
          setMatches(list.map(mapMatch));
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
  }, []);

  const sendInterest = async (id: string) => {
    setInterests((p) => ({ ...p, [id]: "sent" }));
    try {
      await matchApi.sendInterest(id);
    } catch (err) {
      // 409: already sent. Leave the optimistic "sent" badge in place
      // because that's the truthful state on the backend. Any other
      // failure rolls back so the user can retry.
      if (err instanceof ApiError && err.status === 409) return;
      setInterests((p) => { const n = { ...p }; delete n[id]; return n; });
    }
  };

  const active = matches.filter((m) => !interests[m.id]);
  const sent = matches.filter((m) => interests[m.id] === "sent");
  const completionScore = completion?.score ?? 0;

  return (
    <div className="min-h-screen" style={{ background: "#fdfbf9" }}>
      <div className="mx-auto max-w-[1200px] px-6 py-8 lg:px-8 lg:py-10">

        {/* ── Hero strip ─────────────────────────────────────────────── */}
        <section className="fade-in-up grid grid-cols-1 gap-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="mb-1.5 text-[12px] font-semibold uppercase tracking-[0.2em] text-rose-700/80">
              Welcome back
            </p>
            <h1 className="font-display text-[34px] font-semibold leading-tight text-[#1a0a14] sm:text-[40px]">
              <RevealText as="span" split="word" className="font-display">
                Your curated matches
              </RevealText>
            </h1>
            {membershipNumber && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-rose-100 bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-rose-700 shadow-[0_2px_8px_rgba(220,30,60,0.05)]">
                <span className="text-rose-700/60 uppercase">Member</span>
                <span className="font-mono tabular-nums text-[#1a0a14]">{membershipNumber}</span>
              </div>
            )}
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#6a5560]">
              {loading
                ? "Loading the introductions our advisors selected for you today…"
                : `${matches.length} hand-picked introductions for you, refreshed daily by our team.`}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 ring-1 ring-rose-100 text-rose-700/80">
                <Clock className="h-3.5 w-3.5" />
                Refreshes 6:00 AM IST
              </span>
              <Link
                href="/matches"
                className="inline-flex items-center gap-1 text-rose-700 transition-colors hover:text-rose-800"
              >
                Browse all profiles <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>

          {/* Profile strength card */}
          <div
            className="relative flex items-center gap-5 rounded-3xl border border-rose-100/70 bg-white p-5 shadow-[0_2px_18px_rgba(220,30,60,0.06)]"
            style={{ minWidth: 300 }}
          >
            <div className="flex flex-col gap-1.5">
              <div className="inline-flex items-center gap-1.5 self-start rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                <Shield className="h-3 w-3" /> Verified member
              </div>
              <p className="font-display text-[15px] text-[#1a0a14]">
                A complete profile gets noticed
              </p>
              <p className="text-[12px] leading-snug text-[#6a5560]">
                Members with full profiles and photos receive far more interest.
              </p>
              <Link
                href="/profile/me"
                className="mt-1 inline-flex items-center gap-1 self-start text-[12px] font-semibold text-rose-700 hover:text-rose-800"
              >
                Complete your profile <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Membership / upgrade ───────────────────────────────────── */}
        {(() => {
          const PLAN_LABEL: Record<string, string> = {
            free: "Free", silver: "Basic", gold: "Premium", platinum: "Elite",
          };
          const label = PLAN_LABEL[plan] ?? "Free";
          const isTopTier = plan === "platinum";
          return (
            <section
              className="fade-in-up mt-7 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-rose-100/70 bg-gradient-to-br from-white to-rose-50/40 p-5 shadow-[0_2px_14px_rgba(220,30,60,0.05)]"
              style={{ animationDelay: "40ms" }}
            >
              <div className="flex items-center gap-4 min-w-[240px]">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                  <Crown className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-700/70">
                    Your membership
                  </p>
                  <p className="font-display text-[20px] font-semibold text-[#1a0a14] leading-tight">
                    {label} plan
                  </p>
                </div>
              </div>

              {isTopTier ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
                  <Check className="h-3.5 w-3.5" /> You're on our highest tier
                </span>
              ) : (
                <div className="flex flex-1 flex-wrap items-center justify-end gap-4">
                  <p className="text-[13px] leading-snug text-[#6a5560] max-w-sm">
                    {plan === "free"
                      ? "Unlock direct messaging, contact access and priority introductions."
                      : "Upgrade for more contacts, priority placement and concierge support."}
                  </p>
                  <Link
                    href="/subscription"
                    className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-[13.5px] font-semibold text-white shadow-[0_6px_18px_rgba(220,30,60,0.32)] transition-all hover:shadow-[0_12px_28px_rgba(220,30,60,0.42)]"
                    style={{ background: "linear-gradient(135deg, #dc1e3c, #a0153c)" }}
                  >
                    {plan === "free" ? "Upgrade your plan" : "See higher tiers"}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              )}
            </section>
          );
        })()}

        {/* ── Profile completeness ───────────────────────────────────── */}
        <section
          className="fade-in-up mt-7 flex flex-wrap items-center gap-5 rounded-2xl border border-rose-100/70 bg-white p-5 shadow-[0_2px_14px_rgba(220,30,60,0.05)]"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex-1 min-w-[260px]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold text-[#1a0a14]">
                Profile completeness · <span className="font-display">{completionScore}%</span>
              </span>
              {completionScore < 100 && (
                <span className="text-[11px] font-medium text-amber-700">
                  +{100 - completionScore} pts to unlock all introductions
                </span>
              )}
            </div>
            <div className="relative h-2 overflow-hidden rounded-full bg-rose-100/60">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${completionScore}%`,
                  background: "linear-gradient(90deg,#dc1e3c 0%,#C9954A 100%)",
                  boxShadow: "0 0 14px rgba(220,30,60,0.35)",
                }}
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
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-100">
                        <Check className="h-3 w-3" strokeWidth={2.4} /> {label}
                      </span>
                    );
                  }
                  if (state === "pending") {
                    return (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-100">
                        <Clock className="h-3 w-3" strokeWidth={2} /> {label} · pending
                      </span>
                    );
                  }
                  return (
                    <span key={k} className="inline-flex items-center gap-1 rounded-full bg-rose-50/70 px-2.5 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-rose-100">
                      <Plus className="h-3 w-3" strokeWidth={2.4} /> {label}
                    </span>
                  );
                })}
                {/* Missing field hints (top 3) */}
                {completion.missing.slice(0, 3).map((m) => (
                  <span key={m.key} className="inline-flex items-center gap-1 rounded-full bg-rose-50/70 px-2.5 py-1 text-[11px] font-medium text-rose-700 ring-1 ring-rose-100">
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
        </section>

        {/* ── Sent interest strip ────────────────────────────────────── */}
        {sent.length > 0 && (
          <div className="fade-in-up mt-6 flex items-center gap-2.5 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3 text-[13px] text-emerald-800">
            <Heart className="h-4 w-4 fill-emerald-700 text-emerald-700" />
            <span>
              Interest sent to <strong>{sent.map((m) => m.name.split(" ")[0]).join(", ")}</strong> · awaiting response
            </span>
          </div>
        )}

        {/* ── Section heading ────────────────────────────────────────── */}
        <div className="mt-10 mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700/80">
              <Sparkles className="mr-1 inline h-3 w-3" /> Today's introductions
            </p>
            <h2 className="font-display mt-1 text-[24px] font-semibold text-[#1a0a14]">
              Hand-picked for you
            </h2>
          </div>
          <Link
            href="/matches"
            className="hidden items-center gap-1 text-[13px] font-semibold text-rose-700 hover:text-rose-800 sm:inline-flex"
          >
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* ── Loading skeletons ──────────────────────────────────────── */}
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="overflow-hidden rounded-[20px] border border-rose-100/70 bg-white shadow-[0_2px_14px_rgba(220,30,60,0.05)]"
              >
                <div className="m4m-skeleton h-[260px] rounded-none" />
                <div className="p-4">
                  <div className="m4m-skeleton mb-2 h-4 w-2/3" />
                  <div className="m4m-skeleton h-3 w-1/2" />
                  <div className="mt-3 flex gap-1.5">
                    <div className="m4m-skeleton h-5 w-16 rounded-full" />
                    <div className="m4m-skeleton h-5 w-20 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────── */}
        {!loading && error && (
          <EmptyState
            icon={<AlertCircle className="h-10 w-10 text-rose-700/60" />}
            title="We couldn't load your matches"
            body={error}
          />
        )}

        {/* ── Match grid ─────────────────────────────────────────────── */}
        {!loading && !error && (
          <>
            {active.length === 0 ? (
              <EmptyState
                icon={<Heart className="h-10 w-10 text-rose-700/40" />}
                title={matches.length === 0 ? "No matches yet" : "All caught up for today"}
                body={
                  matches.length === 0
                    ? "Our advisors are reviewing profiles for you. New introductions arrive at 6:00 AM IST."
                    : "We'll prepare new introductions tomorrow morning. In the meantime, browse our wider community."
                }
                action={
                  <LuxeButton asChild size="md">
                    <Link href="/matches">
                      <Search /> Browse all profiles
                    </Link>
                  </LuxeButton>
                }
              />
            ) : (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {active.map((m, i) => (
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
          </>
        )}
      </div>
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
    <div className="fade-in-up rounded-3xl border border-rose-100/70 bg-white px-6 py-16 text-center shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
        {icon}
      </div>
      <h3 className="font-display text-[20px] font-semibold text-[#1a0a14]">{title}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6a5560]">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
