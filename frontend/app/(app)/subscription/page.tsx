"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Crown, Check, Shield, ArrowRight, AlertCircle, Loader2, Sparkles,
  Lock, Mail,
} from "lucide-react";
import { pricingApi, api, ApiError } from "@/lib/api";
import { useEntitlements } from "@/lib/useEntitlements";

/**
 * Subscription page.
 *
 * - Plans are fetched from the backend's public `/api/v1/pricing-plans`
 *   endpoint (admin-managed in /admin/pricing).
 * - We do NOT display fabricated billing history or credit usage. Until the
 *   subscriptions router (Razorpay/Stripe) is re-enabled and wired, those
 *   sections render an honest empty/setup state.
 *
 * When billing is enabled, the existing backend endpoints to wire are:
 *   POST /api/v1/subscriptions/create-checkout
 *   POST /api/v1/subscriptions/create
 *   GET  /api/v1/subscriptions/limits
 *   POST /api/v1/subscriptions/webhook/{stripe|razorpay}
 */

interface RemotePlan {
  id: string;
  key: string;
  name: string;
  tier: "silver" | "gold" | "platinum" | string;
  price_paise: number;
  original_price_paise?: number | null;
  currency: string;
  period: "monthly" | "quarterly" | "yearly" | string;
  features?: string[];
  is_active: boolean;
  sort_order?: number;
}

function fmtMoney(minor: number, currency: string): string {
  const major = minor / 100;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: currency || "GBP",
      maximumFractionDigits: major >= 100 ? 0 : 2,
    }).format(major);
  } catch {
    return `${currency || ""} ${major}`.trim();
  }
}

function formatPrice(p: RemotePlan): string {
  return fmtMoney(p.price_paise, p.currency);
}

// A promo applies when there's a higher "was" price than the live price.
function hasPromo(p: RemotePlan): boolean {
  return typeof p.original_price_paise === "number"
    && p.original_price_paise > p.price_paise;
}

function periodLabel(p: RemotePlan): string {
  // Human billing cadence by tier: the inaugural Basic is free for the first
  // 3 months; the paid tiers (Premium / Elite) bill every 6 months. The
  // PricingPeriod enum only models monthly/quarterly/yearly, so the label is
  // derived here from the tier.
  if (p.tier === "silver") return "for 3 months";
  if (p.tier === "gold" || p.tier === "platinum") return "/ 6 months";
  switch (p.period) {
    case "monthly":   return "/ month";
    case "quarterly": return "/ quarter";
    case "yearly":    return "/ year";
    default:          return "";
  }
}

const TIER_META: Record<string, { kicker: string; icon: React.ReactNode; popular?: boolean }> = {
  silver:   { kicker: "Starter",      icon: <Shield  className="h-4 w-4" /> },
  gold:     { kicker: "Most popular", icon: <Sparkles className="h-4 w-4" />, popular: true },
  platinum: { kicker: "Concierge",    icon: <Crown   className="h-4 w-4" /> },
};

const EASE = [0.22, 1, 0.36, 1] as const;

