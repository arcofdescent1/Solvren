"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/ui/primitives/button";
import { Textarea } from "@/ui/primitives/textarea";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitives/dialog";
import type { ExecutiveChangeView, ExecutiveDecisionApi } from "@/lib/executive/types";

function recLabel(r: ExecutiveChangeView["recommendation"]): string {
  switch (r) {
    case "PROCEED":
      return "Proceed";
    case "PROCEED_WITH_CAUTION":
      return "Proceed With Caution";
    case "DELAY":
      return "Delay";
    case "ESCALATE":
      return "Escalate";
    default:
      return r;
  }
}

export function ExecutiveDecisionPanel({
  changeId,
  view,
}: {
  changeId: string;
  view: ExecutiveChangeView;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<ExecutiveDecisionApi | null>(null);
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const missingSupport =
    view.readiness.find((r) => r.category === "Support")?.status === "PENDING";

  function openFor(decision: ExecutiveDecisionApi) {
    setPending(decision);
    setComment("");
    setError(null);
    setOpen(true);
  }

  async function submit() {
    if (!pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/executive/changes/${changeId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: pending,
          comment: pending === "APPROVE" ? (comment.trim() || null) : comment.trim() || undefined,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; reasons?: string[] };
      if (!res.ok) {
        const msg =
          Array.isArray(data.reasons) && data.reasons.length
            ? data.reasons.join("; ")
            : data.error ?? "Request failed";
        setError(msg);
        setSubmitting(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error");
    }
    setSubmitting(false);
  }

  const confirmTitle =
    pending === "APPROVE"
      ? "Confirm executive approval"
      : pending === "DELAY"
        ? "Delay this change"
        : pending === "ESCALATE"
          ? "Escalate"
          : "Request more information";

  return (
    <section className="space-y-3" data-testid="executive-decision-panel">
      <h2 className="text-xl font-bold text-[var(--text)]">Executive actions</h2>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => openFor("APPROVE")}>
          Approve
        </Button>
        <Button type="button" variant="outline" onClick={() => openFor("DELAY")}>
          Delay
        </Button>
        <Button type="button" variant="outline" onClick={() => openFor("ESCALATE")}>
          Escalate
        </Button>
        <Button type="button" variant="secondary" onClick={() => openFor("REQUEST_INFO")}>
          Request more info
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3">
            {pending === "APPROVE" ? (
              <p className="text-sm text-[var(--text-muted)]">
                You are recording executive approval to proceed. This does not replace domain approvals.
                <br />
                <span className="font-medium text-[var(--text)]">Recommendation:</span> {recLabel(view.recommendation)}
                {missingSupport ? (
                  <>
                    <br />
                    <span className="font-medium text-amber-600">Missing item:</span> Support signoff
                  </>
                ) : null}
              </p>
            ) : (
              <p className="text-sm text-[var(--text-muted)]">Add a short note for the record (required).</p>
            )}
            {pending ? (
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={pending === "APPROVE" ? "Optional context" : "Required comment"}
                rows={3}
              />
            ) : null}
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submit()}>
              {submitting ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
