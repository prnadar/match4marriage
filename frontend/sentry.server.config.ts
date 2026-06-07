/**
 * Sentry — server/runtime bundle (Node + Edge route handlers).
 *
 * Same DSN-gated no-op contract as sentry.client.config.ts.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN || "";
const environment =
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.NODE_ENV ||
  "development";

if (dsn) {
  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: environment === "production" ? 0.1 : 1.0,
  });
}
