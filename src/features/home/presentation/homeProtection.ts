import type { HomeProtectionCard } from "./types";

export function buildProtectionCards(input: {
  connectedSystems: number;
  totalSystems: number;
  staleSystems: number;
  reviewCoverageEnabled: number;
}) : HomeProtectionCard[] {
  return [
    {
      label: "Connected systems",
      value: `${input.connectedSystems}/${input.totalSystems || input.connectedSystems}`,
      tone: input.connectedSystems > 0 ? "healthy" : "warning",
    },
    {
      label: "Sync health",
      value: input.staleSystems > 0 ? `${input.staleSystems} need attention` : "Healthy",
      tone: input.staleSystems > 0 ? "warning" : "healthy",
    },
    {
      label: "Review coverage",
      value: input.reviewCoverageEnabled > 0 ? "Enabled" : "Needs setup",
      tone: input.reviewCoverageEnabled > 0 ? "healthy" : "warning",
    },
  ];
}