export default function SubscriptionPage() {
  const { entitlements, isLoading: entitlementsLoading } = useEntitlements();
  const [plans, setPlans] = useState<RemotePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingTier, setPayingTier] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

  const reduce = useReducedMotion();
  const gridV: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.09, delayChildren: 0.04 } },
  };
  const itemV: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 26 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };

  // "free" → Basic preview; every other tier is a paid plan and gets the
  // active-pill treatment so members can tell at a glance whether they're
  // already on a paid tier.
  const isPaidPlan = !entitlementsLoading && entitlements.plan !== "free";
  const currentPlanLabel = entitlementsLoading
    ? "Loading…"
    : entitlements.planLabel || "Basic";

  // Start a PayPal checkout: create the order server-side, then send the
  // member to PayPal's approval page.
  const payWithPayPal = async (tier: string) => {
    if (payingTier) return;
    setBanner(null);
    setPayingTier(tier);
    try {
      const res = await api.post("/api/v1/subscriptions/create-checkout", {
        plan: tier,
        currency: "GBP",
        gateway: "paypal",
      });
      const d = (res.data as any)?.data ?? res.data;
      if (d?.checkout_url) {
        window.location.href = d.checkout_url;
        return;
      }
      throw new Error("Could not start PayPal checkout");
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message
        : err instanceof Error ? err.message : "Could not start PayPal checkout";
      setBanner({ kind: "error", text: msg });
      setPayingTier(null);
    }
  };

  // PayPal redirects back to /subscription?paypal=return&token=<orderID>.
  // Capture the order, then surface the result.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flow = params.get("paypal");
    if (!flow) return;

    // Clean the query string so a refresh doesn't re-trigger.
    const clean = () => window.history.replaceState({}, "", window.location.pathname);

    if (flow === "cancel") {
      setBanner({ kind: "info", text: "Payment cancelled. You have not been charged." });
      clean();
      return;
    }
    if (flow === "return") {
      const orderId = params.get("token");
      if (!orderId) { clean(); return; }
      setBanner({ kind: "info", text: "Confirming your payment with PayPal…" });
      (async () => {
        try {
          const res = await api.post("/api/v1/subscriptions/paypal/capture", { order_id: orderId });
          const d = (res.data as any)?.data ?? res.data;
          const ok = (res.data as any)?.success !== false;
          if (ok) {
            setBanner({ kind: "success", text: `Payment received. Your ${String(d?.plan ?? "").toUpperCase() || "membership"} plan is now active.` });
          } else {
            setBanner({ kind: "error", text: "Payment was not completed. If you were charged, contact us and we'll sort it out." });
          }
        } catch (err: unknown) {
          const msg = err instanceof ApiError ? err.message
            : err instanceof Error ? err.message : "We could not confirm the payment";
          setBanner({ kind: "error", text: msg });
        } finally {
          clean();
        }
      })();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await pricingApi.listPlans();
        const list = ((res.data as any)?.data ?? res.data ?? []) as RemotePlan[];
        const sorted = [...list].sort((a, b) =>
          (a.sort_order ?? 0) - (b.sort_order ?? 0),
        );
        if (!cancelled) setPlans(sorted);
      } catch (err: unknown) {
        if (cancelled) return;
        if (err instanceof ApiError) setError(err.message);
        else setError(err instanceof Error ? err.message : "Could not load pricing");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)" }}
    >
      {/* Ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="m4m-sub-aurora m4m-sub-aurora-rose" />
        <span className="m4m-sub-aurora m4m-sub-aurora-gold" />
        <span className="m4m-sub-aurora m4m-sub-aurora-plum" />
        <span className="m4m-sub-dots" />
        <span className="m4m-sub-vignette" />
      </div>

      <div className="relative mx-auto max-w-[1140px] px-6 py-10 lg:px-8 lg:py-14">

        {/* Header */}
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: EASE }}
          className="mb-9 text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f3c9a8] backdrop-blur-sm">
            <Sparkles className="h-3 w-3" /> Membership
          </span>
          <h1 className="font-display mx-auto mt-4 max-w-2xl text-[38px] font-semibold leading-[1.06] text-white sm:text-[50px]">
            Choose your level of{" "}
            <span style={{
              background: "linear-gradient(90deg,#ffd9a0 0%,#ffb0c6 45%,#ffd9a0 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
            }}>care</span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[14.5px] leading-relaxed text-white/55">
            Every plan includes a personally vetted profile and our advisors as your guide.
            Higher tiers unlock additional curation and discreet support.
          </p>
        </motion.header>

        {banner && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={
              "mx-auto mb-7 flex max-w-2xl items-start gap-3 rounded-2xl border p-4 text-[13px] backdrop-blur-sm " +
              (banner.kind === "success"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100"
                : banner.kind === "error"
                ? "border-rose-400/30 bg-rose-400/10 text-rose-100"
                : "border-amber-300/30 bg-amber-300/10 text-amber-100")
            }
          >
            {banner.kind === "success"
              ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
              : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            <span>{banner.text}</span>
          </motion.div>
        )}

        {/* Current plan strip */}
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE, delay: 0.08 }}
          className="mb-9 flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#dc1e3c]/15 ring-1 ring-[#dc1e3c]/30">
            <Shield className="h-5 w-5 text-[#ff8aa3]" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f3c9a8]/70">
              Your current plan
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="font-display text-[18px] font-semibold text-white m-0">
                {currentPlanLabel}
              </p>
              {isPaidPlan && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/12 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-200 ring-1 ring-emerald-400/25">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Active
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12.5px] text-white/55">
              {isPaidPlan
                ? "Your membership is active. You can upgrade or change plans below."
                : "You have access to your daily curated matches. Upgrade for unlimited browsing, messaging, and dedicated advisor support."}
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/[0.12]"
          >
            <Mail className="h-3.5 w-3.5" /> Speak to an advisor
          </Link>
        </motion.section>

        {/* Loading */}
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
                <div className="mb-3 h-4 w-24 animate-pulse rounded bg-white/10" />
                <div className="mb-4 h-8 w-1/2 animate-pulse rounded bg-white/10" />
                <div className="space-y-2">
                  <div className="h-3 w-full animate-pulse rounded bg-white/[0.07]" />
                  <div className="h-3 w-5/6 animate-pulse rounded bg-white/[0.07]" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-white/[0.07]" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-12 text-center">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-300/70" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-white">Couldn't load pricing</h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">{error}</p>
          </div>
        )}

        {!loading && !error && plans.length === 0 && (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-16 text-center">
            <Crown className="mx-auto h-9 w-9 text-[#f3c9a8]/50" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-white">Pricing is being finalised</h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-white/55">
              Our advisors will share bespoke pricing on a confidential call.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_26px_-6px_rgba(220,30,60,0.6)]"
            >
              Speak to an advisor <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* Plans */}
        {!loading && !error && plans.length > 0 && (
          <motion.div
            variants={gridV}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className={
              "grid grid-cols-1 items-stretch gap-5 " +
              (plans.length >= 3 ? "lg:grid-cols-3" : plans.length === 2 ? "sm:grid-cols-2" : "")
            }
          >
            {plans.map((p) => {
              const meta = TIER_META[p.tier?.toLowerCase()] ?? { kicker: "", icon: null };
              const popular = meta.popular;
              const inner = (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      {meta.icon && (
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#c9954a]/14 text-[#f3c9a8] ring-1 ring-[#c9954a]/25">
                          {meta.icon}
                        </span>
                      )}
                      {meta.kicker && (
                        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
                          {meta.kicker}
                        </span>
                      )}
                    </div>
                    {popular && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_4px_14px_rgba(220,30,60,0.4)]">
                        <Sparkles className="h-3 w-3" /> Popular
                      </span>
                    )}
                  </div>

                  <h2 className="font-display mt-4 text-[22px] font-semibold text-white">{p.name}</h2>

                  <div className="mt-1.5 flex items-baseline gap-2">
                    {hasPromo(p) && (
                      <span className="font-display text-[18px] font-medium text-white/35 line-through decoration-[#dc1e3c]/70">
                        {fmtMoney(p.original_price_paise as number, p.currency)}
                      </span>
                    )}
                    <span className="font-display text-[34px] font-semibold text-white">
                      {p.price_paise <= 0 ? "Free" : formatPrice(p)}
                    </span>
                    <span className="text-[12.5px] text-white/50">{periodLabel(p)}</span>
                  </div>

                  {hasPromo(p) && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_3px_12px_rgba(220,30,60,0.4)]">
                      <Sparkles className="h-3 w-3" /> Inaugural offer
                    </span>
                  )}

                  <ul className="mt-5 space-y-2.5">
                    {(p.features ?? []).map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-[13px] text-white/75">
                        <span className="mt-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-[#c9954a]/18 ring-1 ring-[#c9954a]/30">
                          <Check className="h-2.5 w-2.5 text-[#f3c9a8]" />
                        </span>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-6">
                    {(() => {
                      const base = "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-2xl px-5 py-3 text-[13.5px] font-semibold transition-all ";
                      const btn = popular
                        ? base + "bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] text-white shadow-[0_12px_30px_-8px_rgba(220,30,60,0.7)] hover:shadow-[0_16px_38px_-8px_rgba(220,30,60,0.85)]"
                        : base + "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.12] hover:border-white/25";
                      const isPaidTier = ["silver", "gold", "platinum"].includes(p.tier);
                      if (isPaidTier && p.price_paise > 0) {
                        return (
                          <button
                            type="button"
                            onClick={() => payWithPayPal(p.tier)}
                            disabled={payingTier !== null}
                            className={btn + " disabled:cursor-not-allowed disabled:opacity-60"}
                          >
                            {payingTier === p.tier ? (
                              <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Redirecting to PayPal…</>
                            ) : (
                              <>Pay with PayPal <ArrowRight className="h-3.5 w-3.5" /></>
                            )}
                          </button>
                        );
                      }
                      if (isPaidTier && p.price_paise <= 0) {
                        return (
                          <Link href="/auth/register" className={btn}>
                            {hasPromo(p) ? "Claim inaugural offer" : "Get started free"}
                            <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        );
                      }
                      return (
                        <Link href="/contact" className={btn}>
                          Enquire about {p.name} <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      );
                    })()}
                  </div>
                </>
              );

              return (
                <motion.div
                  key={p.id}
                  variants={itemV}
                  whileHover={reduce ? undefined : { y: -7 }}
                  transition={{ type: "spring", stiffness: 300, damping: 22 }}
                  className={popular ? "relative lg:-mt-4 lg:mb-0" : "relative"}
                >
                  {popular ? (
                    <div className="h-full rounded-[26px] bg-gradient-to-b from-[#dc1e3c] via-[#e8729a] to-[#c9954a] p-[1.6px] shadow-[0_30px_70px_-18px_rgba(220,30,60,0.6)]">
                      <div className="flex h-full flex-col rounded-[24.6px] bg-[#170811] p-6">
                        {inner}
                      </div>
                    </div>
                  ) : (
                    <div className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors hover:border-white/20">
                      {inner}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* VIP Bespoke Service — contact-only, by invitation */}
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: EASE }}
          className="relative mt-8 overflow-hidden rounded-3xl border border-[#c9954a]/25 p-6 sm:p-8"
          style={{ background: "linear-gradient(135deg,#1f0c18 0%,#2a0f1e 55%,#1a0a14 100%)" }}
        >
          <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full" style={{ background: "radial-gradient(circle,rgba(201,149,74,0.22),transparent 65%)" }} />
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <span className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-white/[0.08] ring-1 ring-[#c9954a]/30">
                <Crown className="h-5 w-5 text-[#f3d9a8]" />
              </span>
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#f3d9a8]">
                  By invitation
                </span>
                <h3 className="font-display mt-0.5 text-[20px] font-semibold text-white">VIP Bespoke Service</h3>
                <p className="mt-1.5 max-w-xl text-[13.5px] leading-relaxed text-white/65">
                  A fully personal, white-glove matchmaking experience — hand-selected
                  introductions, a dedicated senior advisor, family liaison, and complete
                  discretion. Tailored entirely to you.
                </p>
              </div>
            </div>
            <motion.a
              whileHover={reduce ? undefined : { y: -2 }}
              href="mailto:enquiry@match4marriage.com?subject=VIP%20Bespoke%20Service%20enquiry"
              className="inline-flex flex-shrink-0 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-[13.5px] font-semibold text-[#1a0a14] shadow-lg transition-colors hover:bg-[#f3d9a8]"
            >
              <Mail className="h-4 w-4" /> enquiry@match4marriage.com
            </motion.a>
          </div>
        </motion.section>

        {/* Honest billing notice */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.03] p-5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#f3c9a8]/80" />
            <div>
              <p className="font-display text-[15px] font-semibold text-white">
                Secure payment with PayPal
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-white/55">
                Choose a plan and pay securely through PayPal using your PayPal balance
                or any card. Your membership activates as soon as the payment is confirmed.
                For the VIP Bespoke service, email enquiry@match4marriage.com.
              </p>
            </div>
          </div>
        </section>

        <p className="mt-6 flex items-center justify-center gap-2 text-[11.5px] text-white/45">
          <Loader2 className="h-3 w-3 animate-spin opacity-60" />
          Plan changes apply at the next billing cycle. Cancel anytime, no questions asked.
        </p>
      </div>

      <style jsx>{`
        .m4m-sub-aurora { position: absolute; border-radius: 50%; filter: blur(120px); pointer-events: none; will-change: transform; }
        .m4m-sub-aurora-rose { width: 540px; height: 540px; top: -150px; left: -120px; background: radial-gradient(circle, rgba(220,30,60,0.5), transparent 60%); opacity: 0.5; animation: m4mSubRose 26s ease-in-out infinite alternate; }
        .m4m-sub-aurora-gold { width: 560px; height: 560px; bottom: -190px; right: -150px; background: radial-gradient(circle, rgba(201,149,74,0.4), transparent 60%); opacity: 0.42; animation: m4mSubGold 32s ease-in-out infinite alternate; }
        .m4m-sub-aurora-plum { width: 380px; height: 380px; top: 45%; left: 30%; background: radial-gradient(circle, rgba(124,58,137,0.4), transparent 60%); opacity: 0.28; animation: m4mSubPlum 30s ease-in-out infinite alternate; }
        @keyframes m4mSubRose { from { transform: translate(0,0) scale(1); } to { transform: translate(120px,90px) scale(1.15); } }
        @keyframes m4mSubGold { from { transform: translate(0,0) scale(1); } to { transform: translate(-130px,-70px) scale(0.92); } }
        @keyframes m4mSubPlum { from { transform: translate(0,0) scale(1); } to { transform: translate(70px,-60px) scale(1.1); } }
        .m4m-sub-dots { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.22) 1px, transparent 1px); background-size: 30px 30px; opacity: 0.07; -webkit-mask-image: radial-gradient(ellipse at 50% 0%, black 5%, transparent 70%); mask-image: radial-gradient(ellipse at 50% 0%, black 5%, transparent 70%); }
        .m4m-sub-vignette { position: absolute; inset: 0; background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.5) 100%); }
        @media (prefers-reduced-motion: reduce) {
          .m4m-sub-aurora-rose, .m4m-sub-aurora-gold, .m4m-sub-aurora-plum { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
