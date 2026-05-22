"use client";

import Link from "next/link";
import { Lock, ArrowRight, Sparkles } from "lucide-react";

/**
 * Upgrade gates for tier-locked features. Two flavours:
 *  - <UpgradePanel/>  : a standalone centred card replacing locked content
 *                       (e.g. the Messages page for Basic members).
 *  - <UpgradeOverlay/>: an absolutely-positioned blur+lock layer placed over
 *                       content the member can see but not access (e.g. photos).
 *
 * Both link to /subscription where members can change plan. Mirrors the
 * pricing-page palette (rose primary, cream surfaces).
 */

const UPGRADE_HREF = "/subscription";

export function UpgradePanel({
  title,
  message,
  feature,
  cta = "View plans",
}: {
  title: string;
  message: string;
  /** Short plan name required, e.g. "Premium". Shown as a pill. */
  feature?: string;
  cta?: string;
}) {
  return (
    <div
      style={{
        maxWidth: 460,
        margin: "0 auto",
        textAlign: "center",
        padding: "40px 28px",
        background: "#fff",
        border: "1px solid rgba(220,30,60,0.12)",
        borderRadius: 18,
        boxShadow: "0 10px 40px rgba(220,30,60,0.06)",
      }}
    >
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: "50%",
          margin: "0 auto 18px",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(135deg, rgba(220,30,60,0.10), rgba(220,30,60,0.04))",
          color: "#dc1e3c",
        }}
      >
        <Lock size={22} strokeWidth={2} />
      </div>
      {feature && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: "#a0153c",
            background: "rgba(220,30,60,0.06)",
            border: "1px solid rgba(220,30,60,0.14)",
            borderRadius: 999,
            padding: "4px 12px",
            marginBottom: 14,
            textTransform: "uppercase",
          }}
        >
          <Sparkles size={12} /> {feature} feature
        </span>
      )}
      <h3 className="font-display" style={{ fontSize: 22, fontWeight: 600, color: "#1a0a14", margin: "0 0 8px" }}>
        {title}
      </h3>
      <p style={{ fontSize: 14, lineHeight: 1.6, color: "#78686e", margin: "0 0 22px" }}>{message}</p>
      <Link
        href={UPGRADE_HREF}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "12px 24px",
          borderRadius: 9999,
          fontSize: 14,
          fontWeight: 600,
          textDecoration: "none",
          background: "linear-gradient(135deg, #dc1e3c, #a0153c)",
          color: "#fff",
          boxShadow: "0 6px 18px rgba(220,30,60,0.32)",
        }}
      >
        {cta} <ArrowRight size={15} strokeWidth={2} />
      </Link>
    </div>
  );
}

export function UpgradeOverlay({
  label = "Premium",
  message = "Upgrade to view",
}: {
  label?: string;
  message?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 2,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        textAlign: "center",
        padding: 16,
        background: "rgba(26,10,20,0.42)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        color: "#fff",
      }}
    >
      <Lock size={20} strokeWidth={2} />
      <span style={{ fontSize: 13, fontWeight: 600 }}>{message}</span>
      <Link
        href={UPGRADE_HREF}
        style={{
          marginTop: 4,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          borderRadius: 9999,
          fontSize: 12,
          fontWeight: 700,
          textDecoration: "none",
          background: "#fff",
          color: "#a0153c",
        }}
      >
        Unlock with {label} <ArrowRight size={12} strokeWidth={2.4} />
      </Link>
    </div>
  );
}
