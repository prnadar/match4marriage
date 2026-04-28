"use client";

import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

/**
 * Honest "feature in development" stub.
 *
 * Use this where the page used to render mock data. It states what's coming,
 * why it's not live yet, and gives the user a real next step — instead of
 * fake profiles / fake stats that misrepresent the product.
 */
export function ComingSoon({
  kicker,
  title,
  body,
  bullets,
  primaryHref = "/dashboard",
  primaryLabel = "Back to dashboard",
  secondaryHref,
  secondaryLabel,
  icon,
}: {
  kicker?: string;
  title: string;
  body: string;
  bullets?: string[];
  primaryHref?: string;
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-60px)]" style={{ background: "#fdfbf9" }}>
      <div className="mx-auto max-w-[760px] px-6 py-16 lg:py-24">
        <div className="fade-in-up rounded-3xl border border-rose-100/70 bg-white p-8 text-center shadow-[0_4px_24px_rgba(220,30,60,0.06)] sm:p-12">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 ring-1 ring-rose-100">
            {icon ?? <Sparkles className="h-6 w-6 text-rose-700" />}
          </div>
          {kicker && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-rose-700/80">
              {kicker}
            </p>
          )}
          <h1 className="font-display mt-2 text-[28px] font-semibold leading-tight text-[#1a0a14] sm:text-[32px]">
            {title}
          </h1>
          <p className="mx-auto mt-3 max-w-[520px] text-[14px] leading-relaxed text-[#6a5560]">
            {body}
          </p>

          {bullets && bullets.length > 0 && (
            <ul className="mx-auto mt-6 max-w-[480px] space-y-2 text-left">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] text-[#1a0a14]/80">
                  <span className="mt-1 inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-rose-500" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-br from-[#dc1e3c] to-[#a0153c] px-5 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(220,30,60,0.28)] transition-all hover:shadow-[0_10px_26px_rgba(220,30,60,0.38)]"
            >
              {primaryLabel}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            {secondaryHref && secondaryLabel && (
              <Link
                href={secondaryHref}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-rose-700 ring-1 ring-rose-100 transition-colors hover:bg-rose-50"
              >
                {secondaryLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ComingSoon;
