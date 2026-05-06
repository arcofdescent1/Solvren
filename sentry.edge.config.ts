import * as Sentry from "@sentry/nextjs";
import { redactSecretsForLog } from "@/lib/server/encryption/secret-redaction";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    beforeSend(event) {
      return redactSecretsForLog(event) as typeof event;
    },
  });
}
