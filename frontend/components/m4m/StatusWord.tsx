import type { HTMLAttributes, ReactNode } from "react";
import { Check } from "lucide-react";
import { cx, type Ground } from "./cx";

/**
 * StatusWord: one or two small-caps words that say where something stands
 * ("In review", "Active", "Changes requested", "Verified"). It replaces the
 * tinted pill badge: no background, no border, no icon except the tick.
 *
 *   progress   champagne   a normal, in-flight or membership state
 *   attention  soft rose   the member has to do something
 *   verified   green tick  verified / complete, and only that
 *   neutral    muted       inactive, not started
 *
 * The state is always carried by the word; colour only reinforces it.
 */
export interface StatusWordProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: "progress" | "attention" | "verified" | "neutral";
  /** A 5px dot before the word (e.g. "Active" beside a plan). Ignored for `verified`, which shows the tick. */
  dot?: boolean;
  ground?: Ground;
  children: ReactNode;
}

const TEXT: Record<Ground, Record<NonNullable<StatusWordProps["tone"]>, string>> = {
  dark: {
    progress: "text-m4m-gold-champagne",
    attention: "text-m4m-rose-soft",
    verified: "text-m4m-fg",
    neutral: "text-m4m-fg-muted",
  },
  light: {
    progress: "text-m4m-gold-deep",
    attention: "text-m4m-rose",
    verified: "text-m4m-ink-text",
    neutral: "text-m4m-ink-text-muted",
  },
};

export function StatusWord({ tone = "progress", dot = false, ground = "dark", className, children, ...rest }: StatusWordProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap font-nav uppercase text-m4m-status",
        TEXT[ground][tone],
        className,
      )}
      {...rest}
    >
      {tone === "verified" ? (
        <Check
          aria-hidden
          strokeWidth={2.5}
          className={cx("h-3 w-3 flex-shrink-0", ground === "dark" ? "text-m4m-verified" : "text-m4m-verified-deep")}
        />
      ) : dot ? (
        <span aria-hidden className="h-[5px] w-[5px] flex-shrink-0 rounded-full bg-current" />
      ) : null}
      {children}
    </span>
  );
}

export default StatusWord;
