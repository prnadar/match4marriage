"use client";

import { useRef, useEffect, useState, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Subtle 3D tilt on hover. No deps. Respects prefers-reduced-motion.
 *
 * Wrap any element. The tilt is gentle (max ±6° on each axis) — designed for
 * editorial/premium feel, not arcade-style. Includes a soft moving sheen.
 *
 * Usage:
 *   <Tilt3D max={6}>
 *     <div className="card">…</div>
 *   </Tilt3D>
 */
export function Tilt3D({
  children,
  max = 6,
  scale = 1.015,
  glare = true,
  perspective = 1000,
  className,
}: {
  children: ReactNode;
  /** Max rotation in degrees per axis. Keep under 8 for editorial. */
  max?: number;
  /** Scale on hover. Use 1.0–1.04. */
  scale?: number;
  /** Show a moving sheen highlight. */
  glare?: boolean;
  /** Lower = more 3D. Default 1000px is restrained luxury. */
  perspective?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    const px = x / r.width  - 0.5;   // -0.5 .. 0.5
    const py = y / r.height - 0.5;   // -0.5 .. 0.5
    const rx = -py * 2 * max;
    const ry =  px * 2 * max;
    el.style.transform =
      `perspective(${perspective}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) scale(${scale})`;
    if (glare) {
      // Move a sheen to follow the cursor.
      el.style.setProperty("--tilt-glare-x", `${(x / r.width) * 100}%`);
      el.style.setProperty("--tilt-glare-y", `${(y / r.height) * 100}%`);
      el.style.setProperty("--tilt-glare-opacity", "1");
    }
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
    el.style.setProperty("--tilt-glare-opacity", "0");
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={cn(
        "tilt-3d relative",
        glare && "tilt-glare-target",
        className,
      )}
      style={{ transformStyle: "preserve-3d" }}
    >
      {children}
      {glare && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: "var(--tilt-glare-opacity, 0)",
            background:
              "radial-gradient(380px circle at var(--tilt-glare-x, 50%) var(--tilt-glare-y, 50%), rgba(255,255,255,0.28), transparent 60%)",
            mixBlendMode: "overlay",
          }}
        />
      )}
    </div>
  );
}

export default Tilt3D;
