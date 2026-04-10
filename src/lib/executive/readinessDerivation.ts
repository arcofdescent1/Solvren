import type { ReadinessRow, ReadinessCategoryKey, ReadinessCategoryStatus } from "./types";

type ApprovalRow = { approval_area: string | null; decision: string | null; decided_at?: string | null };
type EvidenceKinds = Set<string>;
type Blocker = { title: string; severity?: string };

function norm(s: string) {
  return s.toLowerCase();
}

function matchArea(area: string, needles: string[]) {
  const a = norm(area);
  return needles.some((n) => a.includes(n));
}

function latestTs(...dates: (string | null | undefined)[]): string | null {
  const valid = dates.filter((d): d is string => !!d);
  if (valid.length === 0) return null;
  return valid.sort().at(-1) ?? null;
}

function statusFrom(
  ready: boolean,
  pending: boolean,
  blocked: boolean
): ReadinessCategoryStatus {
  if (blocked) return "BLOCKED";
  if (ready) return "READY";
  return "PENDING";
}

export type DeriveReadinessInput = {
  approvals: ApprovalRow[];
  evidenceKinds: EvidenceKinds;
  coordinationBlockers: Blocker[];
};

function blockerHitsCategory(blockers: Blocker[], needles: string[]): boolean {
  return blockers.some((b) => {
    const t = norm(b.title);
    return needles.some((n) => t.includes(n));
  });
}

export function deriveReadinessRows(input: DeriveReadinessInput): ReadinessRow[] {
  const { approvals, evidenceKinds, coordinationBlockers } = input;

  const rejected = (needles: string[]) =>
    approvals.some(
      (a) =>
        a.decision === "REJECTED" &&
        a.approval_area &&
        matchArea(String(a.approval_area), needles)
    );
  const approved = (needles: string[]) =>
    approvals.some(
      (a) =>
        a.decision === "APPROVED" &&
        a.approval_area &&
        matchArea(String(a.approval_area), needles)
    );
  const pending = (needles: string[]) =>
    approvals.some(
      (a) =>
        a.decision === "PENDING" &&
        a.approval_area &&
        matchArea(String(a.approval_area), needles)
    );

  const ownerFrom = (needles: string[]): string | null => {
    const row = approvals.find(
      (a) => a.approval_area && matchArea(String(a.approval_area), needles)
    );
    return row?.approval_area?.trim() || null;
  };

  const engBlock =
    rejected(["engineer", "engineering", "eng ", " eng"]) ||
    blockerHitsCategory(coordinationBlockers, ["engineering", "engineer"]);
  const engOk =
    evidenceKinds.has("PR") ||
    approved(["engineer", "engineering", "tech", "platform"]);
  const engPending = pending(["engineer", "engineering"]) || (!engOk && !engBlock);

  const qaBlock =
    rejected(["qa", "quality", "test"]) ||
    blockerHitsCategory(coordinationBlockers, ["qa", "quality", "test"]);
  const qaOk = evidenceKinds.has("TEST_PLAN") || approved(["qa", "quality"]);
  const qaPending = pending(["qa", "quality"]) || (!qaOk && !qaBlock);

  const supBlock =
    rejected(["support", "customer success", "cx"]) ||
    blockerHitsCategory(coordinationBlockers, ["support"]);
  const supOk =
    evidenceKinds.has("COMMS_PLAN") || approved(["support", "customer success"]);
  const supPending = pending(["support"]) || (!supOk && !supBlock);

  const salesBlock = rejected(["sales", "revops", "revenue ops"]);
  const salesOk = approved(["sales", "enablement", "revops"]);
  const salesPending = pending(["sales", "enablement"]) || (!salesOk && !salesBlock);

  const finBlock =
    rejected(["finance", "billing", "controller"]) ||
    blockerHitsCategory(coordinationBlockers, ["finance"]);
  const finOk = approved(["finance", "billing", "controller"]);
  const finPending = pending(["finance", "billing"]) || (!finOk && !finBlock);

  const rbBlock =
    rejected(["rollback", "recovery"]) ||
    blockerHitsCategory(coordinationBlockers, ["rollback"]);
  const rbOk = evidenceKinds.has("ROLLBACK");
  const rbPending = !rbOk && !rbBlock;

  const monBlock =
    rejected(["monitor", "observability", "sre"]) ||
    blockerHitsCategory(coordinationBlockers, ["monitor", "alert", "observability"]);
  const monOk = evidenceKinds.has("DASHBOARD") || evidenceKinds.has("RUNBOOK");
  const monPending = !monOk && !monBlock;

  const rows: Array<{ key: ReadinessCategoryKey; status: ReadinessCategoryStatus; owner: string | null; updatedAt: string | null }> = [
    {
      key: "Engineering",
      status: statusFrom(engOk, engPending, engBlock),
      owner: ownerFrom(["engineer", "engineering", "tech"]) ?? (engOk || engPending || engBlock ? "Unassigned" : "Unassigned"),
      updatedAt: latestTs(
        ...approvals
          .filter((a) => a.approval_area && matchArea(String(a.approval_area), ["engineer", "engineering"]))
          .map((a) => a.decided_at ?? null)
      ),
    },
    {
      key: "QA",
      status: statusFrom(qaOk, qaPending, qaBlock),
      owner: ownerFrom(["qa", "quality"]) ?? "Unassigned",
      updatedAt: latestTs(
        ...approvals
          .filter((a) => a.approval_area && matchArea(String(a.approval_area), ["qa", "quality"]))
          .map((a) => a.decided_at ?? null)
      ),
    },
    {
      key: "Support",
      status: statusFrom(supOk, supPending, supBlock),
      owner: ownerFrom(["support", "customer"]) ?? "Unassigned",
      updatedAt: latestTs(
        ...approvals
          .filter((a) => a.approval_area && matchArea(String(a.approval_area), ["support", "customer"]))
          .map((a) => a.decided_at ?? null)
      ),
    },
    {
      key: "Sales",
      status: statusFrom(salesOk, salesPending, salesBlock),
      owner: ownerFrom(["sales", "enablement"]) ?? "Unassigned",
      updatedAt: latestTs(
        ...approvals
          .filter((a) => a.approval_area && matchArea(String(a.approval_area), ["sales", "enablement"]))
          .map((a) => a.decided_at ?? null)
      ),
    },
    {
      key: "Finance",
      status: statusFrom(finOk, finPending, finBlock),
      owner: ownerFrom(["finance", "billing"]) ?? "Unassigned",
      updatedAt: latestTs(
        ...approvals
          .filter((a) => a.approval_area && matchArea(String(a.approval_area), ["finance", "billing"]))
          .map((a) => a.decided_at ?? null)
      ),
    },
    {
      key: "Rollback Plan",
      status: statusFrom(rbOk, rbPending, rbBlock),
      owner: "Unassigned",
      updatedAt: null,
    },
    {
      key: "Monitoring / Alerting",
      status: statusFrom(monOk, monPending, monBlock),
      owner: ownerFrom(["sre", "monitor", "ops"]) ?? "Unassigned",
      updatedAt: latestTs(
        ...approvals
          .filter((a) => a.approval_area && matchArea(String(a.approval_area), ["sre", "monitor", "ops"]))
          .map((a) => a.decided_at ?? null)
      ),
    },
  ];

  return rows.map((r) => ({
    category: r.key,
    status: r.status,
    owner: r.owner,
    updatedAt: r.updatedAt,
  }));
}
