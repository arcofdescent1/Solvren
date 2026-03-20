/**
 * Phase 8 — Demo System.
 * Seed manifest for scenario data validation.
 */
export type DemoSeedManifest = {
  id: string;
  scenarioKey: string;
  seedVersion: string;
  manifestJson: DemoManifestContent;
  createdAt: string;
};

export type DemoManifestContent = {
  tablesSeeded: string[];
  countsExpected: Record<string, number>;
  scenarioNarrativeObjects?: string[];
  checksums?: Record<string, string>;
};
