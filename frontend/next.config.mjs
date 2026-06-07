/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for catching issues early
  reactStrictMode: true,

  // Strict-type & strict-lint at build time. If new errors surface here from
  // unfinished admin pages, fix them at the source rather than re-flipping
  // these switches — silenced errors hide real launch-blockers.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  // Required for `instrumentation.ts` to run (Next 14's Sentry bootstrap).
  experimental: { instrumentationHook: true },

  // Image optimization — allow our actual photo hosts.
  // Cloudinary is the real-deal host for member photos; S3/CloudFront are
  // legacy + Unsplash is used for marketing placeholders.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "*.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "*.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    formats: ["image/webp", "image/avif"],
  },

  // PWA headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(self)",
          },
        ],
      },
      {
        // Admin + auth pages must never be served from a stale cache — an
        // outdated login bundle (e.g. our earlier hardcoded-creds version)
        // would silently lock admins out after a deploy.
        source: "/admin/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/auth/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        // Authenticated member routes must not be indexed by search engines.
        // Middleware can't selectively target the (app) route group, so we
        // attach noindex headers to the concrete URLs that segment produces.
        source: "/:path(dashboard|matches|messages|interests|notifications|profile|settings|subscription|onboarding|family|nri-hub)/:rest*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        source: "/:path(dashboard|matches|messages|interests|notifications|profile|settings|subscription|onboarding|family|nri-hub)",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },

  // Redirect bare / to landing for authenticated users
  async redirects() {
    return [];
  },
};

// Optionally wrap with Sentry — only when a DSN is actually configured so dev
// builds don't pay the Sentry plugin cost. The minimal config here uploads
// source maps when SENTRY_AUTH_TOKEN is present; otherwise it's a no-op.
let exportedConfig = nextConfig;
if (process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN) {
  try {
    // Lazy require so the package isn't a hard dependency when Sentry is off.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { withSentryConfig } = await import("@sentry/nextjs");
    exportedConfig = withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      // Tunnel the Sentry requests through /monitoring so ad-blockers can't
      // drop them; harmless if you don't need it.
      tunnelRoute: "/monitoring",
      hideSourceMaps: true,
      disableLogger: true,
    });
  } catch {
    // @sentry/nextjs not installed — fall through with the bare config.
  }
}

export default exportedConfig;
