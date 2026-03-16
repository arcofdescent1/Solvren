import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.SKIP_ENV_VALIDATION !== "1") {
      const { validateRequiredEnv } = await import("./src/lib/env");
      validateRequiredEnv();
    }

    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
