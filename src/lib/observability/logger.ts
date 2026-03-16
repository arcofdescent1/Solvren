import * as Sentry from "@sentry/nextjs";

type Level = "info" | "warn" | "error";

type LogPayload = {
  message: string;
  context?: Record<string, unknown>;
  error?: unknown;
};

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

function emit(level: Level, payload: LogPayload) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message: payload.message,
    context: payload.context ?? {},
    error: payload.error ? serializeError(payload.error) : undefined,
    env: process.env.NODE_ENV ?? "development",
  };

  if (level === "info") console.info(JSON.stringify(entry));
  else if (level === "warn") console.warn(JSON.stringify(entry));
  else console.error(JSON.stringify(entry));

  if (level === "error" && payload.error) {
    Sentry.captureException(payload.error, {
      tags: {
        area: "runtime",
      },
      extra: payload.context,
    });
  }
}

export function logInfo(message: string, context?: Record<string, unknown>) {
  emit("info", { message, context });
}

export function logWarn(message: string, context?: Record<string, unknown>) {
  emit("warn", { message, context });
}

export function logError(message: string, error: unknown, context?: Record<string, unknown>) {
  emit("error", { message, error, context });
}
