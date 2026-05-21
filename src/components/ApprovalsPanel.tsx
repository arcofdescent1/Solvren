"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/ui";
import { postPhase3Interaction } from "@/components/onboarding/phase3/postPhase3Interaction";

type Approval = {
  id: string;
  approval_area: string;
  decision: "PENDING" | "APPROVED" | "REJECTED";
  comment: string | null;
  approver_user_id: string;
  decided_at: string | null;
};

type MsgKind = "info" | "warning" | "error";

function decisionVariant(decision: Approval["decision"]): "success" | "danger" | "warning" {
  if (decision === "APPROVED") return "success";
  if (decision === "REJECTED") return "danger";
  return "warning";
}

function decisionLabel(decision: Approval["decision"]) {
  if (decision === "APPROVED") return "Approved";
  if (decision === "REJECTED") return "Rejected";
  return "Waiting";
}

export default function ApprovalsPanel({
  approvals,
  currentUserId,
  requiredApprovalAreas = [],
}: {
  approvals: Approval[];
  currentUserId: string;
  requiredApprovalAreas?: string[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [msgKind, setMsgKind] = useState<MsgKind>("info");
  const [missingEvidenceKinds, setMissingEvidenceKinds] = useState<string[]>([]);

  const missingApprovalAreas = (() => {
    if (!requiredApprovalAreas?.length) return [];
    const present = new Set((approvals ?? []).map((a) => a.approval_area));
    return requiredApprovalAreas.filter((a) => !present.has(a));
  })();

  async function decide(approvalId: string, decision: "APPROVED" | "REJECTED") {
    setMsg(null);
    setMsgKind("info");
    setMissingEvidenceKinds([]);
    setBusyId(approvalId);

    const resp = await fetch("/api/approvals/decide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalId, decision }),
    });

    const json = (await resp.json().catch(() => ({}))) as {
      error?: string;
      message?: string;
      missingEvidence?: string[];
      warning?: string;
      missingEvidenceKinds?: string[];
    };

    setBusyId(null);

    if (!resp.ok) {
      const missing = json?.missingEvidence ?? json?.missingEvidenceKinds ?? [];
      setMissingEvidenceKinds(missing);
      setMsg(json?.message ?? json?.error ?? "Decision could not be saved.");
      setMsgKind("error");
      if (missing.length > 0) {
        document.getElementById("evidence-checklist")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    if (json?.warning) {
      setMsg(json.warning);
      setMsgKind("warning");
      setMissingEvidenceKinds(json?.missingEvidenceKinds ?? []);
      if (json?.missingEvidenceKinds?.length) {
        document.getElementById("evidence-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      setMsg(decision === "APPROVED" ? "Approval recorded." : "Rejection recorded.");
      setMsgKind("info");
    }

    postPhase3Interaction({ type: "approval_decision", refType: "approval", refId: approvalId });
    router.refresh();
    window.dispatchEvent(new CustomEvent("timeline:refresh"));
  }

  function scrollToEvidence() {
    (document.getElementById("evidence-checklist") ?? document.getElementById("evidence-panel"))?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Decision owners</CardTitle>
          <CardDescription>Who still needs to approve, reject, or unblock this change.</CardDescription>
        </div>
        {msg ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setMsg(null)}>
            Dismiss
          </Button>
        ) : null}
      </CardHeader>

      <CardBody className="space-y-4">
        {missingApprovalAreas.length > 0 ? (
          <div className="rounded-[var(--radius-md)] border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
            Add decision owners for: <strong>{missingApprovalAreas.join(", ")}</strong>.
          </div>
        ) : null}

        {msg ? (
          <div
            className={`rounded-[var(--radius-md)] border p-3 text-sm ${
              msgKind === "warning"
                ? "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100"
                : msgKind === "error"
                  ? "border-red-300 bg-red-50 text-red-950 dark:border-red-700 dark:bg-red-950/30 dark:text-red-100"
                  : "border-[var(--border)] bg-[var(--bg-surface-2)] text-[var(--text)]"
            }`}
          >
            <div>{msg}</div>
            {missingEvidenceKinds.length > 0 ? (
              <div className="mt-2">
                Missing proof: {missingEvidenceKinds.join(", ")}
                <Button type="button" variant="link" onClick={scrollToEvidence} className="ml-2 h-auto p-0 text-sm">
                  Go to proof
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {approvals.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border)] bg-[var(--bg-surface-2)] p-4 text-sm text-[var(--text-muted)]">
            No decision owners have been assigned yet.
          </div>
        ) : (
          <div className="grid gap-3">
            {approvals.map((a) => {
              const isAssigned = a.approver_user_id === currentUserId;
              return (
                <div key={a.id} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="text-sm font-semibold">{a.approval_area}</div>
                      {a.comment ? <p className="mt-1 text-sm text-[var(--text-muted)]">{a.comment}</p> : null}
                      {a.decided_at ? <p className="mt-1 text-xs text-[var(--text-muted)]">Decided {new Date(a.decided_at).toLocaleString()}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={decisionVariant(a.decision)}>{decisionLabel(a.decision)}</Badge>
                      {isAssigned && a.decision === "PENDING" ? (
                        <>
                          <Button size="sm" disabled={busyId === a.id} onClick={() => decide(a.id, "APPROVED")}>
                            Approve
                          </Button>
                          <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => decide(a.id, "REJECTED")}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
