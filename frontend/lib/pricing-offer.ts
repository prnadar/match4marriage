/**
 * Time-limited promo helpers shared by the public pricing page and the
 * member subscription page. The backend is the source of truth (it stops
 * returning the promo once `offer_ends_at` passes, and checkout charges the
 * same effective price); these only format what it returns.
 */

/** Whole-number percent saved, e.g. 15000 vs 30000 → 50. */
export function percentOff(price: number, was: number): number {
  if (!was || was <= price) return 0;
  return Math.round((1 - price / was) * 100);
}

/** Is the offer still running at `now`? A missing end date means open-ended. */
export function offerActive(endsIso: string | null | undefined, now = new Date()): boolean {
  if (!endsIso) return true;
  const ends = new Date(endsIso);
  return isNaN(ends.getTime()) || now < ends;
}

/**
 * "until New Year" when the offer ends at the turn of the year, otherwise
 * "until 14 Feb" (the last full day of the offer, UK time).
 */
export function offerUntilLabel(endsIso: string | null | undefined): string | null {
  if (!endsIso) return null;
  const ends = new Date(endsIso);
  if (isNaN(ends.getTime())) return null;
  const lastDay = new Date(ends.getTime() - 1);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", day: "numeric", month: "short",
  }).formatToParts(lastDay);
  const day = parts.find((p) => p.type === "day")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (day === "31" && month === "Dec") return "until New Year";
  return `until ${day} ${month}`;
}
