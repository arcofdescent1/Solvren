"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, CardBody, PageHeaderV2, Stack } from "@/ui";
import { ValueStoryTimeline } from "@/components/outcomes/ValueStoryTimeline";
import type { EvidenceJsonV1 } from "@/lib/outcomes/types";

type StoryRow = {
  id: string;
  headline: string;
  story_text: string;
  outcome_type: string;
  estimated_value: number | null;
  confidence_level: string;
  status: string;
  evidence_json: EvidenceJsonV1 | Record<string, unknown>;
  change_event_id: string;
  finalized_at?: string | null;
};

export default function ValueStoryDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");
  const router = useRouter();
  const [story, setStory] = useState<StoryRow | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setErr(null);
    const res = await fetch(`/api/outcomes/value-stories/${id}`, { credentials: "include" });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(j.error ?? res.statusText);
      return;
    }
    const j = (await res.json()) as { story: StoryRow };
    setStory(j.story);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function verify() {
    setBusy(true);
    try {
      const res = await fetch(`/api/outcomes/value-stories/${id}/verify`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? res.statusText);
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      const res = await fetch(`/api/outcomes/value-stories/${id}/reject`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(j.error ?? res.statusText);
        return;
      }
      router.push("/outcomes/value-stories");
    } finally {
      setBusy(false);
    }
  }

  const ev = story?.evidence_json as EvidenceJsonV1 | null;
  const evidence =
    ev && typeof ev === "object" && (ev as EvidenceJsonV1).schemaVersion === 1 ? (ev as EvidenceJsonV1) : null;

  return (
    <Stack gap={6} className="pb-10">
      <PageHeaderV2
        title={story?.headline ?? "Value story"}
        description={story ? `${story.outcome_type.replace(/_/g, " ")} · ${story.status}` : ""}
        actions={
          <Link href="/outcomes/value-stories" className="text-sm font-medium text-[var(--primary)] hover:underline">
            ← All stories
          </Link>
        }
      />
      {err ? <p className="text-sm text-[var(--danger)]">{err}</p> : null}
      {story ? (
        <>
          <Card>
            <CardBody className="space-y-3">
              <p className="text-sm text-[var(--text-muted)]">Estimated value</p>
              <p className="text-2xl font-semibold tabular-nums">
                {story.outcome_type === "APPROVAL_TIME_SAVED"
                  ? `${Math.round(story.estimated_value ?? 0)} hours saved`
                  : story.estimated_value == null
                    ? "—"
                    : `$${Math.round(story.estimated_value).toLocaleString()}`}
              </p>
              {story.outcome_type === "APPROVAL_TIME_SAVED" ? (
                <p className="text-xs text-[var(--text-muted)]">
                  Estimated time saved relative to recent historical approval patterns. This is not presented as hard causal proof.
                </p>
              ) : (
                <p className="text-xs text-[var(--text-muted)]">
                  Dollar estimates use monthly revenue at risk from the change record (default one-month basis) with Phase 6 confidence
                  and duration weighting.
                </p>
              )}
              <p className="text-sm">{story.story_text}</p>
              <Link href={`/changes/${story.change_event_id}`} className="text-sm text-[var(--primary)] hover:underline">
                Open change
              </Link>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="mb-2 text-sm font-medium">Evidence</p>
              <ValueStoryTimeline evidence={evidence} />
            </CardBody>
          </Card>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || story.status === "REJECTED" || story.confidence_level === "VERIFIED"}
              onClick={() => void verify()}
              className="rounded-md border border-[var(--border)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--bg-muted)] disabled:opacity-50"
            >
              Verify claim
            </button>
            <button
              type="button"
              disabled={busy || story.status === "REJECTED"}
              onClick={() => void reject()}
              className="rounded-md border border-[var(--danger)]/40 px-3 py-1.5 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 disabled:opacity-50"
            >
              Reject story
            </button>
          </div>
        </>
      ) : null}
    </Stack>
  );
}
