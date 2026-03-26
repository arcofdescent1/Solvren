"use client";

import Link from "next/link";
import { trackAppEvent } from "@/lib/appAnalytics";

export type EmptyStateVariant =
  | "good_empty"
  | "filtered_empty"
  | "incomplete_setup"
  | "still_building";

type Props = {
  variant: EmptyStateVariant;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaHref?: string;
  page: string;
  section: string;
};

export function EmptyStateHelp({
  variant,
  title,
  body,
  ctaLabel,
  ctaHref,
  page,
  section,
}: Props) {
  return (
    <div className="rounded-md border border-dashed border-[var(--border)] p-6 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>
      {ctaLabel && ctaHref ? (
        <Link
          href={ctaHref}
          className="mt-3 inline-block text-sm font-semibold text-[var(--primary)] hover:underline"
          onClick={() =>
            trackAppEvent("empty_state_cta_click", {
              page,
              section,
              help_key: variant,
              destination: ctaHref,
            })
          }
        >
          {ctaLabel}
        </Link>
      ) : null}
    </div>
  );
}
