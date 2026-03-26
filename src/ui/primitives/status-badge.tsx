import { Badge } from "./badge";

export type StatusKey =
  | "needs_review"
  | "needs_details"
  | "on_track"
  | "overdue"
  | "delivery_issue"
  | "waiting_on_others"
  | "monitoring"
  | "no_action_needed"
  | "verified";

const STATUS_CONFIG: Record<
  StatusKey,
  { label: string; variant: "warning" | "danger" | "success" | "secondary" | "outline" }
> = {
  needs_review: { label: "Needs review", variant: "warning" },
  needs_details: { label: "Needs details", variant: "warning" },
  on_track: { label: "On track", variant: "success" },
  overdue: { label: "Overdue", variant: "danger" },
  delivery_issue: { label: "Delivery issue", variant: "danger" },
  waiting_on_others: { label: "Waiting on others", variant: "secondary" },
  monitoring: { label: "Monitoring", variant: "secondary" },
  no_action_needed: { label: "No action needed", variant: "outline" },
  verified: { label: "Verified", variant: "success" },
};

type StatusBadgeProps = {
  status: StatusKey;
  className?: string;
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status];
  return (
    <Badge className={className} variant={cfg.variant}>
      {cfg.label}
    </Badge>
  );
}
