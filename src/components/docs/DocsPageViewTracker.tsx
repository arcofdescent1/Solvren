"use client";

import { useEffect } from "react";
import { trackDocsEvent } from "@/lib/docs/docsAnalytics";

export function DocsPageViewTracker(p: {
  title: string;
  href: string;
  section: string;
  tags?: string[];
}) {
  useEffect(() => {
    trackDocsEvent("docs_page_view", {
      title: p.title,
      href: p.href,
      section: p.section,
      tags: p.tags?.join(",") ?? "",
    });
  }, [p.title, p.href, p.section, p.tags]);

  return null;
}
