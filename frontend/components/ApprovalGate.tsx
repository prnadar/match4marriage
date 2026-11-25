"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { ShieldCheck, Loader2, ArrowRight, Check } from "lucide-react";
import { profileApi } from "@/lib/api";

/**
 * Trust gate for member-only discovery features (Browse, My Matches, Interests,
 * Messages). A member can only reach other people's profiles once an admin has
 * APPROVED their own profile (verification_status === "approved"). Until then we
 * show the membership journey (where they are, what's next, what opens up)
 * instead of the feature.
 *
 * draft / submitted / rejected / unset → locked. approved → render children.
 *
 * The lock decision depends ONLY on profileApi.me(). The completion call made
 * by the locked screen is decorative (progress + what's missing) and can fail
 * without changing what is shown or hidden.
 */

type VerifStatus = "draft" | "submitted" | "rejected" | "approved" | string;

interface CompletionInfo {
  /** 0-100, or null when the API didn't return a usable number. */
  score: number | null;
  /** Friendly labels of required fields still missing. */
  missing: string[];
}

const SURFACE = "linear-gradient(165deg,#170811 0%,#220c1a 45%,#0b0509 100%)";
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffd4dc]";

export function ApprovalGate({
  children,
  feature = "browse profiles",
}: {
  children: React.ReactNode;
  feature?: string;
}) {
  const [status, setStatus] = useState<VerifStatus | null>(null);
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await profileApi.me();
        const p = (res.data as any)?.data;
        setStatus((p?.verification_status as VerifStatus) ?? "draft");
        setFirstName(greetingName(p?.first_name));
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
        role="status"
        className="flex min-h-screen items-center justify-center"
        style={{ background: SURFACE }}
      >
        <Loader2 aria-hidden className="h-6 w-6 animate-spin text-[#f3c9a8]" strokeWidth={1.5} />
        <span className="sr-only">Checking your membership</span>
      </div>
    );
  }

  if (status === "approved") return <>{children}</>;

  return <LockedScreen status={status} feature={feature} firstName={firstName} />;
}

/** First word of the member's first name, or "" when it isn't safe to greet with. */
function greetingName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const first = raw.trim().split(/\s+/)[0] ?? "";
  return first.length > 0 && first.length <= 24 ? first : "";
}

type StepState = "done" | "current" | "upcoming";

interface Step {
  title: string;
  note: string;
  state: StepState;
  /** Short status word shown beside the current step. */
  tag?: string;
}

