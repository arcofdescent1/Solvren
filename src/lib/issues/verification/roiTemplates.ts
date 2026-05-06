/**
 * Phase 4 — template-based ROI copy (code only, no DB).
 */
export const ROI_TEMPLATES = {
  recovered_revenue:
    "You recovered approximately {{amount}} by resolving {{title}}. {{detail}}",
  prevented_loss:
    "You prevented approximately {{amount}} in losses by addressing {{title}}. {{detail}}",
  efficiency_gain: "Operational efficiency gain of approximately {{amount}} from {{title}}. {{detail}}",
} as const;

export function fillRoiTemplate(
  key: keyof typeof ROI_TEMPLATES,
  vars: { amount: string; title: string; detail: string }
): string {
  return ROI_TEMPLATES[key]
    .replaceAll("{{amount}}", vars.amount)
    .replaceAll("{{title}}", vars.title)
    .replaceAll("{{detail}}", vars.detail);
}
