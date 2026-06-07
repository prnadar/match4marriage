import type { MetadataRoute } from "next";

/**
 * Robots policy.
 *
 * Allowed: the public marketing surface (landing, about, pricing, contact,
 * faq, privacy, terms, success-stories, profiles index).
 * Disallowed: admin, auth, and every authenticated member route.
 *
 * The (app) route group is invisible to URL matching — disallow the actual
 * URLs those segments produce instead.
 */
export default function robots(): MetadataRoute.Robots {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "https://m4mweb.vercel.app");

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/admin/",
          "/auth/",
          "/dashboard",
          "/dashboard/",
          "/matches",
          "/matches/",
          "/messages",
          "/messages/",
          "/interests",
          "/interests/",
          "/notifications",
          "/notifications/",
          "/profile",
          "/profile/",
          "/settings",
          "/settings/",
          "/subscription",
          "/subscription/",
          "/onboarding",
          "/onboarding/",
          "/family",
          "/family/",
          "/nri-hub",
          "/nri-hub/",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
