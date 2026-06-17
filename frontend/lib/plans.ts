/**
 * Plan + money display helpers for the admin console.
 *
 * The database still stores the legacy internal tier KEYS (free / silver / gold
 * / platinum) — changing those would be a risky data migration. The product,
 * however, is sold as Basic / Premium / Elite, so the admin console must always
 * show the marketing names. Map keys → labels in ONE place:
 *
 *   free     → Free      (no active subscription)
 *   silver   → Basic
 *   gold     → Premium
 *   platinum → Elite
 */
const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  silver: "Basic",
  gold: "Premium",
  platinum: "Elite",
};

export function planLabel(tier: string | null | undefined): string {
  if (!tier) return "Free";
  const key = tier.toLowerCase();
  return PLAN_LABELS[key] ?? (key.charAt(0).toUpperCase() + key.slice(1));
}

/**
 * Format a minor-unit amount (pence) as GBP. All platform money is held in GBP
 * pence — the `price_paise` column name is legacy; the value is pence and the
 * currency is GBP. (An amount of 0 renders as "£0".)
 */
export function formatGBP(pence: number): string {
  if (!Number.isFinite(pence) || pence === 0) return "£0";
  const pounds = pence / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: Number.isInteger(pounds) ? 0 : 2,
  }).format(pounds);
}
