/**
 * Phase 8 — Demo System.
 * Demo scenario registry entry.
 */
export type DemoScenario = {
  id: string;
  scenarioKey: string;
  displayName: string;
  description: string;
  status: string;
  seedVersion: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type DemoScene = {
  sceneKey: string;
  displayName: string;
  route: string;
  narrativeGoal: string;
  expectedVisibleData: string[];
};
