import type { MetadataRoute } from "next";

/**
 * Sitemap covering only the public marketing surfaces. Private member-only
 * routes (dashboard, messages, etc.) are excluded — they are also blocked
 * in robots.ts and noindex'd via X-Robots-Tag.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.NEXT_PUBLIC_VERCEL_URL
      ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
      : "https://m4mweb.vercel.app");

  const lastModified = new Date();

  const paths: Array<{ path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }> = [
    { path: "/",                priority: 1.0, changeFrequency: "weekly" },
    { path: "/about",           priority: 0.6, changeFrequency: "monthly" },
    { path: "/pricing",         priority: 0.9, changeFrequency: "monthly" },
    { path: "/success-stories", priority: 0.7, changeFrequency: "weekly" },
    { path: "/profiles",        priority: 0.6, changeFrequency: "weekly" },
    { path: "/faq",             priority: 0.5, changeFrequency: "monthly" },
    { path: "/contact",         priority: 0.6, changeFrequency: "monthly" },
    { path: "/privacy",         priority: 0.3, changeFrequency: "yearly" },
    { path: "/terms",           priority: 0.3, changeFrequency: "yearly" },
  ];

  return paths.map(({ path, priority, changeFrequency }) => ({
    url: `${base}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
