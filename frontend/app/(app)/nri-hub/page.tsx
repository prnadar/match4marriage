"use client";

import { Globe } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

/**
 * NRI Hub — country filters, visa-status matching, timezone-aware chat hours.
 * The backend matches API doesn't yet expose an NRI filter or country stats,
 * so the page renders no fabricated profiles or country counts.
 */
export default function NriHubPage() {
  return (
    <ComingSoon
      icon={<Globe className="h-6 w-6 text-rose-700" />}
      kicker="NRI hub"
      title="A dedicated space for the global Indian community"
      body="We're building a curated NRI experience: filter by country and visa status, see only members open to international matches, and chat across timezones with smart suggested hours. Browse all profiles in the meantime. Every member's country and visa status is shown on their detail page."
      bullets={[
        "Country and visa-status filters in browse",
        "Members open to relocation flagged on every card",
        "Timezone-aware suggested chat windows",
        "Optional family-meeting via secure video",
      ]}
      primaryHref="/matches"
      primaryLabel="Browse all profiles"
      secondaryHref="/contact"
      secondaryLabel="Talk to an advisor"
    />
  );
}
