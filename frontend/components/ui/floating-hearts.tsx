"use client";

import { useEffect, useState } from "react";

interface HeartItem {
  left: string;
  delay: string;
  dur: string;
  size: number;
  tone: string;
}

/**
 * Decorative drifting-hearts overlay. Place inside a `position: relative`
 * parent. Pure CSS animations — respects prefers-reduced-motion via the
 * keyframes' inheritance and a media-query reset in globals.css.
 *
 * Random positions are generated post-mount (client-only) to avoid the
 * server/client hydration mismatch that any `Math.random()` in render
 * would cause.
 *
 * Use sparingly: hero, big celebratory moments, success states.
 */
export function FloatingHearts({
  count = 12,
  density = "balanced",
}: {
  count?: number;
  /** Visual size mix. */
  density?: "subtle" | "balanced" | "celebration";
}) {
  const [items, setItems] = useState<HeartItem[]>([]);

  useEffect(() => {
    const tones = ["#ffb5c5", "#f0c0d0", "#e8a0b8", "#f7c9b1", "#e8c98a"];
    const sizeBase = density === "celebration" ? 18 : density === "subtle" ? 10 : 14;
    const arr: HeartItem[] = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        left:  `${Math.random() * 100}%`,
        delay: `${(Math.random() * 14).toFixed(1)}s`,
        dur:   `${(11 + Math.random() * 8).toFixed(1)}s`,
        size:  sizeBase + Math.round(Math.random() * 10),
        tone:  tones[i % tones.length],
      });
    }
    setItems(arr);
  }, [count, density]);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((p, i) => (
        <span
          key={i}
          className="heart-particle"
          style={{
            left: p.left,
            bottom: "-40px",
            width: p.size,
            height: p.size,
            background: `radial-gradient(circle at 30% 30%, ${p.tone}, ${p.tone}cc 60%, transparent 70%)`,
            animationDuration: p.dur,
            animationDelay: p.delay,
          }}
        />
      ))}
    </div>
  );
}

export default FloatingHearts;
