/**
 * Next.js 14 instrumentation entrypoint. Runs once per server process; we use
 * it to bootstrap Sentry for the node + edge runtimes. The browser bundle is
 * initialised separately by sentry.client.config.ts (loaded automatically by
 * the @sentry/nextjs plugin).
 */

export async function register() {
  // The two server runtimes share the same DSN-gated no-op behaviour, so a
  // missing DSN means the init() call returns without registering anything.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}
