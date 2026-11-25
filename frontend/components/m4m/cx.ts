/**
 * Class joiner for the m4m primitives.
 *
 * Deliberately NOT `cn()` from lib/utils: tailwind-merge does not know the
 * `text-m4m-*` font-size keys, treats them as colours, and would silently drop
 * one of `text-m4m-kicker text-m4m-gold-label`. Plain concatenation keeps both.
 */
export type ClassPart = string | false | null | undefined;

export function cx(...parts: ClassPart[]): string {
  return parts.filter(Boolean).join(" ");
}

/** Which ground the element sits on. Member pages are dark; marketing is light. */
export type Ground = "dark" | "light";

/**
 * The system focus ring: 2px, offset 3px, blush on the aubergine ground and
 * rose on ivory. Apply to every interactive element that is not a primitive.
 */
export const focusRing: Record<Ground, string> = {
  dark:
    "focus-visible:outline focus-visible:outline-[length:var(--m4m-focus-width)] focus-visible:outline-offset-[var(--m4m-focus-offset)] focus-visible:outline-m4m-focus-dark",
  light:
    "focus-visible:outline focus-visible:outline-[length:var(--m4m-focus-width)] focus-visible:outline-offset-[var(--m4m-focus-offset)] focus-visible:outline-m4m-focus-light",
};
