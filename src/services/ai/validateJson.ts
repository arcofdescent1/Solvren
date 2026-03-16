export function validateRevenueImpactReport(obj: unknown): { ok: false; errors: string[] } | { ok: true } {
  const errs: string[] = [];
  const o = obj as Record<string, unknown> | null;
  const arr = (k: string) =>
    Array.isArray(o?.[k]) && (o![k] as unknown[]).every((x) => typeof x === "string");

  const req = (k: string, ok: boolean) => {
    if (!ok) errs.push(`Invalid/missing: ${k}`);
  };

  req("impactedRevenueSystems", arr("impactedRevenueSystems"));
  req("hiddenDependencies", arr("hiddenDependencies"));
  req("financialRiskFactors", arr("financialRiskFactors"));
  req("reportingImpactAreas", arr("reportingImpactAreas"));
  req("requiredStakeholders", arr("requiredStakeholders"));
  req("requiredApprovals", arr("requiredApprovals"));
  req("testScenarios", arr("testScenarios"));
  req("customerCommunicationChecklist", arr("customerCommunicationChecklist"));
  req("rollbackPlan", arr("rollbackPlan"));

  req(
    "estimatedRiskScore",
    Number.isInteger(o?.estimatedRiskScore) &&
      (o!.estimatedRiskScore as number) >= 1 &&
      (o!.estimatedRiskScore as number) <= 5
  );
  req(
    "riskExplanation",
    typeof o?.riskExplanation === "string" && (o.riskExplanation as string).length >= 10
  );
  req(
    "confidenceScore",
    typeof o?.confidenceScore === "number" &&
      (o.confidenceScore as number) >= 0 &&
      (o.confidenceScore as number) <= 1
  );

  const allowed = new Set([
    "impactedRevenueSystems",
    "hiddenDependencies",
    "financialRiskFactors",
    "reportingImpactAreas",
    "requiredStakeholders",
    "requiredApprovals",
    "testScenarios",
    "customerCommunicationChecklist",
    "rollbackPlan",
    "estimatedRiskScore",
    "riskExplanation",
    "confidenceScore",
  ]);
  for (const k of Object.keys(o ?? {})) {
    if (!allowed.has(k)) errs.push(`Unexpected field: ${k}`);
  }

  return errs.length ? { ok: false, errors: errs } : { ok: true };
}
