"use client";

import Link from "next/link";
import { useState } from "react";
import {
  MapPin, Briefcase, GraduationCap, ShieldCheck, BadgeCheck, Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Portrait } from "./portrait";
import { Tilt3D } from "./tilt-3d";
import { HeartButton } from "./heart-button";

/** Compatibility ring — small SVG donut with a stroke arc (no extra deps). */
function CompatibilityRing({ value, size = 44, stroke = 4 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  const offset = c - (v / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="rgba(253,251,249,0.85)" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="rgba(26,10,20,0.10)" strokeWidth={stroke} fill="none"
      />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        stroke="url(#m4mCompatGrad)" strokeWidth={stroke} fill="none"
        strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
      />
      <defs>
        <linearGradient id="m4mCompatGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#C9954A" />
          <stop offset="100%" stopColor="#dc1e3c" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export interface ProfileCardData {
  id: string;
  name: string;
  age?: number;
  city?: string;
  state?: string;
  profession?: string;
  company?: string;
  education?: string;
  religion?: string;
  height?: string;
  verified?: boolean;
  premium?: boolean;
  trustScore?: number;
  compatibility?: number;
  about?: string;
  photoUrl?: string | null;
  gender?: "male" | "female" | string;
  /** Optional pill shown top-left ("Top Match", "Featured", etc.) */
  ribbon?: string;
}

/**
 * Premium ProfileCard.
 *
 * Two visual densities:
 *   variant="grid"    — compact, 4–5 per row in a browse grid
 *   variant="feature" — larger, 2–3 per row in a curated feed (default)
 *
 * Photo-forward; metadata in glass chip overlays + bottom info strip.
 * Single canonical card used by Dashboard, Matches, Profiles list, etc.
 */
export function ProfileCard({
  data,
  variant = "feature",
  liked,
  onToggleLike,
  href,
  className,
  showActions = true,
  index = 0,
}: {
  data: ProfileCardData;
  variant?: "grid" | "feature";
  liked?: boolean;
  onToggleLike?: (id: string) => void;
  href?: string;
  className?: string;
  showActions?: boolean;
  index?: number;
}) {
  const [hover, setHover] = useState(false);
  const detailHref = href ?? `/profile/${data.id}`;

  const photoH = variant === "grid" ? "h-[220px]" : "h-[260px]";
  const tag = data.ribbon;

  return (
    <Tilt3D max={5} scale={1.02} className="fade-in-up" >
    <Link
      href={detailHref}
      className={cn(
        "group relative block overflow-hidden bg-white",
        "rounded-[22px] border border-rose-100/70",
        "shadow-luxe transition-[box-shadow] duration-300",
        "hover:shadow-luxe-hover",
        className,
      )}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Photo zone */}
      <div className={cn("relative w-full overflow-hidden", photoH)}>
        <Portrait
          src={data.photoUrl}
          name={data.name}
          seed={data.id}
          gender={data.gender}
          rounded="none"
          showInitials={!data.photoUrl}
          className={cn(
            "absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(.2,.7,.2,1)]",
            hover ? "scale-[1.04]" : "scale-100",
          )}
        />

        {/* Top-left ribbon */}
        {tag && (
          <div
            className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 backdrop-blur"
            style={{
              background: "rgba(220,30,60,0.92)",
              boxShadow: "0 4px 14px rgba(220,30,60,0.28)",
            }}
          >
            <Sparkles className="h-3 w-3 text-white" />
            <span
              className="text-[10px] font-semibold uppercase tracking-wider text-white"
              style={{ letterSpacing: "0.12em" }}
            >
              {tag}
            </span>
          </div>
        )}

        {/* Top-right verified + trust */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          {data.verified && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-rose-700 backdrop-blur"
              style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.10)" }}
            >
              <BadgeCheck className="h-3 w-3" />
              Verified
            </span>
          )}
          {data.premium && (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
              style={{ background: "linear-gradient(135deg,#C9954A,#8A5E20)" }}
            >
              Gold
            </span>
          )}
        </div>

        {/* Like (heart) — bottom-right corner of photo */}
        {showActions && onToggleLike && (
          <div className="absolute bottom-3 right-3">
            <HeartButton
              liked={!!liked}
              onToggle={() => onToggleLike(data.id)}
              size={38}
            />
          </div>
        )}

        {/* Compatibility ring — bottom-left of photo */}
        {typeof data.compatibility === "number" && data.compatibility > 0 && (
          <div className="absolute bottom-3 left-3">
            <div className="relative">
              <CompatibilityRing value={data.compatibility} />
              <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                <span
                  className="font-display font-semibold text-rose-700"
                  style={{ fontSize: "12px" }}
                >
                  {data.compatibility}
                </span>
                <span
                  className="text-[8px] uppercase tracking-wider text-rose-700/70"
                  style={{ marginTop: 1 }}
                >
                  match
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Name overlay (bottom of photo) */}
        <div className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12 pr-16">
          <h3
            className="font-display text-white"
            style={{
              fontSize: variant === "grid" ? "1.05rem" : "1.25rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              textShadow: "0 2px 14px rgba(0,0,0,0.5)",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}
          >
            {data.name}
            {typeof data.age === "number" && data.age > 0 && (
              <span className="font-normal opacity-90">, {data.age}</span>
            )}
          </h3>
          <div
            className="mt-1 flex items-center gap-1 text-[12px] text-white/85"
            style={{ textShadow: "0 1px 6px rgba(0,0,0,0.5)" }}
          >
            {data.city && (
              <>
                <MapPin className="h-3 w-3" />
                <span className="truncate">
                  {[data.city, data.state].filter(Boolean).join(", ")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Info / chip strip */}
      <div className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {data.profession && (
            <Chip icon={<Briefcase className="h-3 w-3" />}>
              {[data.profession, data.company].filter(Boolean).join(" · ")}
            </Chip>
          )}
          {data.education && (
            <Chip icon={<GraduationCap className="h-3 w-3" />}>
              {data.education}
            </Chip>
          )}
          {data.height && <Chip>{data.height}</Chip>}
          {data.religion && <Chip>{data.religion}</Chip>}
          {typeof data.trustScore === "number" && data.trustScore > 0 && (
            <Chip icon={<ShieldCheck className="h-3 w-3 text-emerald-700" />}>
              Trust {data.trustScore}
            </Chip>
          )}
        </div>
      </div>
    </Link>
    </Tilt3D>
  );
}

function Chip({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex max-w-full items-center gap-1 rounded-full bg-rose-50/70 px-2.5 py-1 text-[11px] font-medium text-rose-900/80 ring-1 ring-rose-100"
      style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

export default ProfileCard;
