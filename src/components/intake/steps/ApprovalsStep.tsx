"use client";

import { Button } from "@/ui";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { IntakeDraft } from "../types";
import { CoordinationAutopilotCard } from "@/components/coordination/CoordinationAutopilotCard";

export function ApprovalsStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { draft, onSave, saving } = props;
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<
    Array<{
      roleId: string;
      roleName: string;
      priority: number;
      matchedBy: Array<{ triggerType: "DOMAIN" | "SYSTEM" | "CHANGE_TYPE"; triggerValue: string }>;
      members: Array<{ userId: string; email: string | null; name: string | null }>;
    }>
  >([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const totalSuggestedUsers = useMemo(
    () => new Set(suggestions.flatMap((s) => s.members.map((m) => m.userId))).size,
    [suggestions]
  );

  const draftRef = useRef(draft);
  draftRef.current = draft;

  const systemsInvolvedKey = useMemo(
    () => JSON.stringify(draft.systems_involved ?? []),
    [draft.systems_involved]
  );

  const loadSuggestions = useCallback(async () => {
    const d = draftRef.current;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/changes/${encodeURIComponent(d.id)}/approval-mapping-suggestions`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load suggestions");
      setSuggestions((json as { suggestions?: typeof suggestions }).suggestions ?? []);
      setWarnings((json as { warnings?: string[] }).warnings ?? []);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed to load suggestions");
      setSuggestions([]);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuggestions();
  }, [loadSuggestions, draft.domain, draft.change_type, draft.id, draft.structured_change_type, systemsInvolvedKey]);

  async function applySuggestions() {
    setApplying(true);
    setMsg(null);
    try {
      const res = await fetch(
        `/api/changes/${encodeURIComponent(draft.id)}/approval-mapping-suggestions/apply`,
        { method: "POST" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to apply");
      const inserted = Number((json as { inserted?: number }).inserted ?? 0);
      setMsg(inserted > 0 ? `Applied ${inserted} approver suggestion(s).` : "No new approvers to apply.");
      await loadSuggestions();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : "Failed to apply suggestions");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">Who approves?</h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Approvers are suggested from your change type, risk area, and systems. You can modify the list before submitting.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Why we suggest approvers</p>
        <p className="mt-1 text-sm text-[var(--text)]">
          Governance rules map change type and impact to roles (e.g. Finance, RevOps). Applying suggestions saves time; you can add or remove approvers as needed.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm font-medium text-[var(--text)]">Suggested approvers</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          Based on your change type, risk area, and systems. Apply to add them to this change.
        </p>
        {loading ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">Loading suggestions…</p>
        ) : suggestions.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--text-muted)]">
            No mapping suggestions yet. Ask an admin to configure approval roles and mappings.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {suggestions.map((s) => (
              <div key={s.roleId} className="rounded border border-[var(--border)] p-3">
                <p className="text-sm font-medium text-[var(--text)]">{s.roleName}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  Matched by:{" "}
                  {s.matchedBy
                    .map((m) => `${m.triggerType}:${m.triggerValue}`)
                    .join(", ")}
                </p>
                {s.members.length === 0 ? (
                  <p className="mt-1 text-xs text-[var(--warning)]">No members assigned to this role.</p>
                ) : (
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Members:{" "}
                    {s.members
                      .map((m) => m.name || m.email || m.userId)
                      .join(", ")}
                  </p>
                )}
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={applySuggestions} disabled={applying || totalSuggestedUsers === 0}>
                {applying ? "Applying…" : "Apply Suggestions"}
              </Button>
              <Button variant="secondary" onClick={loadSuggestions} disabled={loading}>
                Refresh suggestions
              </Button>
              <span className="text-xs text-[var(--text-muted)]">
                {suggestions.length} role suggestion(s), {totalSuggestedUsers} unique user(s)
              </span>
            </div>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="mt-3 rounded border border-[var(--warning)]/40 bg-[color:color-mix(in_oklab,var(--warning)_10%,var(--bg-surface))] p-2">
            {warnings.map((w) => (
              <p key={w} className="text-xs text-[var(--text)]">
                {w}
              </p>
            ))}
          </div>
        )}
        {msg && <p className="mt-2 text-sm text-[var(--text-muted)]">{msg}</p>}
      </div>

      <CoordinationAutopilotCard changeId={draft.id} compact autoGenerate />

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] p-4">
        <p className="text-sm font-medium">What happens at submit</p>
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          When you submit, Solvren generates the approval checklist and
          assigns approvers based on your domain ({props.draft.domain ?? "REVENUE"})
          and risk level. You can view and manage approvals on the change detail
          page after submission.
        </p>
        <Link
          href={`/changes/${props.draft.id}`}
          className="mt-3 inline-block text-sm font-medium text-[var(--primary)] hover:underline"
        >
          View change
        </Link>
      </div>

      <div className="flex justify-between pt-4">
        <div />
        <Button onClick={onSave} disabled={saving}>
          {saving ? "Saving…" : "Save & Continue"}
        </Button>
      </div>
    </div>
  );
}
