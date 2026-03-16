export type ChangeType =
  | "PRICING"
  | "BILLING"
  | "CRM_SCHEMA"
  | "REVENUE_INTEGRATION"
  | "CONTRACT"
  | "MARKETING_AUTOMATION"
  | "OTHER";

export type ChangeIntake = {
  title: string;
  changeType: ChangeType;
  systemsInvolved: string[];
  revenueImpactAreas: string[];
  impactsActiveCustomers: boolean;
  altersPricingVisibility: boolean;
  backfillRequired: boolean;
  dataMigrationRequired: boolean;
  requiresCodeDeploy: boolean;
  reversibleViaConfig: boolean;
  requiresDBRestore: boolean;
  requiresManualDataCorrection: boolean;
  rollbackTimeEstimateHours?: number | null;
  requestedReleaseAt?: string | null;
  description?: string;
};

type RuleReason = { kind: "rule"; id: string; note?: string };
type IntakeReason = { kind: "intake_field"; path: string; note?: string };

export type DeterministicSignal = {
  key: string;
  category:
    | "FINANCIAL_EXPOSURE"
    | "DATA_INTEGRITY"
    | "REPORTING_ACCURACY"
    | "CUSTOMER_IMPACT"
    | "AUTOMATION_INTEGRATION"
    | "ROLLBACK_COMPLEXITY";
  value_type: "BOOLEAN" | "NUMBER";
  value_bool?: boolean;
  value_num?: number;
  confidence: number;
  reasons: (RuleReason | IntakeReason)[];
  source: "RULE";
};

const billingSystems = ["Stripe", "Chargebee", "Zuora", "Recurly", "Braintree"];
const marketingSystems = ["HubSpot", "Marketo", "Pardot"];
const crmSystems = ["Salesforce", "HubSpot"];

