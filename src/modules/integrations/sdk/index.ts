/**
 * Phase 4 — Solvren Integrations SDK.
 * For connector authors: manifest, runtime, validation, helpers.
 */
export { ConnectorManifestSchema, type ConnectorManifestInput } from "./connectorManifestSchema";
export { validateManifest, validateRuntimeContract, type ValidationResult } from "./connectorValidation";
export { validateAndLoadConnector, type LoadedConnector } from "./partnerConnectorLoader";
