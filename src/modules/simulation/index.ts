/**
 * Phase 2 — Deterministic Simulation Engine.
 */
export * from "./domain";
export { createSimulation, executeSimulation, cancelSimulation, compareSimulationRuns } from "./services/simulation-orchestrator.service";
export { buildHistoricalWindowSnapshot, buildIssueSetSnapshot, buildDemoSnapshot } from "./services/simulation-snapshot-builder.service";
export { computeConfidence } from "./services/simulation-confidence.service";
export { aggregateEntityResults } from "./services/simulation-result-aggregator.service";
