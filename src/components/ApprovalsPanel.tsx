"use client";

import { Button } from "@/ui";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

  async function decide(
    approvalId: string,
    decision: "APPROVED" | "REJECTED"
  ) {
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
      code?: string;
      missingEvidence?: string[];
      warning?: string;
      nextStatus?: string;
      missingEvidenceKinds?: string[];
    };

    setBusyId(null);

    if (!resp.ok) {
      const missing = json?.missingEvidence ?? json?.missingEvidenceKinds ?? [];
      setMissingEvidenceKinds(missing);
      setMsg(json?.message ?? json?.error ?? "Failed.");
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
        document
          .getElementById("evidence-panel")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    } else {
      setMsg(decision === "APPROVED" ? "Approved." : "Rejected.");
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
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Approvals</h2>
        <Button
          type="button"
          className="text-xs underline opacity-70"
          onClick={() => setMsg(null)}
          disabled={!msg}
        >
          Dismiss
        </Button>
      </div>
      {missingApprovalAreas.length > 0 && (
        <div className="text-sm border rounded p-2 border-yellow-300 bg-yellow-50">
          Governance requires approvals that haven&apos;t been created yet:{" "}
          <b>{missingApprovalAreas.join(", ")}</b>. Re-run checklist generation
          to sync approval lanes.
        </div>
      )}
      {msg && (
        <div
          className={`text-sm border rounded p-2 ${
            msgKind === "warning"
              ? "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30"
              : msgKind === "error"
                ? "border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-950/30"
                : "border-gray-200 bg-gray-50 dark:border-[var(--border)] dark:bg-[var(--bg-surface)]"
          }`}
        >
          {msg}
          {missingEvidenceKinds.length > 0 && (
            <div className="mt-2 text-xs">
              Missing: {missingEvidenceKinds.join(", ")}
            </div>
          )}
          {(msgKind === "warning" || msgKind === "error") && missingEvidenceKinds.length > 0 && (
            <Button
              type="button"
              variant="link"
              onClick={scrollToEvidence}
              className="mt-2 text-xs font-medium"
            >
              Go to Evidence Checklist
            </Button>
          )}
        </div>
      )}
      <div className="space-y-2">
        {approvals.map((a) => {
          const isAssigned = a.approver_user_id === currentUserId;
          return (
            <div key={a.id} className="border rounded p-3 text-sm space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold">{a.approval_area}</div>
                <div className="text-xs opacity-70">{a.decision}</div>
              </div>
              {isAssigned && a.decision === "PENDING" && (
                <div className="flex gap-2">
                  <Button
                    className="px-3 py-1 rounded bg-black text-white text-xs disabled:opacity-60"
                    disabled={busyId === a.id}
                    onClick={() => decide(a.id, "APPROVED")}
                  >
                    Approve
                  </Button>
                  <Button
                    className="px-3 py-1 rounded border text-xs disabled:opacity-60"
                    disabled={busyId === a.id}
                    onClick={() => decide(a.id, "REJECTED")}
                  >
                    Reject
                  </Button>
                </div>
              )}
              {a.comment && (
                <div className="text-xs opacity-80">Comment: {a.comment}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
