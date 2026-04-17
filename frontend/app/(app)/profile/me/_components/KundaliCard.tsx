"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, Stars } from "lucide-react";

interface Props {
  /** Display birth date as a single string ("Apr 17 1995") if all parts are present. */
  birthDay?: string;
  birthMonth?: string;
  birthYear?: string;
  /** User-entered birth time, free-text. */
  birthTime?: string;
  /** Birth city/place, free-text. */
  birthPlace?: string;
  /** Nakshatra (star) name; placed centrally on the chart. */
  nakshatra?: string;
  /** Chovva dosham status — Yes / No / Partial. */
  chovvaDosham?: string;
  /** Optional: rasi/lagna names if known. */
  rasi?: string;
  lagna?: string;
}

/**
 * Display-only North Indian-style kundali (rashi) chart.
 *
 * The North Indian chart is a 4×4 grid with the four corner cells split
 * diagonally to form 12 houses arranged around a central diamond. Houses are
 * numbered 1 (top centre) clockwise to 12 (top-left).
 *
 * v1 is purely visual — no astrology computation. Houses show their numbers,
 * the user's nakshatra labels the centre, and birth metadata sits beside the
 * chart. A future PR can compute rashi/planet placements and render them in
 * the right houses; the geometry below is the canonical reference layout.
 */
export function KundaliCard({
  birthDay, birthMonth, birthYear,
  birthTime, birthPlace,
  nakshatra, chovvaDosham, rasi, lagna,
}: Props) {
  const reduce = useReducedMotion();
  const birth = [birthDay, birthMonth, birthYear].filter(Boolean).join(" ");
  const hasAnyData = !!(birth || birthTime || birthPlace || nakshatra || chovvaDosham);

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "relative",
        padding: 18, borderRadius: 14,
        background: "linear-gradient(160deg, #fffaf6 0%, #fff1f3 100%)",
        border: "1px solid rgba(220,30,60,0.10)",
        boxShadow: "0 4px 18px rgba(220,30,60,0.05)",
        overflow: "hidden",
      }}
    >
      {/* Ambient glow */}
      <div aria-hidden style={{
        position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(240,201,135,0.32), transparent 70%)",
        filter: "blur(28px)", pointerEvents: "none",
      }} />

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 10,
          background: "linear-gradient(135deg, #f0c987, #c9954a)",
          display: "grid", placeItems: "center",
          boxShadow: "0 4px 14px rgba(201,149,74,0.34)",
        }}>
          <Stars style={{ width: 16, height: 16, color: "#fff" }} />
        </div>
        <div>
          <div style={{
            fontFamily: "var(--font-playfair, serif)",
            fontSize: 16, fontWeight: 700, color: "#1a0a14",
            letterSpacing: "-0.01em",
          }}>
            Kundali / Horoscope
          </div>
          <div style={{ fontSize: 11, color: "#888" }}>
            Birth details and a glance at your North Indian chart.
          </div>
        </div>
      </div>

      <div className="kundali-row" style={{
        display: "grid",
        gridTemplateColumns: "minmax(220px, 280px) 1fr",
        gap: 18, alignItems: "center",
        position: "relative", zIndex: 1,
      }}>
        <NorthIndianChart nakshatra={nakshatra} />

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <DetailRow label="Date of birth" value={birth || "—"} />
          <DetailRow label="Time of birth" value={birthTime || "—"} />
          <DetailRow label="Place of birth" value={birthPlace || "—"} />
          <div style={{ height: 1, background: "rgba(220,30,60,0.08)" }} />
          <DetailRow label="Nakshatra (star)" value={nakshatra || "—"} accent />
          <DetailRow label="Chovva Dosham"   value={chovvaDosham || "—"} />
          {rasi  && <DetailRow label="Rasi"  value={rasi} />}
          {lagna && <DetailRow label="Lagna" value={lagna} />}
        </div>
      </div>

      {!hasAnyData && (
        <div style={{
          marginTop: 14, padding: "10px 12px", borderRadius: 8,
          background: "rgba(255,255,255,0.6)", border: "1px dashed rgba(220,30,60,0.18)",
          fontSize: 12, color: "#888",
          display: "flex", alignItems: "center", gap: 8,
          position: "relative", zIndex: 1,
        }}>
          <Sparkles style={{ width: 14, height: 14, color: "#c9954a" }} />
          <span>Add your nakshatra and birth details above to populate this chart.</span>
        </div>
      )}

      <style jsx>{`
        @media (max-width: 560px) {
          :global(.kundali-row) {
            grid-template-columns: 1fr !important;
            justify-items: center;
          }
        }
      `}</style>
    </motion.div>
  );
}

function DetailRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
      <span style={{
        fontSize: 11, fontWeight: 600, color: "#777",
        textTransform: "uppercase", letterSpacing: "0.06em",
      }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: accent ? 700 : 500,
        color: accent ? "#a0153c" : "#1a0a14",
        fontFamily: accent ? "var(--font-playfair, serif)" : "inherit",
        textAlign: "right",
      }}>{value}</span>
    </div>
  );
}

