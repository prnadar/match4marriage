"use client";

import { useState } from "react";
import { Crown, Check, Shield, ArrowRight, CreditCard, RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import Link from "next/link";

const CURRENT_PLAN = "elite";

const plans = [
  {
    id: "basic",
    name: "Basic",
    price: 100,
    priceLabel: "/ 6 months",
    highlights: [
      "Curated Matches",
      
      "View profiles",
      "AI compatibility score",
      "Basic search filters",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    price: 300,
    priceLabel: "/ 6 months",
    popular: true,
    highlights: [
      
      "Unlimited interests",
      "Direct messaging",
      "Photo access",
      "Advanced search filters",
      "AI compatibility score",
      "Priority listing",
    ],
  },
  {
    id: "elite",
    name: "Elite",
    price: 1000,
    priceLabel: "/ 6 months",
    highlights: [
      "Everything in Premium",
      "Dedicated relationship advisor",
      "Background verification",
      "Privacy shield: hide profile from non-members",
      "Featured profile placement",
      "WhatsApp support",
      "Profile boosting (4× / month)",
      "Horoscope matching",
      "Family background check",
    ],
  },
  {
    id: "vip",
    name: "VIP Concierge",
    price: null,
    priceLabel: "Bespoke pricing",
    vip: true,
    highlights: [
      "Everything in Elite",
      "Personal matchmaker assigned to you",
      "Curated shortlist of hand-picked profiles",
      "1-on-1 strategy call with our expert team",
      "Profile photography consultation",
      "Family liaison service",
      "Unlimited profile boosts",
      "24/7 WhatsApp concierge support",
      "Financial due diligence",
    ],
  },
];

const currentBillingHistory = [
  { date: "Feb 1, 2026",  plan: "Gold",   amount: "£300", status: "Paid", id: "INV-2026-002" },
  { date: "Jan 1, 2026",  plan: "Gold",   amount: "£300", status: "Paid", id: "INV-2026-001" },
  { date: "Dec 1, 2025",  plan: "Silver", amount: "£100",   status: "Paid", id: "INV-2025-012" },
  { date: "Nov 1, 2025",  plan: "Silver", amount: "£100",   status: "Paid", id: "INV-2025-011" },
];

const CREDITS = [
  { label: "Profile Boosts",  used: 4,  total: 8,   unit: "this month" },
  { label: "Contact Views",   used: 12, total: 999, unit: "unlimited"  },
  { label: "Interests Sent",  used: 23, total: 999, unit: "unlimited"  },
  { label: "Message Threads", used: 8,  total: 999, unit: "unlimited"  },
];

export default function SubscriptionPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("monthly");
  const [confirmCancel, setConfirmCancel] = useState(false);

  const currentPlan = plans.find((p) => p.id === CURRENT_PLAN)!;
  const annualDiscount = 0.8;

  /* ── shared style helpers ── */
  const cardBase = {
    background: "#fff",
    border: "1px solid rgba(220,30,60,0.08)",
    borderRadius: 16,
  };

  const btnPrimary: React.CSSProperties = {
    background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
    color: "#fff",
    borderRadius: 10,
    padding: "12px 24px",
    fontWeight: 600,
    boxShadow: "0 4px 16px rgba(220,30,60,0.25)",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-poppins, sans-serif)",
    fontSize: 14,
  };

  return (
    <div style={{ background: "#fdfbf9", minHeight: "100vh", padding: "32px" }}>
      <div style={{ maxWidth: 896 }}>

        {/* Page title */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          <Crown style={{ width: 20, height: 20, color: "#C89020" }} />
          <h1
            style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 30,
              fontWeight: 300,
              color: "#1a0a14",
              margin: 0,
            }}
          >
            Subscription
          </h1>
        </div>

        {/* ── Current plan banner — crimson gradient ── */}
        <div
          style={{
            borderRadius: 24,
            padding: 24,
            marginBottom: 32,
            background: "linear-gradient(135deg,#dc1e3c,#a0153c)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-poppins, sans-serif)",
                      fontSize: 11,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    Current Plan
                  </span>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(255,255,255,0.2)",
                      color: "#fff",
                      fontFamily: "var(--font-poppins, sans-serif)",
                    }}
                  >
                    Active
                  </span>
                </div>
                <h2
                  style={{
                    fontFamily: "var(--font-playfair, serif)",
                    fontSize: 28,
                    fontWeight: 600,
                    color: "#fff",
                    margin: 0,
                  }}
                >
                  Gold Plan
                </h2>
                <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "4px 0 0" }}>
                  Renews on July 1, 2026 · £300 / 3 months
                </p>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setConfirmCancel(true)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "transparent",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "rgba(255,255,255,0.8)",
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  Cancel Plan
                </button>
                <Link
                  href="/pricing"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.15)",
                    border: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff",
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Upgrade to Platinum <ArrowRight style={{ width: 14, height: 14 }} />
                </Link>
              </div>
            </div>

            {/* Usage stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20 }}>
              {CREDITS.map((c) => {
                const pct = c.total === 999 ? 0 : (c.used / c.total) * 100;
                return (
                  <div
                    key={c.label}
                    style={{
                      borderRadius: 12,
                      padding: 12,
                      background: "rgba(255,255,255,0.12)",
                      border: "1px solid rgba(255,255,255,0.18)",
                    }}
                  >
                    <p
                      style={{
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "rgba(255,255,255,0.6)",
                        margin: "0 0 4px",
                      }}
                    >
                      {c.label}
                    </p>
                    <p
                      style={{
                        fontFamily: "var(--font-playfair, serif)",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#fff",
                        margin: 0,
                      }}
                    >
                      {c.total === 999 ? "∞" : `${c.used}/${c.total}`}
                    </p>
                    {c.total !== 999 && (
                      <div
                        style={{
                          marginTop: 6,
                          height: 4,
                          borderRadius: 999,
                          background: "rgba(255,255,255,0.2)",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 999,
                            width: `${pct}%`,
                            background: "rgba(255,255,255,0.8)",
                          }}
                        />
                      </div>
                    )}
                    <p
                      style={{
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 9,
                        color: "rgba(255,255,255,0.5)",
                        margin: "4px 0 0",
                      }}
                    >
                      {c.unit}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Cancel confirmation ── */}
        {confirmCancel && (
          <div
            style={{
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            <AlertCircle style={{ width: 20, height: 20, color: "#f87171", flexShrink: 0, marginTop: 2 }} />
            <div style={{ flex: 1 }}>
              <p
                style={{
                  fontFamily: "var(--font-poppins, sans-serif)",
                  fontSize: 14,
                  fontWeight: 600,
                  color: "#ef4444",
                  margin: "0 0 4px",
                }}
              >
                Cancel your Gold Plan?
              </p>
              <p
                style={{
                  fontFamily: "var(--font-poppins, sans-serif)",
                  fontSize: 12,
                  color: "rgba(248,113,113,0.7)",
                  margin: "0 0 12px",
                }}
              >
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setConfirmCancel(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "transparent",
                    border: "1px solid rgba(26,10,20,0.14)",
                    color: "rgba(26,10,20,0.6)",
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Keep Plan
                </button>
                <button
                  style={{
                    padding: "8px 16px",
                    borderRadius: 999,
                    background: "#ef4444",
                    border: "none",
                    color: "#fff",
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Yes, Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── All Plans ── */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-playfair, serif)",
                fontSize: 22,
                fontWeight: 600,
                color: "#1a0a14",
                margin: 0,
              }}
            >
              All Plans
            </h2>

            {/* Billing toggle */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                padding: 4,
                borderRadius: 999,
                background: "#fff",
                border: "1px solid rgba(220,30,60,0.12)",
              }}
            >
              {(["monthly", "annual"] as const).map((b) => (
                <button
                  key={b}
                  onClick={() => setBilling(b)}
                  style={{
                    padding: "6px 16px",
                    borderRadius: 999,
                    border: "none",
                    background: billing === b ? "linear-gradient(135deg,#dc1e3c,#a0153c)" : "transparent",
                    color: billing === b ? "#fff" : "rgba(26,10,20,0.5)",
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "background 0.15s",
                  }}
                >
                  {b === "monthly" ? "Monthly" : "Annual"}
                  {b === "annual" && (
                    <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.8 }}>–20%</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {plans.map((plan) => {
              const isCurrent = plan.id === CURRENT_PLAN;
              const isVip     = (plan as any).vip === true;
              const isPopular = (plan as any).popular === true;
              const price     = billing === "annual" && plan.price && plan.price > 0
                ? Math.round(plan.price * annualDiscount)
                : plan.price;

              /* ── VIP card styles ── */
              const vipCardStyle: React.CSSProperties = {
                background: "linear-gradient(160deg, #1a0a14 0%, #2d0f20 100%)",
                border: "2px solid rgba(200,144,32,0.6)",
                borderRadius: 16,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: "0 8px 32px rgba(200,144,32,0.25)",
              };

              /* ── Popular card styles ── */
              const popularCardStyle: React.CSSProperties = {
                background: "rgba(200,144,32,0.08)",
                border: isCurrent ? "2px solid #C89020" : "1px solid #C89020",
                borderRadius: 16,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: "0 4px 24px rgba(200,144,32,0.18)",
              };

              /* ── Regular card styles ── */
              const regularCardStyle: React.CSSProperties = {
                background: "#fff",
                border: isCurrent ? "2px solid #dc1e3c" : "1px solid rgba(220,30,60,0.08)",
                borderRadius: 16,
                padding: 16,
                display: "flex",
                flexDirection: "column",
                position: "relative",
                boxShadow: isCurrent ? "0 4px 20px rgba(220,30,60,0.18)" : "none",
              };

              const cardStyle = isVip ? vipCardStyle : isPopular ? popularCardStyle : regularCardStyle;

              const nameColor     = isVip ? "#C89020" : isPopular ? "#C89020" : "#1a0a14";
              const priceColor    = isVip ? "#C89020" : isPopular ? "#C89020" : "#1a0a14";
              const priceMuted    = isVip ? "rgba(200,144,32,0.7)" : isPopular ? "rgba(200,144,32,0.55)" : "rgba(26,10,20,0.4)";
              const featureColor  = isVip ? "rgba(255,255,255,0.75)" : isPopular ? "rgba(26,10,20,0.7)" : "rgba(26,10,20,0.6)";
              const checkColor    = isVip ? "#C89020" : isPopular ? "#C89020" : "#dc1e3c";

              return (
                <div key={plan.id} style={cardStyle}>
                  {/* Current badge */}
                  {isCurrent && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "2px 10px",
                        borderRadius: 999,
                        background: isPopular
                          ? "linear-gradient(135deg,#C89020,#9A6B00)"
                          : "linear-gradient(135deg,#dc1e3c,#a0153c)",
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <CheckCircle style={{ width: 10, height: 10 }} /> Current
                    </div>
                  )}

                  {/* VIP badge */}
                  {isVip && (
                    <div style={{
                      position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                      padding: "2px 12px", borderRadius: 999,
                      background: "linear-gradient(135deg,#C89020,#9A6B00)",
                      fontSize: 10, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
                    }}>✦ VIP Concierge</div>
                  )}

                  {/* Popular badge */}
                  {isPopular && !isCurrent && !isVip && (
                    <div
                      style={{
                        position: "absolute",
                        top: -12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        padding: "2px 10px",
                        borderRadius: 999,
                        background: "linear-gradient(135deg,#C89020,#9A6B00)",
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#fff",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ✦ Popular
                    </div>
                  )}

                  <h3
                    style={{
                      fontFamily: "var(--font-playfair, serif)",
                      fontSize: 16,
                      fontWeight: 600,
                      color: nameColor,
                      margin: "0 0 4px",
                    }}
                  >
                    {plan.name}
                  </h3>

                  <div style={{ marginBottom: 12 }}>
                    {plan.price === null ? (
                      <p style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 18, fontWeight: 700, color: "#C89020", margin: 0 }}>
                        Bespoke
                        <span style={{ fontSize: 11, fontWeight: 400, color: priceMuted }}> / tailored to you</span>
                      </p>
                    ) : plan.price === 0 ? (
                      <p style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 20, fontWeight: 700, color: priceColor, margin: 0 }}>Free</p>
                    ) : (
                      <p style={{ fontFamily: "var(--font-playfair, serif)", fontSize: 20, fontWeight: 700, color: priceColor, margin: 0 }}>
                        £{(price as number).toLocaleString("en-GB")}
                        <span style={{ fontSize: 11, fontWeight: 400, color: priceMuted }}> / 6 months</span>
                      </p>
                    )}
                  </div>

                  <ul
                    style={{
                      listStyle: "none",
                      padding: 0,
                      margin: "0 0 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      flex: 1,
                    }}
                  >
                    {plan.highlights.map((h) => (
                      <li
                        key={h}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 6,
                        }}
                      >
                        <Check
                          style={{
                            width: 12,
                            height: 12,
                            flexShrink: 0,
                            marginTop: 2,
                            color: checkColor,
                          }}
                        />
                        <span
                          style={{
                            fontFamily: "var(--font-poppins, sans-serif)",
                            fontSize: 11,
                            color: featureColor,
                          }}
                        >
                          {h}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {isVip ? (
                    <a
                      href="https://calendly.com/match4marriage"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "block", textAlign: "center",
                        width: "100%", padding: "9px 0",
                        borderRadius: 10, border: "none", cursor: "pointer",
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 12, fontWeight: 700, color: "#1a0a14",
                        background: "linear-gradient(135deg,#C89020,#9A6B00)",
                        boxShadow: "0 4px 16px rgba(200,144,32,0.4)",
                        textDecoration: "none",
                      }}
                    >
                      📅 Schedule a Call
                    </a>
                  ) : !isCurrent && (
                    <button
                      style={{
                        width: "100%",
                        padding: "8px 0",
                        borderRadius: 10,
                        border: "none",
                        cursor: "pointer",
                        fontFamily: "var(--font-poppins, sans-serif)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: isPopular ? "#fff" : "#1a0a14",
                        background: isPopular
                          ? "linear-gradient(135deg,#C89020,#9A6B00)"
                          : "rgba(26,10,20,0.08)",
                        boxShadow: isPopular ? "0 4px 16px rgba(200,144,32,0.3)" : "none",
                      }}
                    >
                      {!plan.price || (currentPlan.price && plan.price <= currentPlan.price) ? "Downgrade" : "Upgrade"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Payment method + Billing history ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
          {/* Payment method */}
          <div style={{ ...cardBase, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <CreditCard style={{ width: 16, height: 16, color: "#C89020" }} />
              <h3
                style={{
                  fontFamily: "var(--font-playfair, serif)",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#1a0a14",
                  margin: 0,
                }}
              >
                Payment Method
              </h3>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 12,
                borderRadius: 12,
                marginBottom: 12,
                background: "rgba(253,251,249,0.9)",
                border: "1px solid rgba(220,30,60,0.1)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 28,
                  borderRadius: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "#1A1F71",
                  fontWeight: 700,
                  fontSize: 11,
                  color: "#fff",
                  fontFamily: "var(--font-poppins, sans-serif)",
                  flexShrink: 0,
                }}
              >
                VISA
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, fontWeight: 500, color: "#1a0a14", margin: 0 }}>
                  •••• •••• •••• 4242
                </p>
                <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, color: "rgba(26,10,20,0.4)", margin: "2px 0 0" }}>
                  Expires 12/2027
                </p>
              </div>
              <CheckCircle style={{ width: 16, height: 16, color: "#5C7A52" }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {["Add UPI", "Change Card"].map((label) => (
                <button
                  key={label}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 10,
                    border: "1px solid rgba(220,30,60,0.15)",
                    background: "transparent",
                    color: "rgba(26,10,20,0.55)",
                    fontFamily: "var(--font-poppins, sans-serif)",
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Billing history */}
          <div style={{ ...cardBase, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <RefreshCw style={{ width: 16, height: 16, color: "#C89020" }} />
              <h3
                style={{
                  fontFamily: "var(--font-playfair, serif)",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "#1a0a14",
                  margin: 0,
                }}
              >
                Billing History
              </h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {currentBillingHistory.map((inv) => (
                <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 12, fontWeight: 500, color: "rgba(26,10,20,0.7)", margin: 0 }}>
                      {inv.date}
                    </p>
                    <p style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 10, color: "rgba(26,10,20,0.35)", margin: "2px 0 0" }}>
                      {inv.plan} · {inv.id}
                    </p>
                  </div>
                  <span style={{ fontFamily: "var(--font-poppins, sans-serif)", fontSize: 14, fontWeight: 600, color: "#1a0a14" }}>
                    {inv.amount}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-poppins, sans-serif)",
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 999,
                      background: "rgba(92,122,82,0.1)",
                      color: "#5C7A52",
                    }}
                  >
                    {inv.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Money-back guarantee ── */}
        <div
          style={{
            ...cardBase,
            padding: 16,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <Shield style={{ width: 32, height: 32, color: "#dc1e3c", flexShrink: 0 }} />
          <div>
            <p
              style={{
                fontFamily: "var(--font-poppins, sans-serif)",
                fontSize: 14,
                fontWeight: 600,
                color: "#1a0a14",
                margin: "0 0 2px",
              }}
            >
              30-day money-back guarantee
            </p>
            <p
              style={{
                fontFamily: "var(--font-poppins, sans-serif)",
                fontSize: 12,
                color: "rgba(26,10,20,0.5)",
                margin: 0,
              }}
            >
              Not happy? Contact us within 30 days for a full refund, no questions asked.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
