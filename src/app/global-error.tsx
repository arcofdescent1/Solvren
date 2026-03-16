"use client";

import * as React from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center">
          <h2 className="text-xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-[var(--text-muted)]">
            An unexpected error was captured. Try again or go back to dashboard.
          </p>
          <div className="flex gap-2">
            <button
              onClick={reset}
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            >
              Try again
            </button>
            <Link
              href="/dashboard"
              className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium"
            >
              Dashboard
            </Link>
          </div>
        </div>
      </body>
    </html>
  );
}
