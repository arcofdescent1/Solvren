"use client";

import Link from "next/link";
import { trackAppEvent } from "@/lib/appAnalytics";
import { PAGE_HELP, type PageHelpKey } from "@/config/pageHelp";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/ui";

type Props = {
  page: PageHelpKey;
  docsHref?: string | null;
};

export function PageHelpDrawer({ page, docsHref }: Props) {
  const data = PAGE_HELP[page];
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          type="button"
          className="text-sm font-medium text-[var(--primary)] hover:underline"
          onClick={() => trackAppEvent("page_help_open", { page, help_key: page })}
        >
          How this page works
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{data.title}</SheetTitle>
        </SheetHeader>
        <SheetBody className="space-y-3">
          <p className="text-sm text-[var(--text-muted)]">{data.purpose}</p>
          <ul className="list-disc space-y-2 pl-5 text-sm text-[var(--text)]">
            {data.bullets.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {docsHref ? (
            <Link
              href={docsHref}
              target={docsHref.startsWith("http") ? "_blank" : undefined}
              rel={docsHref.startsWith("http") ? "noreferrer" : undefined}
              className="inline-block text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Learn more
            </Link>
          ) : null}
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
