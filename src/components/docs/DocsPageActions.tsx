"use client";

import { useState } from "react";
import { trackDocsEvent } from "@/lib/docs/docsAnalytics";

export function DocsPageActions(p: {
  editUrl: string;
  feedbackUrl: string;
  title: string;
  href: string;
}) {
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);

  const handleFeedback = (helpful: boolean) => {
    trackDocsEvent("docs_feedback_helpful", {
      title: p.title,
      href: p.href,
      helpful,
    });
    setFeedbackSubmitted(true);
  };

  return (
    <div className="mt-10 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <a
            href={p.editUrl}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackDocsEvent("docs_edit_click", { title: p.title, href: p.href })}
            className="text-sm text-[var(--primary)] transition hover:text-[var(--primary-hover)] hover:underline"
          >
            ✏️ Edit this page on GitHub
          </a>
          <DocsFeedback
            helpful={handleFeedback}
            submitted={feedbackSubmitted}
          />
        </div>
        <a
          href={p.feedbackUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() => trackDocsEvent("docs_feedback_click", { title: p.title, href: p.href })}
          className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm text-[var(--text)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
        >
          Send feedback
        </a>
      </div>
    </div>
  );
}

function DocsFeedback({
  helpful,
  submitted,
}: {
  helpful: (value: boolean) => void;
  submitted: boolean;
}) {
  if (submitted) {
    return <p className="text-sm text-[var(--text-subtle)]">Thanks for your feedback!</p>;
  }

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className="text-slate-400">Was this page helpful?</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => helpful(true)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--text)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
        >
          👍 Yes
        </button>
        <button
          type="button"
          onClick={() => helpful(false)}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[var(--text)] transition hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
        >
          👎 No
        </button>
      </div>
    </div>
  );
}
