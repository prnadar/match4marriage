"use client";

import { cn } from "@/lib/utils";

/**
 * Premium photo / portrait fallback.
 *
 * - When `src` is provided, shows the image with a subtle bottom darken
 *   gradient (so legibility of overlaid name/badges is reliable).
 * - When `src` is missing, shows a deterministic elegant gradient + a
 *   tonal portrait silhouette + soft Playfair initials. No "demo data"
 *   feel.
 */

const PALETTES: Array<{ from: string; to: string; tone: string }> = [
  // Rose blush
  { from: "#F4B4C0", to: "#9F2A4A", tone: "rgba(255,255,255,0.18)" },
  // Champagne gold
  { from: "#E9CFA1", to: "#9A6B00", tone: "rgba(255,255,255,0.16)" },
  // Sage moss
  { from: "#B7CFB1", to: "#3F5C42", tone: "rgba(255,255,255,0.14)" },
  // Dusk indigo
  { from: "#A4A8D0", to: "#3B3F86", tone: "rgba(255,255,255,0.16)" },
  // Terracotta
  { from: "#E8B59A", to: "#8C3D1F", tone: "rgba(255,255,255,0.16)" },
  // Plum
  { from: "#D2B0CE", to: "#5A2A56", tone: "rgba(255,255,255,0.16)" },
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function Portrait({
  src,
  alt,
  name,
  seed,
  gender,
  className,
  rounded = "card",
  showInitials = true,
}: {
  src?: string | null;
  alt?: string;
  name?: string;
  seed?: string;
  gender?: "male" | "female" | string;
  className?: string;
  rounded?: "card" | "full" | "none";
  showInitials?: boolean;
}) {
  const radiusClass =
    rounded === "full" ? "rounded-full" : rounded === "none" ? "" : "rounded-2xl";

  if (src) {
    return (
      <div className={cn("relative overflow-hidden", radiusClass, className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || name || ""}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Subtle bottom darken for label legibility */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, transparent 55%, rgba(20,8,14,0.45) 100%)",
          }}
        />
      </div>
    );
  }

  const key = seed || name || "anon";
  const p = PALETTES[hashString(key) % PALETTES.length];

  const initials =
    (name || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase() || "·";

  const figureStroke = "rgba(255,255,255,0.55)";
  const figureFill = "rgba(255,255,255,0.10)";

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        radiusClass,
        className,
      )}
      role="img"
      aria-label={alt || name || "Member portrait"}
    >
      {/* Base gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(135deg, ${p.from} 0%, ${p.to} 100%)`,
        }}
      />
      {/* Tonal radial highlight, top-left */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(120% 80% at 25% 15%, ${p.tone} 0%, transparent 55%)`,
        }}
      />

      {/* Soft portrait silhouette */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-x-0 bottom-0 w-full"
        style={{ height: "78%" }}
        aria-hidden="true"
      >
        {/* Shoulders / bust */}
        <path
          d="M 8 100 C 12 70 30 60 50 60 C 70 60 88 70 92 100 Z"
          fill={figureFill}
          stroke={figureStroke}
          strokeWidth="0.8"
        />
        {/* Head */}
        <circle
          cx="50"
          cy="42"
          r="14"
          fill={figureFill}
          stroke={figureStroke}
          strokeWidth="0.8"
        />
        {gender === "female" && (
          // Subtle dupatta hint
          <path
            d="M 26 56 C 38 48 62 48 74 56"
            fill="none"
            stroke={figureStroke}
            strokeWidth="0.8"
            opacity="0.7"
          />
        )}
      </svg>

      {/* Initials, top-center, Playfair italic */}
      {showInitials && (
        <div className="absolute inset-x-0 top-0 flex justify-center pt-3">
          <span
            className="font-display italic"
            style={{
              fontSize: "clamp(11px, 1.1vw, 13px)",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.82)",
              textShadow: "0 1px 8px rgba(0,0,0,0.18)",
            }}
          >
            {initials}
          </span>
        </div>
      )}

      {/* Bottom darken (for name overlays) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 55%, rgba(20,8,14,0.55) 100%)",
        }}
      />
    </div>
  );
}

export default Portrait;
