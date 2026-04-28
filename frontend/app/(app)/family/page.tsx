"use client";

import { Users } from "lucide-react";
import { ComingSoon } from "@/components/ui/coming-soon";

/**
 * Family Mode — lets parents / relatives co-manage the search.
 * Backend models for invitations, shared shortlists and permissions are not
 * yet built. Until they ship, this page intentionally renders no fabricated
 * family members.
 */
export default function FamilyPage() {
  return (
    <ComingSoon
      icon={<Users className="h-6 w-6 text-rose-700" />}
      kicker="Family mode"
      title="Co-pilot your search with family"
      body="Invite parents, siblings or close family to view profiles you've shortlisted, leave private notes, and help shape introductions. We're building this with the privacy controls it deserves — invitations and shared shortlists go live in the next release."
      bullets={[
        "Invite up to four family members per account",
        "They see only profiles you choose to share",
        "Private comments and a yes / no vote per profile",
        "You stay the only one who can send interest or chat",
      ]}
      primaryHref="/dashboard"
      primaryLabel="Back to dashboard"
      secondaryHref="/contact"
      secondaryLabel="Talk to an advisor"
    />
  );
}
