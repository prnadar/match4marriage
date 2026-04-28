"use client";

import { useState, useRef } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Heart "send interest" button with bloom + outward love-pulse on activation.
 * Replaces the stock toggle on profile cards.
 */
export function HeartButton({
  liked,
  onToggle,
  size = 36,
  className,
  ariaLabel,
}: {
  liked: boolean;
  onToggle: () => void;
  size?: number;
  className?: string;
  ariaLabel?: string;
}) {
  const [pulsing, setPulsing] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const lastRef = useRef(false);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!lastRef.current) {
      // Going from unliked → liked: trigger pulse + bloom.
      setPulsing(true);
      setAnimKey((k) => k + 1);
      window.setTimeout(() => setPulsing(false), 800);
    }
    lastRef.current = !liked;
    onToggle();
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? (liked ? "Remove interest" : "Send interest")}
      className={cn(
        "relative inline-flex items-center justify-center rounded-full",
        "border border-white/40 backdrop-blur-md",
        "transition-[transform,box-shadow,background] duration-200 ease-out active:scale-95",
        liked
          ? "bg-gradient-to-br from-[#dc1e3c] to-[#7d0a35] shadow-[0_8px_22px_rgba(220,30,60,0.45)]"
          : "bg-white/92 shadow-[0_4px_14px_rgba(0,0,0,0.12)] hover:bg-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {pulsing && <span key={animKey} className="love-pulse" />}
      <Heart
        className={cn(
          "transition-transform",
          pulsing && "heart-bloom",
        )}
        style={{
          width: size * 0.42,
          height: size * 0.42,
          color: liked ? "#fff" : "#7d0a35",
          fill: liked ? "#fff" : "transparent",
          strokeWidth: 2,
        }}
      />
    </button>
  );
}

export default HeartButton;
