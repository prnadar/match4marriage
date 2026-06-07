/**
 * Sentry — browser bundle.
 *
 * If NEXT_PUBLIC_SENTRY_DSN is empty, init() is a no-op and Sentry.* calls
 * across the app return cheaply. That's how we keep dev silent and let prod
 * pick up errors without code changes.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || "";
const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.NODE_ENV ||
  "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    // Production runs see ~10% of transactions; lower envs sample everything
    // so debugging local repros isn't a guessing game.
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Avoid noisy ResizeObserver / framework chatter without throwing away
    // anything we'd actually want to fix.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Non-Error promise rejection captured",
    ],
  });
}
