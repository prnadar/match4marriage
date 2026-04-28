"use client";

/**
 * Tiny inline-SVG country flag for premium UI.
 *
 * Designed to replace 🇬🇧 / 🇮🇳 / 🇺🇸 / 🇨🇦 / 🇦🇺 / 🇦🇪 / 🇸🇬 / 🇩🇪 / 🇫🇷 emoji
 * usage across the app. Each flag is a hand-rolled simplified SVG that:
 *   - reads cleanly at 16–24px
 *   - has a subtle inner shadow + 1px hairline border
 *   - is aspect-correct (3:2)
 *
 * Pass `code="GB"` (ISO-3166 alpha-2). Unknown codes render a neutral grey
 * card with the country code text.
 */

import { cn } from "@/lib/utils";

export type CountryCode =
  | "GB" | "IN" | "US" | "CA" | "AU" | "AE" | "SG" | "DE" | "FR" | "NZ" | "MY" | "NL";

const FLAGS: Record<CountryCode, React.ReactNode> = {
  GB: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="6" />
      <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="10" />
      <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="6" />
    </svg>
  ),
  IN: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect y="0"  width="60" height="13.33" fill="#FF9933" />
      <rect y="13.33" width="60" height="13.34" fill="#fff" />
      <rect y="26.67" width="60" height="13.33" fill="#138808" />
      <circle cx="30" cy="20" r="4" fill="none" stroke="#000080" strokeWidth="0.6" />
      <circle cx="30" cy="20" r="1" fill="#000080" />
    </svg>
  ),
  US: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect width="60" height="40" fill="#fff" />
      {[0,1,2,3,4,5,6].map((i) => (
        <rect key={i} y={i * 5.71} width="60" height="2.85" fill="#B22234" />
      ))}
      <rect width="24" height="20" fill="#3C3B6E" />
      <g fill="#fff">
        {[2,6,10,14,18].map((y) => (
          [3,9,15,21].map((x) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="0.7" />
          ))
        ))}
      </g>
    </svg>
  ),
  CA: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect x="0"  width="15" height="40" fill="#D52B1E" />
      <rect x="45" width="15" height="40" fill="#D52B1E" />
      <rect x="15" width="30" height="40" fill="#fff" />
      <path d="M30 12 L32 18 L37 16 L34 22 L40 22 L34 26 L36 31 L30 28 L24 31 L26 26 L20 22 L26 22 L23 16 L28 18 Z" fill="#D52B1E" />
    </svg>
  ),
  AU: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect width="60" height="40" fill="#012169" />
      <g transform="scale(0.5)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="6" />
        <path d="M0 0 L60 40 M60 0 L0 40" stroke="#C8102E" strokeWidth="3" />
        <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
      <g fill="#fff">
        <circle cx="42" cy="14" r="1.4" />
        <circle cx="48" cy="20" r="1.6" />
        <circle cx="50" cy="28" r="1.2" />
        <circle cx="44" cy="32" r="1.4" />
        <circle cx="38" cy="26" r="1.0" />
      </g>
    </svg>
  ),
  AE: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect x="10" y="0"  width="50" height="13.33" fill="#00732F" />
      <rect x="10" y="13.33" width="50" height="13.34" fill="#fff" />
      <rect x="10" y="26.67" width="50" height="13.33" fill="#000" />
      <rect x="0"  y="0"  width="10" height="40" fill="#FF0000" />
    </svg>
  ),
  SG: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect y="0"  width="60" height="20" fill="#EF3340" />
      <rect y="20" width="60" height="20" fill="#fff" />
      <circle cx="14" cy="10" r="6" fill="#fff" />
      <circle cx="17" cy="10" r="5" fill="#EF3340" />
      <g fill="#fff">
        <circle cx="11"   cy="9"  r="0.7" />
        <circle cx="13"   cy="6"  r="0.7" />
        <circle cx="16"   cy="6"  r="0.7" />
        <circle cx="19"   cy="9"  r="0.7" />
        <circle cx="14.5" cy="11" r="0.7" />
      </g>
    </svg>
  ),
  DE: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect y="0"     width="60" height="13.33" fill="#000" />
      <rect y="13.33" width="60" height="13.34" fill="#DD0000" />
      <rect y="26.67" width="60" height="13.33" fill="#FFCE00" />
    </svg>
  ),
  FR: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect x="0"  width="20" height="40" fill="#0055A4" />
      <rect x="20" width="20" height="40" fill="#fff" />
      <rect x="40" width="20" height="40" fill="#EF4135" />
    </svg>
  ),
  NZ: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect width="60" height="40" fill="#012169" />
      <g transform="scale(0.5)">
        <rect width="60" height="40" fill="#012169" />
        <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="6" />
        <path d="M30 0 V40 M0 20 H60" stroke="#fff" strokeWidth="10" />
        <path d="M30 0 V40 M0 20 H60" stroke="#C8102E" strokeWidth="6" />
      </g>
      <g fill="#C8102E" stroke="#fff" strokeWidth="0.6">
        <circle cx="44" cy="14" r="1.6" />
        <circle cx="50" cy="22" r="1.6" />
        <circle cx="46" cy="30" r="1.6" />
        <circle cx="40" cy="24" r="1.6" />
      </g>
    </svg>
  ),
  MY: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect width="60" height="40" fill="#fff" />
      {[0,2,4,6,8,10,12].map((i) => (
        <rect key={i} y={i * 2.85} width="60" height="2.85" fill="#CC0001" />
      ))}
      <rect width="30" height="22.85" fill="#010066" />
      <circle cx="14" cy="11" r="6" fill="#FFCC00" />
      <circle cx="16" cy="11" r="5" fill="#010066" />
    </svg>
  ),
  NL: (
    <svg viewBox="0 0 60 40" className="h-full w-full">
      <rect y="0"     width="60" height="13.33" fill="#AE1C28" />
      <rect y="13.33" width="60" height="13.34" fill="#fff" />
      <rect y="26.67" width="60" height="13.33" fill="#21468B" />
    </svg>
  ),
};

export function CountryFlag({
  code,
  className,
  rounded = "sm",
  ariaLabel,
}: {
  code: CountryCode | string;
  className?: string;
  rounded?: "sm" | "md" | "full" | "none";
  ariaLabel?: string;
}) {
  const radius =
    rounded === "full" ? "rounded-full" :
    rounded === "md"   ? "rounded-md" :
    rounded === "sm"   ? "rounded-[3px]" :
    "";

  const flag = FLAGS[code as CountryCode];

  return (
    <span
      role="img"
      aria-label={ariaLabel ?? `${code} flag`}
      className={cn(
        "inline-block overflow-hidden align-middle ring-1 ring-black/10 shadow-[inset_0_-1px_0_rgba(0,0,0,0.06)]",
        radius,
        className,
      )}
      style={{ width: "1.25em", aspectRatio: "3 / 2", lineHeight: 1 }}
    >
      {flag ?? (
        <span className="flex h-full w-full items-center justify-center bg-rose-50 text-[8px] font-semibold text-rose-700">
          {String(code).slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  );
}

export default CountryFlag;
