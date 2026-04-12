export const PHASE4_STEPS = [
  "expand_org_footprint",
  "increase_depth",
  "executive_qbrs",
  "become_system_of_record",
  "prepare_for_renewal",
] as const;

export type Phase4StepKey = (typeof PHASE4_STEPS)[number];

export const PHASE4_TERMINAL = new Set(["COMPLETED", "SKIPPED"]);
