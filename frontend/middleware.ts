import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge middleware.
 *
 * Responsibilities:
 *   1. Stamp `X-Robots-Tag: noindex, nofollow, noarchive` on every private
 *      surface so crawlers never index admin or member screens. We add it
 *      here (rather than only in next.config headers) because middleware is
 *      the single chokepoint that runs for every matched response.
 *   2. Best-effort admin gate: if a request hits any /admin/* route OTHER
 *      than /admin/login without a Firebase ID cookie, bounce to
 *      /admin/login before the admin bundle is shipped to the browser.
 *
 *      Caveat: Firebase Authentication is purely client-side in this app —
 *      we never write a session cookie ourselves. Below we look for the
 *      generic Firebase cookie hint (`firebaseLocalStorageDb` is in
 *      IndexedDB, not cookies) AND for any `firebase-auth*` cookie the
 *      Firebase web SDK may set when SDK auth-persistence is configured for
 *      cookies, AND for our own `m4m_session_uid` sessionStorage backup is
 *      *not* visible to middleware. So in practice this guard catches the
 *      "anonymous browser hits /admin/dashboard directly" case but does
 *      NOT replace the per-request admin check the client-side admin
 *      layout already performs. The server-side admin API is the real gate
 *      — see `/api/v1/auth/me` `.is_admin` check enforced backend-side.
 */

const PRIVATE_PATH_RE = new RegExp(
  // Match: /admin, /auth, and the route-group (app) surfaces.
  "^/(admin|auth|dashboard|matches|messages|interests|notifications|profile|settings|subscription|onboarding|family|nri-hub)(/|$)",
);

const ADMIN_PATH_RE = /^\/admin(\/|$)/;
const ADMIN_LOGIN_PATH = "/admin/login";

function hasLikelyFirebaseSession(req: NextRequest): boolean {
  // The Firebase JS SDK stores its session in IndexedDB by default, not in
  // cookies, so we cannot read it server-side. The best signal we have is
  // any cookie the host may set under our control. Treat the presence of
  // ANY of these as a (very) optimistic "session is plausibly hydrated".
  // The client-side admin layout still validates `is_admin` against the
  // backend — this guard's only job is to keep the admin bundles out of
  // anonymous browsers' caches and bots' indexes.
  const cookies = req.cookies;
  if (cookies.get("__session")?.value) return true;          // Firebase Hosting SSR helper
  if (cookies.get("firebaseIdToken")?.value) return true;    // some custom setups
  if (cookies.get("m4m_admin_hint")?.value === "1") return true; // future: opt-in set client-side after admin login
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Admin gate (best-effort). Skip /admin/login itself so it stays
  //    reachable for the anonymous case.
  if (ADMIN_PATH_RE.test(pathname) && pathname !== ADMIN_LOGIN_PATH) {
    if (!hasLikelyFirebaseSession(req)) {
      // The client-side AdminLayout will repeat this check authoritatively;
      // this just keeps the admin bundle out of anonymous caches.
      const url = req.nextUrl.clone();
      url.pathname = ADMIN_LOGIN_PATH;
      url.search = ""; // strip any deep-link query
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();

  // 2. Block search indexing on every private surface — defence-in-depth
  //    alongside the per-path headers in next.config.mjs (config-level
  //    headers don't always survive every Vercel edge path).
  if (PRIVATE_PATH_RE.test(pathname)) {
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
