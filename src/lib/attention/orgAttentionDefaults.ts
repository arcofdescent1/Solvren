import type { OrgAttentionSettingsResolved, AttentionRouteType } from "./types";

type StoredDefaultRoute = Exclude<AttentionRouteType, "SUPPRESS">;

const STORED_ROUTES: StoredDefaultRoute[] = ["IMMEDIATE", "DAILY_DIGEST", "WEEKLY_DIGEST"];

function parseDefaultRoute(v: string | null | undefined, fallback: StoredDefaultRoute): StoredDefaultRoute {
  const u = String(v ?? "").toUpperCase();
  return STORED_ROUTES.includes(u as StoredDefaultRoute) ? (u as StoredDefaultRoute) : fallback;
}

export function resolveOrgAttentionSettings(
  row: Record<string, unknown> | null | undefined
): OrgAttentionSettingsResolved {
  const r = row ?? {};
  const num = (k: string, d: number) => {
    const v = r[k];
    return v != null && Number.isFinite(Number(v)) ? Number(v) : d;
  };
  const bool = (k: string, d: boolean) => {
    const v = r[k];
    return v === null || v === undefined ? d : Boolean(v);
  };
  return {
    executiveRevenueThresholdUsd: num("executive_revenue_escalation_threshold_usd", 100_000),
    seniorTechRevenueThresholdUsd: num("senior_tech_revenue_escalation_threshold_usd", 50_000),
    departmentLeaderRevenueThresholdUsd: num("department_leader_revenue_escalation_threshold_usd", 25_000),
    immediateDeployWindowHours: Math.max(1, Math.floor(num("immediate_deploy_window_hours", 24))),
    digestIncludeMediumRisk: bool("digest_include_medium_risk", true),
    suppressLowRiskExecNotifications: bool("suppress_low_risk_exec_notifications", true),
    executiveDefaultRoute: parseDefaultRoute(r.executive_default_route as string | null, "IMMEDIATE"),
    seniorTechDefaultRoute: parseDefaultRoute(r.senior_tech_default_route as string | null, "IMMEDIATE"),
    departmentLeaderDefaultRoute: parseDefaultRoute(r.department_leader_default_route as string | null, "IMMEDIATE"),
    operatorDefaultRoute: parseDefaultRoute(r.operator_default_route as string | null, "IMMEDIATE"),
    attentionDailyDigestEnabled: bool("attention_daily_digest_enabled", false),
    attentionWeeklyDigestEnabled: bool("attention_weekly_digest_enabled", false),
    fallbackOperatorUserId:
      r.attention_fallback_operator_user_id != null
        ? String(r.attention_fallback_operator_user_id)
        : null,
  };
}

export const ORG_ATTENTION_SETTINGS_SELECT =
  "executive_revenue_escalation_threshold_usd, senior_tech_revenue_escalation_threshold_usd, department_leader_revenue_escalation_threshold_usd, immediate_deploy_window_hours, digest_include_medium_risk, suppress_low_risk_exec_notifications, executive_default_route, senior_tech_default_route, department_leader_default_route, operator_default_route, attention_daily_digest_enabled, attention_weekly_digest_enabled, attention_fallback_operator_user_id";
