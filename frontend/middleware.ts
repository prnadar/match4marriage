import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware — stamps `X-Robots-Tag: noindex` on private surfaces so
 * crawlers never index admin or member screens.
 *
 * We deliberately do NOT gate /admin/* at the edge. Firebase Authentication in
 * this app is entirely client-side — the ID token lives in IndexedDB, never in
 * a cookie — so middleware cannot tell a signed-in admin from an anonymous
 * visitor. The previous cookie heuristic therefore matched nobody and
 * redirected EVERY /admin/* request (authenticated admins included) straight
 * back to /admin/login, making the console physically unreachable.
 *
 * The authoritative gates already exist:
 *   - the client-side AdminLayout verifies `is_admin` via /api/v1/auth/me and
 *     bounces non-admins to /admin/login, and
 *   - the backend API requires the admin claim on every admin route.
 * Admin/auth bundles are also marked `no-store` + `noindex` in next.config.mjs,
 * so dropping the edge redirect costs us no caching or indexing protection.
 */

const PRIVATE_PATH_RE = new RegExp(
  // Match: /admin, /auth, and the route-group (app) surfaces.
  "^/(admin|auth|dashboard|matches|messages|interests|notifications|profile|settings|subscription|onboarding|family|nri-hub)(/|$)",
);

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // Block search indexing on every private surface — defence-in-depth
  // alongside the per-path headers in next.config.mjs (config-level headers
  // don't always survive every Vercel edge path).
  if (PRIVATE_PATH_RE.test(req.nextUrl.pathname)) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  }

  return res;
}

export const config = {
  // Match every page except Next internals, static assets, and the routes
  // that explicitly need to be public (marketing pages, /api). Keeping the
  // matcher tight avoids running middleware on every image request.
  matcher: [
    "/admin/:path*",
    "/auth/:path*",
    "/dashboard/:path*",
    "/matches/:path*",
    "/messages/:path*",
    "/interests/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/subscription/:path*",
    "/onboarding/:path*",
    "/family/:path*",
    "/nri-hub/:path*",
    "/dashboard",
    "/matches",
    "/messages",
    "/interests",
    "/notifications",
    "/profile",
    "/settings",
    "/subscription",
    "/onboarding",
    "/family",
    "/nri-hub",
  ],
};
