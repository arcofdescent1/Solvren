type Severity = "INFO" | "WARNING" | "CRITICAL";

export type TemplateKey =
  | "approval_requested"
  | "approval_due_soon"
  | "approval_overdue"
  | "approval_approved"
  | "approval_rejected"
  | "evidence_missing"
  | "evidence_requested"
  | "sla_due_soon"
  | "sla_overdue"
  | "sla_escalated"
  | "change_submitted"
  | "change_approved"
  | "change_rejected"
  | "change_reopened"
  | "comment_added"
  | "daily_inbox"
  | "weekly_digest"
  | "high_risk_change_detected";

export type Rendered = {
  title: string;
  body: string;
  severity: Severity;
  cta_label: string;
  cta_url: string;
};

function changeUrl(changeEventId: string) {
  return `/changes/${changeEventId}`;
}

export function renderTemplate(
  template_key: string,
  payload: Record<string, unknown>
): Rendered | null {
  if (template_key === "daily_inbox") {
    return {
      title: "Revenue Risk Inbox",
      body: "Daily summary of high-risk changes",
      severity: "INFO",
      cta_label: "View dashboard",
      cta_url: "/dashboard",
    };
  }
  if (template_key === "weekly_digest") {
    const rangeLabel = String(payload?.rangeLabel ?? "Last 7 days");
    return {
      title: `Weekly Risk Digest — ${rangeLabel}`,
      body: "Weekly executive summary of high-risk and SLA exception changes.",
      severity: "INFO",
      cta_label: "Open dashboard",
      cta_url: "/dashboard",
    };
  }
  if (template_key === "high_risk_change_detected") {
    const riskEventId = String(payload?.riskEventId ?? "");
    const provider = String(payload?.provider ?? "").toLowerCase();
    const riskType = String(payload?.riskType ?? "change").replace(/_/g, " ");
    const impact = payload?.impactAmount != null ? Number(payload.impactAmount) : 0;
    const impactStr = Number.isFinite(impact) && impact > 0
      ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(impact)
      : "";
    const body = impactStr
      ? `${impactStr} ${riskType} without approval`
      : `High-risk ${riskType} detected without approval`;
    return {
      title: "High Risk Change Detected",
      body: `${provider ? `${provider.charAt(0).toUpperCase() + provider.slice(1)}: ` : ""}${body}`,
      severity: "CRITICAL",
      cta_label: "Investigate",
      cta_url: riskEventId ? `/risk/event/${riskEventId}` : "/dashboard/executive-risk",
    };
  }
  const changeEventId = String(payload?.changeEventId ?? "");
  if (!changeEventId) return null;

  const dueAt = payload?.due_at
    ? new Date(payload.due_at as string).toLocaleString()
    : null;
  const risk = payload?.risk_bucket ? String(payload.risk_bucket) : null;

  switch (template_key as TemplateKey) {
    case "approval_requested":
      return {
        title: `Approval requested${risk ? ` (${risk})` : ""}`,
        body: `A change is ready for your review.${dueAt ? ` Due: ${dueAt}.` : ""}`,
        severity: "INFO",
        cta_label: "Open change",
        cta_url: changeUrl(changeEventId),
      };

    case "approval_due_soon":
      return {
        title: "Approval due soon",
        body: `This change is approaching its SLA.${dueAt ? ` Due: ${dueAt}.` : ""}`,
        severity: "WARNING",
        cta_label: "Review now",
        cta_url: changeUrl(changeEventId),
      };

    case "approval_overdue":
      return {
        title: "Approval overdue",
        body: `This change is past its SLA.${dueAt ? ` Due: ${dueAt}.` : ""}`,
        severity: "CRITICAL",
        cta_label: "Fix now",
        cta_url: changeUrl(changeEventId),
      };

    case "evidence_missing": {
      const missing = Array.isArray(payload?.missingEvidenceKinds)
        ? (payload.missingEvidenceKinds as string[]).join(", ")
        : "";
      return {
        title: "Missing required evidence",
        body: missing
          ? `Approval is blocked until evidence is attached: ${missing}.`
          : "Approval is blocked until required evidence is attached.",
        severity: "WARNING",
        cta_label: "Attach evidence",
        cta_url: changeUrl(changeEventId) + "#evidence-panel",
      };
    }

    case "sla_due_soon":
      return {
        title: "SLA due soon",
        body: `This change is approaching its due date.${dueAt ? ` Due: ${dueAt}.` : ""}`,
        severity: "WARNING",
        cta_label: "Review",
        cta_url: changeUrl(changeEventId),
      };

    case "sla_overdue":
      return {
        title: "SLA overdue",
        body: `This change is past its due date.${dueAt ? ` Due: ${dueAt}.` : ""}`,
        severity: "CRITICAL",
        cta_label: "Review now",
        cta_url: changeUrl(changeEventId),
      };

    case "sla_escalated":
      return {
        title: "SLA escalated",
        body: "This change has been escalated and needs attention.",
        severity: "CRITICAL",
        cta_label: "Open change",
        cta_url: changeUrl(changeEventId),
      };

    case "change_submitted": {
      const title = payload?.title ? String(payload.title) : "Your change";
      return {
        title: "Change submitted",
        body: `${title} has been submitted for review.`,
        severity: "INFO",
        cta_label: "View change",
        cta_url: changeUrl(changeEventId),
      };
    }

    case "change_approved":
      return {
        title: "Change approved",
        body: (payload?.title ? `${String(payload.title)} has been approved.` : "Your change has been approved."),
        severity: "INFO",
        cta_label: "View change",
        cta_url: changeUrl(changeEventId),
      };

    case "change_rejected":
      return {
        title: "Change rejected",
        body: (payload?.title ? `${String(payload.title)} was rejected.` : "Your change was rejected."),
        severity: "WARNING",
        cta_label: "View change",
        cta_url: changeUrl(changeEventId),
      };

    case "change_reopened":
      return {
        title: "Change reopened",
        body: (payload?.title ? `${String(payload.title)} has been reopened.` : "A change was reopened."),
        severity: "INFO",
        cta_label: "View change",
        cta_url: changeUrl(changeEventId),
      };

    case "comment_added": {
      const preview = payload?.commentPreview
        ? String(payload.commentPreview).slice(0, 80)
        : "New comment";
      return {
        title: "New comment",
        body: (payload?.title ? `Comment on ${String(payload.title)}: ${preview}` : preview),
        severity: "INFO",
        cta_label: "View change",
        cta_url: changeUrl(changeEventId),
      };
    }

    case "approval_approved":
    case "approval_rejected":
      return {
        title: template_key === "approval_approved" ? "Approval given" : "Approval rejected",
        body: (payload?.title ? `Update on ${String(payload.title)}.` : "An approval was updated."),
        severity: "INFO",
        cta_label: "View change",
        cta_url: changeUrl(changeEventId),
      };

    case "evidence_requested":
      return {
        title: "Evidence requested",
        body: (payload?.title ? `Evidence requested for ${String(payload.title)}.` : "Evidence has been requested."),
        severity: "WARNING",
        cta_label: "Add evidence",
        cta_url: changeUrl(changeEventId) + "#evidence-panel",
      };

    default:
      return null;
  }
}
