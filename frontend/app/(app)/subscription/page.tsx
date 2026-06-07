"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
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

export default function SubscriptionPage() {
  const { entitlements, isLoading: entitlementsLoading } = useEntitlements();
  const [plans, setPlans] = useState<RemotePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingTier, setPayingTier] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ kind: "success" | "error" | "info"; text: string } | null>(null);

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
    <div className="min-h-screen" style={{ background: "#fdfbf9" }}>
      <div className="mx-auto max-w-[1100px] px-6 py-8 lg:px-8 lg:py-10">

        {/* Header */}
        <header className="fade-in-up mb-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.22em] text-rose-700/80">
            Membership
          </p>
          <h1 className="font-display mt-1 text-[34px] font-semibold leading-tight text-[#1a0a14] sm:text-[40px]">
            Choose your level of <span className="gold-text gold-text-shimmer">care</span>
          </h1>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[#6a5560]">
            Every plan includes a personally vetted profile and our advisors as your guide.
            Higher tiers unlock additional curation and discreet support.
          </p>
        </header>

        {banner && (
          <div
            className={
              "fade-in-up mb-6 flex items-start gap-3 rounded-2xl border p-4 text-[13px] " +
              (banner.kind === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : banner.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : "border-amber-200 bg-amber-50 text-amber-800")
            }
          >
            {banner.kind === "success"
              ? <Check className="mt-0.5 h-4 w-4 flex-shrink-0" />
              : <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />}
            <span>{banner.text}</span>
          </div>
        )}

        {/* Current plan strip — backend hasn't exposed subscription state yet */}
        <section
          className="fade-in-up mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-rose-100/70 bg-white p-5 shadow-[0_2px_14px_rgba(220,30,60,0.05)]"
          style={{ animationDelay: "60ms" }}
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 ring-1 ring-rose-100">
            <Shield className="h-5 w-5 text-rose-700" />
          </div>
          <div className="flex-1 min-w-[240px]">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-rose-700/70">
              Your current plan
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <p className="font-display text-[18px] font-semibold text-[#1a0a14] m-0">
                {currentPlanLabel}
              </p>
              {isPaidPlan && (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12.5px] text-[#6a5560]">
              {isPaidPlan
                ? "Your membership is active. You can upgrade or change plans below."
                : "You have access to your daily curated matches. Upgrade for unlimited browsing, messaging, and dedicated advisor support."}
            </p>
          </div>
          <Link
            href="/contact"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[12.5px] font-semibold text-rose-700 ring-1 ring-rose-100 hover:bg-rose-50"
          >
            <Mail className="h-3.5 w-3.5" /> Speak to an advisor
          </Link>
        </section>

        {/* Plans */}
        {loading && (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-3xl border border-rose-100/70 bg-white p-6 shadow-[0_2px_14px_rgba(220,30,60,0.05)]"
              >
                <div className="m4m-skeleton mb-3 h-4 w-24" />
                <div className="m4m-skeleton mb-4 h-8 w-1/2" />
                <div className="space-y-2">
                  <div className="m4m-skeleton h-3 w-full" />
                  <div className="m4m-skeleton h-3 w-5/6" />
                  <div className="m4m-skeleton h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="rounded-3xl border border-rose-100/70 bg-white px-6 py-12 text-center shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
            <AlertCircle className="mx-auto h-9 w-9 text-rose-700/60" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-[#1a0a14]">
              Couldn't load pricing
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6a5560]">{error}</p>
          </div>
        )}

        {!loading && !error && plans.length === 0 && (
          <div className="rounded-3xl border border-rose-100/70 bg-white px-6 py-16 text-center shadow-[0_2px_14px_rgba(220,30,60,0.05)]">
            <Crown className="mx-auto h-9 w-9 text-rose-700/40" />
            <h3 className="font-display mt-3 text-[18px] font-semibold text-[#1a0a14]">
              Pricing is being finalised
            </h3>
            <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-[#6a5560]">
              Our advisors will share bespoke pricing on a confidential call.
            </p>
            <Link
              href="/contact"
              className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
            >
              Speak to an advisor <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {!loading && !error && plans.length > 0 && (
          <div
            className={
              "grid grid-cols-1 gap-5 " +
              (plans.length >= 3 ? "lg:grid-cols-3" : plans.length === 2 ? "sm:grid-cols-2" : "")
            }
          >
            {plans.map((p, i) => {
              const meta = TIER_META[p.tier?.toLowerCase()] ?? { kicker: "", icon: null };
              const popular = meta.popular;
              return (
                <div
                  key={p.id}
                  className={
                    "fade-in-up relative overflow-hidden rounded-3xl border bg-white p-6 transition-all " +
                    (popular
                      ? "border-rose-200 shadow-[0_18px_40px_rgba(160,21,60,0.16)]"
                      : "border-rose-100/70 shadow-[0_2px_14px_rgba(220,30,60,0.05)] hover:shadow-[0_8px_24px_rgba(220,30,60,0.10)]")
                  }
                  style={{ animationDelay: `${100 + i * 60}ms` }}
                >
                  {popular && (
                    <span className="absolute right-5 top-5 inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white shadow-[0_4px_14px_rgba(220,30,60,0.28)]">
                      <Sparkles className="h-3 w-3" /> Popular
                    </span>
                  )}
                  <div className="flex items-center gap-2">
                    {meta.icon && (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-700 ring-1 ring-rose-100">
                        {meta.icon}
                      </span>
                    )}
                    {meta.kicker && (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700/70">
                        {meta.kicker}
                      </span>
                    )}
                  </div>
                  <h2 className="font-display mt-3 text-[22px] font-semibold text-[#1a0a14]">
                    {p.name}
                  </h2>
                  <div className="mt-1 flex items-baseline gap-2">
                    {hasPromo(p) && (
                      <span className="font-display text-[19px] font-medium text-[#b9a3aa] line-through decoration-[#dc1e3c]/60">
                        {fmtMoney(p.original_price_paise as number, p.currency)}
                      </span>
                    )}
                    <span className="font-display text-[32px] font-semibold text-[#1a0a14]">
                      {p.price_paise <= 0 ? "Free" : formatPrice(p)}
                    </span>
                    <span className="text-[12.5px] text-[#6a5560]">{periodLabel(p)}</span>
                  </div>
                  {hasPromo(p) && (
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white shadow-[0_3px_12px_rgba(220,30,60,0.25)]">
                      <Sparkles className="h-3 w-3" /> Inaugural offer
                    </span>
                  )}

                  <ul className="mt-5 space-y-2">
                    {(p.features ?? []).map((f, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[13px] text-[#1a0a14]/80">
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-600" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {(() => {
                    const btn = "mt-6 flex w-full items-center justify-center gap-1.5 rounded-2xl px-5 py-3 text-[13.5px] font-semibold transition-all " +
                      (popular
                        ? "bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] text-white shadow-[0_8px_22px_rgba(220,30,60,0.32)] hover:shadow-[0_12px_28px_rgba(220,30,60,0.40)]"
                        : "border border-rose-100 bg-white text-[#1a0a14] hover:border-rose-200 hover:text-rose-700");
                    const isPaidTier = ["silver", "gold", "platinum"].includes(p.tier);
                    if (isPaidTier && p.price_paise > 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => payWithPayPal(p.tier)}
                          disabled={payingTier !== null}
                          className={btn + " disabled:opacity-60 disabled:cursor-not-allowed"}
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
                      // Free / inaugural-offer plan — no payment, just sign up.
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
              );
            })}
          </div>
        )}

        {/* Honest billing notice */}
        <section className="mt-10 rounded-3xl border border-amber-100 bg-amber-50/60 p-5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" />
            <div>
              <p className="font-display text-[15px] font-semibold text-[#1a0a14]">
                Secure payment with PayPal
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6a5560]">
                Choose a plan and pay securely through PayPal using your PayPal balance
                or any card. Your membership activates as soon as the payment is confirmed.
                For the VIP Concierge tier, speak to an advisor first.
              </p>
            </div>
          </div>
        </section>

        <p className="mt-6 flex items-center justify-center gap-2 text-[11.5px] text-[#6a5560]">
          <Loader2 className="h-3 w-3 animate-spin opacity-60" />
          Plan changes apply at the next billing cycle. Cancel anytime, no questions asked.
        </p>
      </div>
    </div>
  );
}
