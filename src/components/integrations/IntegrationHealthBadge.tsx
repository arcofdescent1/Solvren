/**
 * Phase 1 — Status badge for integration account (§7.2, §13.3).
 */
import type { IntegrationAccountStatus } from "@/modules/integrations/contracts/types";

const STATUS_LABELS: Record<IntegrationAccountStatus, string> = {
  not_installed: "Not installed",
  installing: "Installing",
  connected: "Connected",
  connected_limited: "Limited",
  degraded: "Degraded",
  syncing: "Syncing",
  action_limited: "Actions limited",
  auth_expired: "Auth expired",
  error: "Error",
  disconnected: "Disconnected",
};

const STATUS_VARIANT: Record<IntegrationAccountStatus, "success" | "secondary" | "danger" | "outline"> = {
  not_installed: "outline",
  installing: "secondary",
  connected: "success",
  connected_limited: "secondary",
  degraded: "secondary",
  syncing: "secondary",
  action_limited: "secondary",
  auth_expired: "danger",
  error: "danger",
  disconnected: "outline",
};

export function IntegrationHealthBadge({
  status,
  className,
}: {
  status: IntegrationAccountStatus | string;
  className?: string;
}) {
  const label = STATUS_LABELS[status as IntegrationAccountStatus] ?? status;
  const variant = STATUS_VARIANT[status as IntegrationAccountStatus] ?? "outline";
  return (
    <span
      className={
        className ??
        `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          variant === "success"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
            : variant === "danger"
              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
              : "bg-[var(--bg-muted)] text-[var(--text-muted)]"
        }`
      }
    >
      {label}
    </span>
  );
}
