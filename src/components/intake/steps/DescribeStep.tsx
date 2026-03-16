"use client";

import { Button, Textarea } from "@/ui";
import type { IntakeDraft } from "../types";

const WHY_DESCRIBE =
  "A short description helps our system suggest the right impact level and evidence requirements. You can paste a Jira summary or write in plain language.";

export function DescribeStep(props: {
  draft: IntakeDraft;
  onDraftChange: (next: Partial<IntakeDraft>) => void;
  onSave: () => Promise<void>;
  saving: boolean;
}) {
  const { draft, onDraftChange, onSave, saving } = props;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text)]">
          Describe the change in simple terms
        </h2>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Example: &ldquo;Updating enterprise pricing tier from $120 to $135 per seat.&rdquo;
        </p>
      </div>

      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-muted)]/50 p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Why we ask
        </p>
        <p className="mt-1 text-sm text-[var(--text)]">{WHY_DESCRIBE}</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="describe-change" className="text-sm font-medium text-[var(--text)]">
          Description
        </label>
        <Textarea
          id="describe-change"
          className="min-h-[120px] w-full rounded-lg border px-3 py-2"
          placeholder="Paste a Jira issue summary or describe what you're changing. AI will suggest change type, impact band, and evidence."
          value={draft.description ?? ""}
          onChange={(e) => onDraftChange({ description: e.target.value || null })}
        />
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
