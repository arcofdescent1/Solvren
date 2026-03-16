/**
 * GET /api/change-statuses
 * Returns Solvren change statuses for status mapping UIs.
 */
import { NextResponse } from "next/server";
import { RG_CHANGE_STATUSES } from "@/lib/changes/statuses";

const LABELS: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  SUBMITTED: "Submitted",
  IN_REVIEW: "In Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CLOSED: "Closed",
  RESOLVED: "Resolved",
};

export async function GET() {
  const statuses = RG_CHANGE_STATUSES.map((s) => ({
    value: s,
    label: LABELS[s] ?? s,
  }));
  return NextResponse.json({ statuses });
}
