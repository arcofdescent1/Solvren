"use client";

import { useState } from "react";
import { Card, CardBody } from "@/ui";
import { Button } from "@/ui";

type Comment = {
  id: string;
  body: string;
  author_user_id: string;
  created_at: string;
};

export function IssueCommentsPanel({
  issueId,
  comments: initialComments,
}: {
  issueId: string;
  comments: Comment[];
}) {
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!body.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${issueId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: body.trim() }),
      });
      if (res.ok) {
        setBody("");
        window.location.reload();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardBody>
        <h3 className="text-sm font-medium text-[var(--text-muted)] mb-2">Comments</h3>
        {comments.length === 0 ? (
          <p className="text-sm text-[var(--text-muted)] mb-3">No comments yet.</p>
        ) : (
          <ul className="space-y-2 mb-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded bg-[var(--bg-surface-2)] p-2 text-sm">
                <p className="whitespace-pre-wrap">{c.body}</p>
                <span className="text-xs text-[var(--text-muted)]">
                  {new Date(c.created_at).toLocaleString()} · {c.author_user_id.slice(0, 8)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Add a comment…"
            className="min-h-[80px] w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 text-sm text-[var(--text)]"
            rows={3}
          />
          <Button type="button" size="sm" onClick={submit} disabled={loading || !body.trim()}>
            {loading ? "Sending…" : "Comment"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
