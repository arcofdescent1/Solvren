"use client";

import type { EvidenceJsonV1 } from "@/lib/outcomes/types";
import { Stack } from "@/ui";

export function ValueStoryTimeline({ evidence }: { evidence: EvidenceJsonV1 | null }) {
  if (!evidence || evidence.schemaVersion !== 1) {
    return <p className="text-sm text-[var(--text-muted)]">No structured evidence.</p>;
  }
  return (
    <Stack gap={2} className="text-sm">
      <p className="font-medium text-[var(--text-muted)]">Observation window</p>
      <p>
        {new Date(evidence.observationWindow.startedAt).toLocaleString()} →{" "}
        {new Date(evidence.observationWindow.endsAt).toLocaleString()}
      </p>
      {evidence.actions.length > 0 ? (
        <>
          <p className="font-medium text-[var(--text-muted)]">Actions</p>
          <ul className="list-disc pl-5">
            {evidence.actions.map((a, i) => (
              <li key={i}>
                {a.type} — {new Date(a.timestamp).toLocaleString()}
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {evidence.timelineEvents.length > 0 ? (
        <>
          <p className="font-medium text-[var(--text-muted)]">Timeline</p>
          <ul className="list-disc pl-5">
            {evidence.timelineEvents.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      ) : null}
    </Stack>
  );
}
