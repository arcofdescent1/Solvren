"use client";

import * as React from "react";
import { GitBranch, Send, CheckSquare, FileText, MessageSquare, User } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Card, CardBody } from "@/ui";
import { Button } from "@/ui/primitives/button";
import { Textarea } from "@/ui/primitives/textarea";

type TimelineEvent = {
  id: string;
  actor_user_id: string | null;
  actor_display: string;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const EVENT_ICONS: Record<string, React.ReactNode> = {
  CHANGE_CREATED: <GitBranch className="h-4 w-4" />,
  CHANGE_SUBMITTED: <Send className="h-4 w-4" />,
  CHANGE_APPROVED: <CheckSquare className="h-4 w-4 text-green-600" />,
  CHANGE_REJECTED: <CheckSquare className="h-4 w-4 text-red-600" />,
  APPROVAL_APPROVED: <CheckSquare className="h-4 w-4 text-green-600" />,
  APPROVAL_REJECTED: <CheckSquare className="h-4 w-4 text-red-600" />,
  APPROVERS_ASSIGNED: <User className="h-4 w-4" />,
  EVIDENCE_PROVIDED: <FileText className="h-4 w-4" />,
  EVIDENCE_WAIVED: <FileText className="h-4 w-4 opacity-70" />,
  COMMENT_ADDED: <MessageSquare className="h-4 w-4" />,
};

function iconFor(eventType: string) {
  return EVENT_ICONS[eventType] ?? <GitBranch className="h-4 w-4" />;
}

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", hour12: true });
}

function formatDate(ts: string) {
  const d = new Date(ts);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ChangeTimeline({ changeId }: { changeId: string }) {
  const [events, setEvents] = React.useState<TimelineEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [commentErr, setCommentErr] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/changes/${changeId}/timeline`);
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load timeline");
      setEvents((json as { events?: TimelineEvent[] }).events ?? []);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [changeId]);

  React.useEffect(() => {
    load();
  }, [load]);

  React.useEffect(() => {
    const handler = () => load();
    window.addEventListener("timeline:refresh", handler);
    return () => window.removeEventListener("timeline:refresh", handler);
  }, [load]);

  async function submitComment() {
    const text = comment.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setCommentErr(null);
    try {
      const res = await fetch(`/api/changes/${changeId}/timeline/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to add comment");
      setComment("");
      load();
    } catch (e: unknown) {
      setCommentErr(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = React.useMemo(() => {
    const groups: { date: string; items: TimelineEvent[] }[] = [];
    let lastDate = "";
    for (const e of events) {
      const d = formatDate(e.created_at);
      if (d !== lastDate) {
        lastDate = d;
        groups.push({ date: d, items: [] });
      }
      groups[groups.length - 1].items.push(e);
    }
    return groups;
  }, [events]);

  return (
    <Card>
      <CardBody>
        <h2 className="font-semibold text-[var(--text)]">Change Timeline</h2>
        {loading && (
          <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading…
          </div>
        )}
        {err && <p className="mt-4 text-sm text-[var(--danger)]">{err}</p>}
        {!loading && !err && events.length === 0 && (
          <p className="mt-4 text-sm text-[var(--text-muted)]">No timeline events yet.</p>
        )}
        {!loading && !err && events.length > 0 && (
          <div className="mt-4 space-y-4">
            {grouped.map((g) => (
              <div key={g.date}>
                <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  {g.date}
                </div>
                <div className="mt-2 space-y-3">
                  {g.items.map((e) => (
                    <div
                      key={e.id}
                      className="flex gap-3 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--bg-muted)] text-[var(--text-muted)]">
                        {iconFor(e.event_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline gap-2 text-sm">
                          <span className="font-medium text-[var(--text)]">{e.title}</span>
                          <span className="text-xs text-[var(--text-muted)]">{formatTime(e.created_at)}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[var(--text-muted)]">
                          {e.actor_display}
                          {e.description && <> · {e.description}</>}
                        </div>
                        {e.event_type === "COMMENT_ADDED" && typeof e.metadata?.text === "string" && (
                          <div className="mt-2 rounded bg-[var(--bg-muted)] p-2 text-sm text-[var(--text)]">
                            {e.metadata.text}
                          </div>
                        )}
                        {Object.keys(e.metadata ?? {}).length > 0 &&
                        e.event_type !== "COMMENT_ADDED" &&
                        (e.metadata?.added || e.metadata?.removed || e.metadata?.approval_areas) ? (
                          <details className="mt-2">
                            <summary className="cursor-pointer text-xs text-[var(--primary)] hover:underline">
                              Show details
                            </summary>
                            <pre className="mt-1 overflow-x-auto rounded bg-[var(--bg-muted)] p-2 text-xs text-[var(--text-muted)]">
                              {JSON.stringify(e.metadata, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <label htmlFor="timeline-comment" className="block text-sm font-medium text-[var(--text)]">
            Add comment
          </label>
          <Textarea
            id="timeline-comment"
            className="mt-1 min-h-[80px]"
            placeholder="Add a comment to the timeline…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button size="sm" onClick={submitComment} disabled={!comment.trim() || submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adding…
                </>
              ) : (
                "Add comment"
              )}
            </Button>
            {commentErr && <span className="text-sm text-[var(--danger)]">{commentErr}</span>}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
