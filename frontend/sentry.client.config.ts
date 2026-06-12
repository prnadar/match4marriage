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
    // Record a privacy-masked Session Replay whenever an error fires, so you can
    // watch what the member did right before the crash. Healthy sessions are
    // never recorded. maskAllText / blockAllMedia keep PII + photos out of the
    // replay (important for a matrimony app).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    // Avoid noisy ResizeObserver / framework chatter without throwing away
    // anything we'd actually want to fix.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications.",
      "Non-Error promise rejection captured",
    ],
  });
}
