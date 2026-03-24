import * as Sentry from "@sentry/nextjs";
import { env } from "@/lib/env";

const SENSITIVE_KEY_RE = /(authorization|cookie|token|secret|password|api[_-]?key)/i;

if (env.sentryDsn) {
  Sentry.init({
    dsn: env.sentryDsn,
    environment: env.nodeEnv,
    tracesSampleRate: env.nodeEnv === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.headers) {
        const h = { ...event.request.headers };
        for (const k of Object.keys(h)) {
          if (SENSITIVE_KEY_RE.test(k)) h[k] = "[redacted]";
        }
        event.request.headers = h;
      }
      if (event.request?.cookies) {
        delete event.request.cookies;
      }
      return event;
    },
  });
}
