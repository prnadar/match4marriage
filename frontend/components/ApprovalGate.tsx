"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Lock, Clock, AlertTriangle, Loader2, ArrowRight } from "lucide-react";
import { profileApi } from "@/lib/api";

/**
 * Trust gate for member-only discovery features (Browse, My Matches, Interests,
 * Messages). A member can only reach other people's profiles once an admin has
 * APPROVED their own profile (verification_status === "approved"). Until then we
 * show a friendly "complete & get approved" screen instead of the feature.
 *
 * draft / submitted / rejected / unset → locked. approved → render children.
 */

type VerifStatus = "draft" | "submitted" | "rejected" | "approved" | string;

export function ApprovalGate({
  children,
  feature = "browse profiles",
}: {
  children: React.ReactNode;
  feature?: string;
}) {
  const [status, setStatus] = useState<VerifStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data;
        setStatus((p?.verification_status as VerifStatus) ?? "draft");
      } catch {
        // If we can't confirm approval, fail closed — never expose the feature.
        setStatus("draft");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)" }}
      >
        <Loader2 className="h-7 w-7 animate-spin text-[#ff8aa3]" />
      </div>
    );
  }

  if (status === "approved") return <>{children}</>;

  return <LockedScreen status={status} feature={feature} />;
}

function LockedScreen({ status, feature }: { status: VerifStatus | null; feature: string }) {
  const submitted = status === "submitted";
  const rejected = status === "rejected";

  const Icon = submitted ? Clock : rejected ? AlertTriangle : Lock;
  const accent = submitted ? "#f3c9a8" : rejected ? "#ff8aa3" : "#ff8aa3";

  const heading = submitted
    ? "Your profile is under review"
    : rejected
    ? "Your profile needs changes"
    : "Verification required";

  // Requested copy — shown to anyone who hasn't been approved yet.
  const baseMessage =
    "To maintain a trusted and secure community, only verified members can " +
    `${feature}. Please complete and get your profile approved to continue.`;

  const subMessage = submitted
    ? "Thanks for submitting! Our team is reviewing your profile. We'll notify you as soon as you're verified — then this unlocks automatically."
    : rejected
    ? "A few details need updating before we can verify your profile. Open your profile to see what's needed and resubmit."
    : baseMessage;

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 py-16"
      style={{ background: "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)", color: "#e7dde0" }}
    >
      {/* Ambient backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <span className="m4m-aura m4m-aura-rose" />
        <span className="m4m-aura m4m-aura-gold" />
        <span className="m4m-aura-vignette" />
      </div>

      <div className="fade-in-up relative w-full max-w-md rounded-[24px] border border-white/12 bg-white/[0.045] px-8 py-10 text-center shadow-[0_18px_50px_rgba(0,0,0,0.45)] backdrop-blur-md">
        <div
          className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <Icon className="h-7 w-7" style={{ color: accent }} strokeWidth={1.8} />
        </div>

        <h1 className="font-display text-[24px] font-semibold leading-tight text-white">
          {heading}
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-white/65">
          {subMessage}
        </p>

        <div className="mt-7 flex flex-col items-center gap-3">
          {!submitted && (
            <Link
              href="/profile/me"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-6 py-3 text-[14px] font-semibold text-white shadow-[0_8px_22px_rgba(220,30,60,0.30)] transition-shadow hover:shadow-[0_10px_28px_rgba(220,30,60,0.42)]"
            >
              {rejected ? "Update your profile" : "Complete your profile"}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          {submitted && (
            <Link
              href="/profile/me"
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-6 py-3 text-[14px] font-semibold text-white/85 transition-colors hover:border-white/25 hover:text-white"
            >
              View your profile status
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
          <p className="inline-flex items-center gap-1.5 text-[12px] text-white/40">
            <ShieldCheck className="h-3.5 w-3.5" style={{ color: "#86efac" }} />
            Every member is identity-verified before being shown.
          </p>
        </div>
      </div>

      <style jsx>{`.m4m-aura{position:absolute;border-radius:50%;filter:blur(120px);pointer-events:none;}.m4m-aura-rose{width:540px;height:540px;top:-150px;right:-120px;background:radial-gradient(circle,rgba(220,30,60,0.5),transparent 60%);opacity:.45;}.m4m-aura-gold{width:560px;height:560px;bottom:-190px;left:-150px;background:radial-gradient(circle,rgba(201,149,74,0.4),transparent 60%);opacity:.4;}.m4m-aura-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.5) 100%);}`}</style>
    </div>
  );
}
