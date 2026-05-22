"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Subscription entitlements — the client mirror of app/core/entitlements.py.
 * Reads GET /api/v1/subscriptions/limits and exposes the core tier gates so
 * the UI can lock features and show upgrade prompts. The backend enforces all
 * of these regardless; this is purely for presentation.
 *
 * Tier → plan name: free=Basic, silver=Premium, gold=Elite, platinum=VIP.
 */
export interface Entitlements {
  plan: string;                 // free | silver | gold | platinum
  planLabel: string;            // Basic | Premium | Elite | VIP Concierge
  interestsRemaining: number;   // -1 = unlimited
  canMessage: boolean;
  canViewPhotos: boolean;
  canViewPremiumPhotos: boolean;
  canUseAdvancedFilters: boolean;
  canViewContact: boolean;
}

const PLAN_LABEL: Record<string, string> = {
  free: "Basic",
  silver: "Premium",
  gold: "Elite",
  platinum: "VIP Concierge",
};

// Fail-closed default (everything locked) until the real limits load.
const FALLBACK: Entitlements = {
  plan: "free",
  planLabel: "Basic",
  interestsRemaining: 0,
  canMessage: false,
  canViewPhotos: true, // main photos are visible to everyone
  canViewPremiumPhotos: false,
  canUseAdvancedFilters: false,
  canViewContact: false,
};

export function useEntitlements(): { entitlements: Entitlements; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["entitlements"],
    queryFn: async (): Promise<Entitlements> => {
      const res = await api.get<{ data: Record<string, unknown> }>("/api/v1/subscriptions/limits");
      const d = ((res.data as any)?.data ?? {}) as Record<string, unknown>;
      const plan = String(d.plan || "free");
      return {
        plan,
        planLabel: PLAN_LABEL[plan] || "Basic",
        interestsRemaining: typeof d.interests_remaining === "number" ? d.interests_remaining : 0,
        canMessage: !!d.can_message,
        canViewPhotos: d.can_view_photos !== false, // default visible
        canViewPremiumPhotos: !!d.can_view_premium_photos,
        canUseAdvancedFilters: !!d.can_use_advanced_filters,
        canViewContact: !!d.can_view_contact,
      };
    },
    staleTime: 5 * 60 * 1000,
  });

  return { entitlements: data ?? FALLBACK, isLoading };
}