function LockedScreen({
  status,
  feature,
  firstName,
}: {
  status: VerifStatus | null;
  feature: string;
  firstName: string;
}) {
  const reduce = useReducedMotion();
  const submitted = status === "submitted";
  const rejected = status === "rejected";

  // Decorative only: real progress for the first step. Any failure → generic copy.
  const [completion, setCompletion] = useState<CompletionInfo | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await profileApi.getCompletion();
        const d = (res.data as any)?.data ?? res.data;
        if (cancelled || !d || !Array.isArray(d.missing)) return;
        const rawScore = Number(d.score);
        setCompletion({
          score: Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : null,
          missing: d.missing
            .map((m: any) => (typeof m?.label === "string" ? m.label.trim() : ""))
            .filter(Boolean),
        });
      } catch {
        /* keep the generic version */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Not yet submitted, but nothing required is missing → the next step is to submit.
  const readyToSubmit = !submitted && !rejected && completion !== null && completion.missing.length === 0;

  const heading = submitted
    ? firstName ? `Thank you, ${firstName}. Your profile is with our team.` : "Thank you. Your profile is with our team."
    : rejected
    ? firstName ? `${firstName}, a few details need a second look.` : "A few details need a second look."
    : readyToSubmit
    ? firstName ? `${firstName}, your profile is ready to submit.` : "Your profile is ready to submit."
    : firstName ? `Welcome, ${firstName}. Let’s get you verified.` : "Welcome. Let’s get you verified.";

  const message = submitted
    ? `Our team is reviewing your profile. We’ll notify you as soon as you’re verified, and this page will open automatically. Until then, only verified members can ${feature}.`
    : rejected
    ? `Before we can verify your profile, a few details need updating. Open your profile to see what’s needed, then resubmit. Only verified members can ${feature}.`
    : readyToSubmit
    ? `To keep our community trusted and secure, only verified members can ${feature}. Your profile is complete. Submit it for review and our team will take it from there.`
    : `To keep our community trusted and secure, only verified members can ${feature}. Complete your profile and have it approved by our team, and everything here opens to you.`;

  const currentIndex = submitted ? 2 : readyToSubmit ? 1 : 0;
  const stateAt = (i: number): StepState =>
    i < currentIndex ? "done" : i === currentIndex ? "current" : "upcoming";

  const missingNote =
    completion && completion.missing.length > 0
      ? `Still to add: ${completion.missing.slice(0, 3).join(", ")}${
          completion.missing.length > 3 ? `, and ${completion.missing.length - 3} more` : ""
        }.`
      : "Add your details and photos.";

  const steps: Step[] = [
    {
      title: "Complete your profile",
      state: stateAt(0),
      tag: rejected ? "Changes requested" : "In progress",
      note: rejected
        ? "Our team has asked for a few changes. Your profile shows what’s needed."
        : stateAt(0) === "done"
        ? "Your profile is complete."
        : missingNote,
    },
    {
      title: "Submit for review",
      state: stateAt(1),
      tag: "Ready",
      note:
        stateAt(1) === "done"
          ? "Your profile has been sent to our team."
          : stateAt(1) === "current"
          ? "Send your finished profile to our team from your profile page."
          : rejected
          ? "Resubmit once your changes are saved."
          : "Send your finished profile to our team.",
    },
    {
      title: "Reviewed by our team",
      state: stateAt(2),
      tag: "In review",
      note:
        stateAt(2) === "current"
          ? "Our team reviews submissions within 24 hours."
          : "Every profile is checked by our team before it is shown.",
    },
    {
      title: "Approved",
      state: stateAt(3),
      note: "Your membership opens in full.",
    },
  ];

  const showProgress = !submitted && !rejected && completion !== null && completion.score !== null;

  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
  };
  const item: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE_OUT } },
  };

  return (
    <section
      aria-labelledby="m4m-gate-title"
      className="relative min-h-screen overflow-x-hidden px-5 pb-32 pt-12 sm:px-10 sm:pt-16 lg:px-20 lg:pb-28 lg:pt-24"
      style={{ background: SURFACE, color: "#e7dde0" }}
    >
      <motion.div
        variants={container}
        initial={reduce ? false : "hidden"}
        animate="show"
        className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-y-14 lg:grid-cols-12 lg:gap-x-16 lg:gap-y-24"
      >
        {/* ── Welcome + the single action ─────────────────────────────── */}
        <div className="min-w-0 lg:col-span-7">
          <motion.p
            variants={item}
            className="font-nav text-[11.5px] font-semibold uppercase tracking-[0.22em] text-[#c89020] lg:text-[13px]"
          >
            Membership verification
          </motion.p>

          <motion.h1
            variants={item}
            id="m4m-gate-title"
            className="mt-5 font-display text-[32px] font-semibold leading-[1.12] text-white [overflow-wrap:anywhere] [text-wrap:balance] sm:text-[42px] lg:mt-7 lg:text-[58px] lg:leading-[1.08]"
          >
            {heading}
          </motion.h1>

          <motion.p
            variants={item}
            className="mt-5 max-w-[60ch] text-[15.5px] leading-[1.7] text-white/70 lg:mt-7 lg:text-[19px]"
          >
            {message}
          </motion.p>

          <motion.div variants={item} className="mt-8 flex flex-col items-stretch gap-5 sm:flex-row sm:items-center sm:gap-7 lg:mt-10">
            {submitted ? (
              <Link
                href="/profile/me"
                className={`group inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-7 py-3.5 font-nav text-[14px] font-semibold text-white/90 transition-colors duration-200 hover:border-[rgba(201,149,74,0.6)] hover:text-white lg:px-8 lg:py-4 lg:text-[16px] ${FOCUS_RING}`}
              >
                View your profile status
                <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            ) : (
              <Link
                href="/profile/me"
                className={`group inline-flex items-center sm:flex-shrink-0 sm:whitespace-nowrap justify-center gap-2 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-7 py-3.5 font-nav text-[14px] font-semibold text-white shadow-[0_6px_16px_rgba(0,0,0,0.35)] transition-[filter] duration-200 hover:brightness-110 lg:px-9 lg:py-4 lg:text-[16px] ${FOCUS_RING}`}
              >
                {rejected ? "Update your profile" : readyToSubmit ? "Review and submit your profile" : "Complete your profile"}
                <ArrowRight aria-hidden className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" />
              </Link>
            )}

            <p className="inline-flex items-center gap-2 text-[13px] leading-snug text-white/65 lg:text-[14.5px]">
              <ShieldCheck aria-hidden className="h-4 w-4 flex-shrink-0" style={{ color: "#86efac" }} strokeWidth={1.75} />
              Every member is identity-verified before being shown.
            </p>
          </motion.div>
        </div>

        {/* ── The journey ─────────────────────────────────────────────── */}
        <motion.div
          variants={item}
          className="min-w-0 border-t border-white/10 pt-10 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-16 lg:pt-1"
        >
          <h2 className="font-display text-[20px] font-semibold text-white lg:text-[24px]">
            Your membership journey
          </h2>

          <ol className="mt-7 lg:mt-9">
            {steps.map((step, i) => {
              const last = i === steps.length - 1;
              const isCurrent = step.state === "current";
              const isDone = step.state === "done";
              const attention = isCurrent && rejected;
              return (
                <li
                  key={step.title}
                  aria-current={isCurrent ? "step" : undefined}
                  className="relative flex gap-4 pb-8 last:pb-0 lg:gap-5 lg:pb-10"
                >
                  {/* Rail */}
                  {!last && (
                    <span aria-hidden className="absolute bottom-0 left-[11px] top-7 w-px bg-white/[0.12]">
                      {isDone && (
                        <motion.span
                          className="absolute inset-0 origin-top bg-[rgba(201,149,74,0.7)]"
                          initial={reduce ? false : { scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.45 + i * 0.18 }}
                        />
                      )}
                    </span>
                  )}

                  {/* Marker */}
                  <span aria-hidden className="relative mt-0.5 flex h-[23px] w-[23px] flex-shrink-0 items-center justify-center">
                    {isDone ? (
                      <span className="flex h-full w-full items-center justify-center rounded-full border border-[rgba(201,149,74,0.7)]">
                        <Check className="h-3 w-3" style={{ color: "#86efac" }} strokeWidth={2.5} />
                      </span>
                    ) : isCurrent ? (
                      <>
                        {submitted && !reduce && (
                          <motion.span
                            className="absolute inset-0 rounded-full border border-[#f3c9a8]"
                            animate={{ scale: [1, 2.1], opacity: [0.55, 0] }}
                            transition={{ duration: 2.8, ease: "easeOut", repeat: Infinity, repeatDelay: 0.7 }}
                          />
                        )}
                        <span
                          className="flex h-full w-full items-center justify-center rounded-full border"
                          style={{ borderColor: attention ? "#ff8aa3" : "#c89020" }}
                        >
                          <span
                            className="h-[9px] w-[9px] rounded-full"
                            style={{ background: attention ? "#ff8aa3" : "#f3c9a8" }}
                          />
                        </span>
                      </>
                    ) : (
                      <span className="h-full w-full rounded-full border border-white/25" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <p
                        className={`text-[15.5px] font-semibold leading-snug lg:text-[18px] ${
                          step.state === "upcoming" ? "text-white/70" : "text-white"
                        }`}
                      >
                        {step.title}
                      </p>
                      {isCurrent && step.tag && (
                        <span
                          className="font-nav text-[10.5px] font-semibold uppercase tracking-[0.16em] lg:text-[12px]"
                          style={{ color: attention ? "#ff8aa3" : "#f3c9a8" }}
                        >
                          {step.tag}
                        </span>
                      )}
                      <span className="sr-only">
                        {isDone ? "Completed." : isCurrent ? "Current step." : "Not yet started."}
                      </span>
                    </div>

                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65 [overflow-wrap:anywhere] lg:text-[15.5px]">
                      {step.note}
                    </p>

                    {i === 0 && isCurrent && showProgress && completion?.score != null && (
                      <motion.div
                        className="mt-4 flex items-center gap-4"
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.4, ease: EASE_OUT }}
                      >
                        <div
                          role="progressbar"
                          aria-label="Profile completeness"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={completion.score}
                          className="relative h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.12]"
                        >
                          <motion.span
                            className="absolute inset-0 origin-left rounded-full bg-[#c89020]"
                            initial={reduce ? false : { scaleX: 0 }}
                            animate={{ scaleX: completion.score / 100 }}
                            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 }}
                          />
                        </div>
                        <span className="font-nav text-[12.5px] font-semibold tabular-nums text-[#f3c9a8] lg:text-[14px]">
                          {completion.score}% complete
                        </span>
                      </motion.div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </motion.div>

        {/* ── What opens up ───────────────────────────────────────────── */}
        <motion.div variants={item} className="min-w-0 lg:col-span-12">
          <h2 className="font-display text-[20px] font-semibold text-white lg:text-[24px]">
            Once you’re verified
          </h2>
          <ul className="mt-6 grid grid-cols-1 gap-x-12 sm:grid-cols-2 lg:mt-8 lg:grid-cols-4">
            {UNLOCKS.map((u) => (
              <li key={u.title} className="border-t border-[rgba(201,149,74,0.28)] py-5 lg:py-6">
                <p className="font-display text-[17px] font-semibold text-white lg:text-[20px]">{u.title}</p>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65 lg:text-[15.5px]">{u.body}</p>
              </li>
            ))}
          </ul>
        </motion.div>
      </motion.div>
    </section>
  );
}

/** Mirrors the member navigation — only things that exist today. */
const UNLOCKS: Array<{ title: string; body: string }> = [
  { title: "My Matches", body: "A daily selection of profiles chosen for you." },
  { title: "Browse", body: "Explore the profiles of verified members." },
  { title: "Interests", body: "Express interest, and see who is interested in you." },
  { title: "Messages", body: "Private conversations with other members." },
];
