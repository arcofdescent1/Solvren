"use client";

import Link from "next/link";
import { trackAppEvent } from "@/lib/appAnalytics";

type Props = {
  href: string;
  label?: string;
  page: string;
  section: string;
  helpKey: string;
};

export function LearnMoreLink({
  href,
  label = "Learn more",
  page,
  section,
  helpKey,
}: Props) {
  const external = href.startsWith("http");
  return (
    <Link
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="text-sm font-medium text-[var(--primary)] hover:underline"
      onClick={() =>
        trackAppEvent("learn_more_click", {
          page,
          section,
          help_key: helpKey,
          destination: href,
        })
      }
    >
      {label}
      {external ? " (opens new tab)" : ""}
    </Link>
  );
}
