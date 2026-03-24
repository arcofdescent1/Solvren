/**
 * Phase 4 — Partner connector loader.
 * Loads approved connector modules from the registry (no remote code execution).
 */
import type { ConnectorManifest } from "../contracts";
import type { ConnectorRuntime } from "../contracts/runtime";
import { validateManifest, validateRuntimeContract } from "./connectorValidation";

export type LoadedConnector = {
  provider: string;
  manifest: ConnectorManifest;
  runtime: ConnectorRuntime;
};

/**
 * Validate and load a partner connector. In v1, partner connectors are
 * packaged and installed into the codebase—this validates they conform.
 */
export function validateAndLoadConnector(
  manifest: unknown,
  runtime: unknown
): { ok: true; connector: LoadedConnector } | { ok: false; errors: string[] } {
  const manifestResult = validateManifest(manifest);
  if (!manifestResult.valid) {
    return { ok: false, errors: manifestResult.errors };
  }

  const runtimeResult = validateRuntimeContract(runtime);
  if (!runtimeResult.valid) {
    return { ok: false, errors: runtimeResult.errors };
  }

  return {
    ok: true,
    connector: {
      provider: (manifest as { provider: string }).provider,
      manifest: manifest as ConnectorManifest,
      runtime: runtime as ConnectorRuntime,
    },
  };
}
