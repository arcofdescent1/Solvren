import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";

export function getGitHubRuntime(): ConnectorRuntime {
  return createStubRuntime("github");
}