/**
 * North Indian-style 12-house chart. Layout is deterministic, scales with
 * `size`. Houses are numbered 1..12 starting at the top centre, rotating
 * clockwise — this matches every reference North Indian chart you'll see.
 *
 *   Geometry: outer square split by both diagonals from corner to corner.
 *   The midpoints of the four sides connect to form a central diamond.
 *   That gives 4 corner triangles, 4 edge triangles, and a central diamond
 *   that itself is split by the two diagonals into 4 triangles — 12 houses.
 */
function NorthIndianChart({ nakshatra }: { nakshatra?: string }) {
  const SIZE = 220;
  const half = SIZE / 2;
  const stroke = "#a0153c";
  const fill = "rgba(255,250,242,0.92)";
  const labelStyle = {
    fontFamily: "var(--font-poppins, sans-serif)",
    fontSize: 11, fontWeight: 700, fill: "#a0153c",
  } as const;

  // House label coordinates — eyeballed against the geometry. Each (x, y) is
  // roughly the centroid of that house's polygon at SIZE=220.
  // House numbering (North Indian convention, top-centre = 1, clockwise):
  //   2 ┌── 1 ──┐ 12
  //   ┌─┤   ╳   ├─┐
  //   3 │       │ 11
  //   ├─┤   ╳   ├─┤
  //   4 │       │ 10
  //   ┌─┤   ╳   ├─┐
  //   5 └── 7 ──┘ 9   ← 6 sits at left-middle, 8 at right-middle, 9 bottom-right corner
  // (Diagram is approximate; coordinates below are exact.)
  const houses: Array<{ n: number; x: number; y: number }> = [
    { n:  1, x: half,      y: 38 },         // top centre
    { n:  2, x: 38,        y: 38 },         // top-left corner
    { n:  3, x: 38,        y: half - 38 },  // upper-left edge inner
    { n:  4, x: 38,        y: half + 38 },  // lower-left edge inner
    { n:  5, x: 38,        y: SIZE - 38 },  // bottom-left corner
    { n:  6, x: half - 38, y: SIZE - 38 },  // bottom-left of bottom edge
    { n:  7, x: half,      y: SIZE - 38 },  // bottom centre
    { n:  8, x: half + 38, y: SIZE - 38 },  // bottom-right of bottom edge
    { n:  9, x: SIZE - 38, y: SIZE - 38 },  // bottom-right corner
    { n: 10, x: SIZE - 38, y: half + 38 },  // lower-right edge inner
    { n: 11, x: SIZE - 38, y: half - 38 },  // upper-right edge inner
    { n: 12, x: SIZE - 38, y: 38 },         // top-right corner
  ];

  return (
    <div style={{ display: "grid", placeItems: "center" }}>
      <svg
        width={SIZE} height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        style={{
          display: "block",
          background: fill,
          borderRadius: 12,
          boxShadow: "0 4px 14px rgba(220,30,60,0.10), 0 0 0 1px rgba(201,149,74,0.18) inset",
        }}
      >
        {/* Outer square */}
        <rect
          x={1} y={1} width={SIZE - 2} height={SIZE - 2}
          fill="none" stroke={stroke} strokeWidth={1.6} rx={4}
        />
        {/* Two diagonals */}
        <line x1={1} y1={1} x2={SIZE - 1} y2={SIZE - 1} stroke={stroke} strokeWidth={1.2} />
        <line x1={SIZE - 1} y1={1} x2={1} y2={SIZE - 1} stroke={stroke} strokeWidth={1.2} />
        {/* Inner diamond connecting side midpoints */}
        <polygon
          points={`${half},1 ${SIZE - 1},${half} ${half},${SIZE - 1} 1,${half}`}
          fill="none" stroke={stroke} strokeWidth={1.2}
        />

        {/* House numbers */}
        {houses.map((h) => (
          <text
            key={h.n}
            x={h.x} y={h.y}
            textAnchor="middle" dominantBaseline="central"
            {...labelStyle}
          >{h.n}</text>
        ))}

        {/* Centre nakshatra label */}
        {nakshatra ? (
          <text
            x={half} y={half}
            textAnchor="middle" dominantBaseline="central"
            style={{
              fontFamily: "var(--font-playfair, serif)",
              fontSize: 13, fontWeight: 700, fill: "#7a5a1d",
            }}
          >
            <tspan x={half} dy="-6">★</tspan>
            <tspan x={half} dy="14">{nakshatra}</tspan>
          </text>
        ) : (
          <text
            x={half} y={half}
            textAnchor="middle" dominantBaseline="central"
            style={{ fontSize: 10, fill: "#bbb" }}
          >(set nakshatra)</text>
        )}
      </svg>
    </div>
  );
}