export function runDeterministicRules(intake: ChangeIntake): DeterministicSignal[] {
  const out: DeterministicSignal[] = [];
  const addBool = (
    key: string,
    category: DeterministicSignal["category"],
    value: boolean,
    ruleId: string,
    fieldPath?: string
  ) => {
    if (!value) return;
    out.push({
      key,
      category,
      value_type: "BOOLEAN",
      value_bool: true,
      confidence: 1.0,
      reasons: [
        { kind: "rule", id: ruleId },
        ...(fieldPath ? [{ kind: "intake_field", path: fieldPath } as const] : []),
      ],
      source: "RULE",
    });
  };
  const addNum = (
    key: string,
    category: DeterministicSignal["category"],
    value: number,
    ruleId: string,
    fieldPath?: string
  ) => {
    out.push({
      key,
      category,
      value_type: "NUMBER",
      value_num: value,
      confidence: 1.0,
      reasons: [
        { kind: "rule", id: ruleId },
        ...(fieldPath ? [{ kind: "intake_field", path: fieldPath } as const] : []),
      ],
      source: "RULE",
    });
  };

  addNum(
    "number_of_systems_involved",
    "AUTOMATION_INTEGRATION",
    intake.systemsInvolved.length,
    "R04",
    "systemsInvolved"
  );

  addBool(
    "requires_multi_system_coordination",
    "AUTOMATION_INTEGRATION",
    intake.systemsInvolved.length > 1,
    "R05",
    "systemsInvolved"
  );

  const hasBilling = intake.systemsInvolved.some((s) => billingSystems.includes(s));
  addBool("affects_active_billing_system", "FINANCIAL_EXPOSURE", hasBilling, "R01", "systemsInvolved");

  addBool(
    "affects_salesforce_workflows",
    "AUTOMATION_INTEGRATION",
    intake.systemsInvolved.includes("Salesforce"),
    "R02",
    "systemsInvolved"
  );

  const hasMarketing = intake.systemsInvolved.some((s) => marketingSystems.includes(s));
  addBool("affects_marketing_automation", "AUTOMATION_INTEGRATION", hasMarketing, "R03", "systemsInvolved");

  addBool(
    "modifies_pricing_logic",
    "FINANCIAL_EXPOSURE",
    intake.changeType === "PRICING",
    "R10",
    "changeType"
  );
  addBool(
    "touches_payment_processing_flow",
    "FINANCIAL_EXPOSURE",
    intake.changeType === "BILLING",
    "R11",
    "changeType"
  );
  addBool(
    "affects_invoice_generation",
    "FINANCIAL_EXPOSURE",
    intake.changeType === "BILLING",
    "R11b",
    "changeType"
  );
  addBool(
    "crm_schema_change",
    "DATA_INTEGRITY",
    intake.changeType === "CRM_SCHEMA",
    "R12",
    "changeType"
  );
  addBool(
    "affects_marketing_automation",
    "AUTOMATION_INTEGRATION",
    intake.changeType === "MARKETING_AUTOMATION",
    "R13",
    "changeType"
  );

  addBool(
    "impacts_active_customers",
    "CUSTOMER_IMPACT",
    intake.impactsActiveCustomers,
    "R20",
    "impactsActiveCustomers"
  );
  addBool(
    "alters_pricing_visibility",
    "CUSTOMER_IMPACT",
    intake.altersPricingVisibility,
    "R21",
    "altersPricingVisibility"
  );
  addBool(
    "requires_backfill_billing",
    "FINANCIAL_EXPOSURE",
    intake.backfillRequired,
    "R22",
    "backfillRequired"
  );
  addBool(
    "requires_historical_data_migration",
    "DATA_INTEGRITY",
    intake.dataMigrationRequired,
    "R23",
    "dataMigrationRequired"
  );
  addBool(
    "requires_code_deploy",
    "ROLLBACK_COMPLEXITY",
    intake.requiresCodeDeploy,
    "R24",
    "requiresCodeDeploy"
  );
  addBool(
    "reversible_via_config",
    "ROLLBACK_COMPLEXITY",
    intake.reversibleViaConfig,
    "R25",
    "reversibleViaConfig"
  );
  addBool(
    "requires_database_restore",
    "ROLLBACK_COMPLEXITY",
    intake.requiresDBRestore,
    "R26",
    "requiresDBRestore"
  );
  addBool(
    "requires_manual_data_correction",
    "ROLLBACK_COMPLEXITY",
    intake.requiresManualDataCorrection,
    "R27",
    "requiresManualDataCorrection"
  );
  if (typeof intake.rollbackTimeEstimateHours === "number") {
    addNum(
      "rollback_time_estimate_hours",
      "ROLLBACK_COMPLEXITY",
      intake.rollbackTimeEstimateHours,
      "R28",
      "rollbackTimeEstimateHours"
    );
  }

  if (intake.revenueImpactAreas.includes("MRR/ARR")) {
    addBool(
      "impacts_recurring_revenue_calculation",
      "FINANCIAL_EXPOSURE",
      true,
      "R30",
      "revenueImpactAreas"
    );
  }
  if (intake.revenueImpactAreas.includes("Reporting")) {
    addBool("impacts_dashboard_metrics", "REPORTING_ACCURACY", true, "R31", "revenueImpactAreas");
  }
  if (intake.revenueImpactAreas.includes("Revenue recognition")) {
    addBool(
      "modifies_revenue_recognition_logic",
      "FINANCIAL_EXPOSURE",
      true,
      "R32",
      "revenueImpactAreas"
    );
  }
  if (intake.revenueImpactAreas.includes("Discounts")) {
    addBool("modifies_discount_rules", "FINANCIAL_EXPOSURE", true, "R33", "revenueImpactAreas");
  }
  if (intake.revenueImpactAreas.includes("Trial")) {
    addBool("impacts_trial_logic", "CUSTOMER_IMPACT", true, "R34", "revenueImpactAreas");
  }

  return out;
}

