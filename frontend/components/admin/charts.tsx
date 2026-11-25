"use client";

/**
 * Lightweight, dependency-free SVG charts for the admin console.
 *
 * Mark specs follow the console's data-viz rules: columns ≤24px wide with a
 * 4px rounded data-end and a square baseline, hairline recessive gridlines,
 * text in text tokens (never series colour), a hover tooltip on every mark,
 * and a visually-hidden table for screen readers.
 *
 * Palette (validated: CVD + normal-vision separation pass on light surface):
 *   categorical  slate-blue #3B5BA9 · ruby #DC1E3C · gold #C9954A (gold < 3:1 → always direct-labelled)
 *   sequential   ruby ramp  #F08DA0 → #DC1E3C → #8A0820 (ordered tiers)
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export const SERIES = { blue: "#3B5BA9", ruby: "#DC1E3C", gold: "#C9954A", neutral: "#B9AEB3" } as const;
export const RUBY_RAMP = ["#F08DA0", "#DC1E3C", "#8A0820"] as const;

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((entries) => setW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number): number {
  if (v <= 0) return 4;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nf = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  const out = nf * exp;
  return out < 4 && Number.isInteger(v) ? Math.max(4, Math.ceil(v)) : out;
}

function compactTick(n: number): string {
  if (Math.abs(n) >= 10000) return new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  return Number.isInteger(n) ? n.toLocaleString("en-GB") : n.toFixed(1);
}

// ─── Column chart (single series over time) ─────────────────────────────────

export type ColumnDatum = { key: string; label: string; value: number; tooltip?: string };

export function ColumnChart({
  data, height = 200, color = SERIES.ruby, formatValue = (v) => v.toLocaleString("en-GB"),
  formatTick, tickEvery, ariaLabel, highlightLast = false, valueLabel = "Value",
}: {
  data: ColumnDatum[];
  height?: number;
  color?: string;
  formatValue?: (v: number) => string;
  /** y-axis tick formatter (defaults to compact numbers) */
  formatTick?: (v: number) => string;
  /** show every Nth x label (auto when omitted) */
  tickEvery?: number;
  ariaLabel: string;
  /** render the last (current, partial) period lighter */
  highlightLast?: boolean;
  valueLabel?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const padL = 40, padR = 8, padT = 10, padB = 22;
  const innerW = Math.max(0, width - padL - padR);
  const innerH = height - padT - padB;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const ticks = [0, max / 2, max];
  const band = data.length ? innerW / data.length : 0;
  const gap = Math.max(2, Math.min(8, band * 0.28));
  const barW = Math.max(1, Math.min(24, band - gap));
  const every = tickEvery || Math.max(1, Math.ceil((data.length * 44) / Math.max(1, innerW)));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const fmtTick = formatTick || compactTick;

  const hovered = hover !== null ? data[hover] : null;
  const tipX = hover !== null ? padL + band * hover + band / 2 : 0;

  return (
    <div ref={ref} className="relative w-full select-none" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="hsl(var(--border))" strokeWidth={1} />
              <text x={padL - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted2-foreground" style={{ fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                {fmtTick(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(2, (d.value / max) * innerH) : 0;
            const x = padL + band * i + (band - barW) / 2;
            const top = padT + innerH - h;
            const r = Math.min(4, barW / 2, h);
            const isLast = i === data.length - 1;
            const opacity = hover === null ? (highlightLast && isLast ? 0.55 : 1) : hover === i ? 1 : 0.45;
            return (
              <g key={d.key}>
                {h > 0 && (
                  <path
                    d={`M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`}
                    fill={color}
                    opacity={opacity}
                    style={{ transition: "opacity 120ms ease-out" }}
                  />
                )}
                {/* hit target: full band height */}
                <rect
                  x={padL + band * i} y={padT} width={band} height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
                {i % every === 0 && (
                  <text x={padL + band * i + band / 2} y={height - 6} textAnchor="middle" className="fill-muted2-foreground" style={{ fontSize: 11 }}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {hovered && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] shadow-[0_4px_14px_rgba(26,10,20,0.12)]"
          style={{ left: Math.min(Math.max(tipX, 60), Math.max(60, width - 60)) }}
        >
          <div className="text-muted2-foreground">{hovered.tooltip || hovered.label}</div>
          <div className="font-semibold text-foreground tabular-nums">{formatValue(hovered.value)}</div>
        </div>
      )}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead><tr><th>Period</th><th>{valueLabel}</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.key}><td>{d.tooltip || d.label}</td><td>{formatValue(d.value)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

// ─── Segmented bar (one whole split into parts) ─────────────────────────────

export type Segment = { key: string; label: string; value: number; color: string; hint?: string };

export function SegmentBar({ segments, ariaLabel, formatValue = (v) => v.toLocaleString("en-GB"), showLegend = true }: {
  segments: Segment[];
  ariaLabel: string;
  formatValue?: (v: number) => string;
  showLegend?: boolean;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div>
      <div className="flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-secondary" role="img" aria-label={`${ariaLabel}: ${segments.map((s) => `${s.label} ${formatValue(s.value)}`).join(", ")}`}>
        {total > 0 && segments.filter((s) => s.value > 0).map((s) => (
          <div
            key={s.key}
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
            title={`${s.label}: ${formatValue(s.value)} (${Math.round((s.value / total) * 100)}%)`}
            className="h-full first:rounded-l-full last:rounded-r-full transition-opacity duration-150"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color, opacity: hover && hover !== s.key ? 0.45 : 1 }}
          />
        ))}
      </div>
      {showLegend && (
        <ul className="mt-3 space-y-1.5">
          {segments.map((s) => {
            const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
            return (
              <li
                key={s.key}
                onMouseEnter={() => setHover(s.key)}
                onMouseLeave={() => setHover(null)}
                className={cn("flex items-center gap-2 rounded px-1 py-0.5 text-[12.5px] transition-colors", hover === s.key && "bg-secondary/70")}
              >
                <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
                <span className="flex-1 truncate text-foreground">{s.label}</span>
                {s.hint && <span className="text-muted2-foreground">{s.hint}</span>}
                <span className="w-14 text-right font-medium tabular-nums text-foreground">{formatValue(s.value)}</span>
                <span className="w-9 text-right tabular-nums text-muted2-foreground">{pct}%</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Horizontal bar list (ranked categories) ────────────────────────────────

export function BarList({ items, color = SERIES.blue, formatValue = (v) => v.toLocaleString("en-GB"), ariaLabel, max: maxItems = 8 }: {
  items: Array<{ key: string; label: string; value: number }>;
  color?: string;
  formatValue?: (v: number) => string;
  ariaLabel: string;
  max?: number;
}) {
  const shown = items.slice(0, maxItems);
  const top = Math.max(1, ...shown.map((i) => i.value));
  const total = items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="space-y-2" aria-label={ariaLabel}>
      {shown.map((it) => {
        const pct = total > 0 ? Math.round((it.value / total) * 100) : 0;
        return (
          <li key={it.key} className="group" title={`${it.label}: ${formatValue(it.value)} (${pct}%)`}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[12.5px]">
              <span className="truncate capitalize text-foreground">{it.label}</span>
              <span className="shrink-0 tabular-nums text-muted2-foreground">
                <span className="font-medium text-foreground">{formatValue(it.value)}</span> · {pct}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary">
              <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${(it.value / top) * 100}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ─── Funnel ─────────────────────────────────────────────────────────────────

export function Funnel({ stages, color = SERIES.ruby }: {
  stages: Array<{ key: string; label: string; value: number; href?: string; hint?: string }>;
  color?: string;
}) {
  const first = Math.max(1, stages[0]?.value || 0);
  return (
    <ol className="space-y-3">
      {stages.map((s, i) => {
        const prev = i > 0 ? stages[i - 1].value : null;
        const step = prev ? Math.round((s.value / prev) * 100) : null;
        const ofTotal = Math.round((s.value / first) * 100);
        return (
          <li key={s.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className="text-foreground">
                <span className="mr-1.5 tabular-nums text-muted2-foreground">{i + 1}.</span>{s.label}
              </span>
              <span className="shrink-0 tabular-nums text-muted2-foreground">
                <span className="font-semibold text-foreground">{s.value.toLocaleString("en-GB")}</span>
                {i > 0 && <> · {ofTotal}% of sign-ups</>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 flex-1 rounded-[4px] bg-secondary/80">
                <div
                  className="h-full rounded-[4px] transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.max(s.value > 0 ? 1.5 : 0, (s.value / first) * 100)}%`, background: color }}
                />
              </div>
              <span className="w-[86px] shrink-0 text-right text-[11.5px] tabular-nums text-muted2-foreground">
                {step !== null ? `${step}% from prev.` : ""}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Helpers to shape series ────────────────────────────────────────────────

/** Fill a sparse [{date,count}] daily series into a dense window ending today. */
export function denseDaily(series: Array<{ date: string; count: number }>, days: number): ColumnDatum[] {
  const map = new Map(series.map((s) => [s.date, s.count]));
  const out: ColumnDatum[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
    const key = d.toISOString().slice(0, 10);
    out.push({
      key,
      label: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      tooltip: d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
      value: map.get(key) || 0,
    });
  }
  return out;
}

/** Bucket a dense daily series into weeks (for 90-day views). */
export function weekly(daily: ColumnDatum[]): ColumnDatum[] {
  const out: ColumnDatum[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    const first = chunk[0];
    out.push({
      key: first.key,
      label: first.label,
      tooltip: `Week of ${first.label}`,
      value: chunk.reduce((s, d) => s + d.value, 0),
    });
  }
  return out;
}

/** Last 12 calendar months, filled, from [{month:'YYYY-MM', paise}]. */
export function denseMonths(series: Array<{ month: string; paise: number }>): ColumnDatum[] {
  const map = new Map(series.map((s) => [s.month, s.paise]));
  const out: ColumnDatum[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = d.toISOString().slice(0, 7);
    out.push({
      key,
      label: d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      tooltip: d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) + (i === 0 ? " (to date)" : ""),
      value: map.get(key) || 0,
    });
  }
  return out;
}

export function useSum(data: ColumnDatum[]) {
  return useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);
}