export type EvaluateResult = {
  baseRisk: number;
  detectedSignals: string[];
  explanation: Record<string, unknown>;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/**
 * DB-driven detector: keywords array and optional regex on title+description.
 * Expand detector shape in DB without schema changes.
 */
function detectorMatches(
  detector: Record<string, unknown> | null | undefined,
  change: Record<string, unknown>
): boolean {
  const text = `${String(change.title ?? "")}\n${String(change.description ?? "")}`.toLowerCase();

  if (Array.isArray(detector?.keywords) && (detector.keywords as string[]).length) {
    const hit = (detector.keywords as string[]).some((k) =>
      text.includes(String(k).toLowerCase())
    );
    if (hit) return true;
  }

  if (detector?.regex) {
    try {
      const re = new RegExp(String(detector.regex), "i");
      if (re.test(text)) return true;
    } catch {
      // ignore invalid regex
    }
  }

  return false;
}

/**
 * Load change from DB, run deterministic rules, compute base risk.
 * When domain_signals exist for the change's domain, uses DB-driven detectors and weights;
 * otherwise falls back to intake-based runDeterministicRules + WEIGHTS.
 */
export async function evaluateDeterministicRules(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  args: { orgId: string; changeId: string }
): Promise<EvaluateResult> {
  const { orgId, changeId } = args;

  const { data: changeRow, error: changeErr } = await supabase
    .from("change_events")
    .select("id, org_id, domain, title, description, intake")
    .eq("id", changeId)
    .maybeSingle();

  if (changeErr) throw new Error(String(changeErr));
  const row = (changeRow ?? {}) as Record<string, unknown>;
  const intakeObj = row.intake as Record<string, unknown> | null | undefined;
  const change: Record<string, unknown> = {
    ...row,
    description: row.description ?? intakeObj?.description ?? "",
  };
  const domainKey = (row.domain ?? "REVENUE") as string;

  try {
    const { getResolvedDomainSignals } = await import("@/services/domains/domainSignals");
    const signals = await getResolvedDomainSignals(supabase, {
      orgId,
      domainKey,
    });

    if (signals.length > 0) {
      const detected: Array<{ signalKey: string; weight: number; reason: unknown }> = [];
      for (const s of signals) {
        if (detectorMatches(s.detector as Record<string, unknown>, change)) {
          detected.push({
            signalKey: s.signalKey,
            weight: Number(s.weight ?? 1),
            reason: { detector: s.detector, matched: true },
          });
        }
      }
      const raw = detected.reduce((acc, d) => acc + d.weight * 10, 0);
      const baseRisk = clamp(raw, 0, 100);
      return {
        baseRisk,
        detectedSignals: detected.map((d) => d.signalKey),
        explanation: {
          domainKey,
          detected,
          baseRisk,
          formula: "sum(weight * 10) capped 0..100",
        },
      };
    }
  } catch {
    // Fall through to intake-based evaluation
  }

  const { data: changeData, error } = await supabase
    .from("change_events")
    .select(
      "change_type,intake,systems_involved,revenue_impact_areas,impacts_active_customers,alters_pricing_visibility,backfill_required,data_migration_required,requires_code_deploy,reversible_via_config,requires_db_restore,requires_manual_data_correction,rollback_time_estimate_hours"
    )
    .eq("id", changeId)
    .maybeSingle();

  if (error) throw new Error(String(error));
  const c = (changeData ?? {}) as Record<string, unknown>;
  const intake = (c.intake ?? {}) as Record<string, unknown>;

  const runIntake: ChangeIntake = {
    title: String(intake.title ?? ""),
    changeType: (c.change_type ?? "OTHER") as ChangeIntake["changeType"],
    systemsInvolved: Array.isArray(c.systems_involved) ? (c.systems_involved as string[]) : [],
    revenueImpactAreas: Array.isArray(c.revenue_impact_areas) ? (c.revenue_impact_areas as string[]) : [],
    impactsActiveCustomers: Boolean(c.impacts_active_customers),
    altersPricingVisibility: Boolean(c.alters_pricing_visibility),
    backfillRequired: Boolean(c.backfill_required),
    dataMigrationRequired: Boolean(c.data_migration_required),
    requiresCodeDeploy: Boolean(c.requires_code_deploy),
    reversibleViaConfig: Boolean(c.reversible_via_config),
    requiresDBRestore: Boolean(c.requires_db_restore),
    requiresManualDataCorrection: Boolean(c.requires_manual_data_correction),
    rollbackTimeEstimateHours:
      typeof c.rollback_time_estimate_hours === "number"
        ? c.rollback_time_estimate_hours
        : undefined,
    description: typeof intake.description === "string" ? intake.description : undefined,
    requestedReleaseAt: intake.requested_release_at as string | null | undefined,
  };

  const signals = runDeterministicRules(runIntake);
  const detectedSignals = signals.map((s) => s.key);

  const { WEIGHTS } = await import("./weights");
  let baseScore = 0;
  for (const s of signals) {
    const w = WEIGHTS[s.key] ?? 0;
    if (s.value_type === "BOOLEAN" && s.value_bool) {
      baseScore += w;
    } else if (s.value_type === "NUMBER") {
      if (s.key === "number_of_systems_involved") {
        baseScore += Math.max(0, (s.value_num ?? 0) - 2) * w;
      } else if (s.key === "rollback_time_estimate_hours") {
        baseScore += Math.floor(Math.max(0, s.value_num ?? 0) / 2) * w;
      }
    }
  }

  return {
    baseRisk: Math.round(Math.max(0, baseScore)),
    detectedSignals,
    explanation: {
      signals: signals.map((s) => ({
        key: s.key,
        value_type: s.value_type,
        value_bool: s.value_bool,
        value_num: s.value_num,
        weight: WEIGHTS[s.key] ?? 0,
      })),
      baseScore,
    },
  };
}
