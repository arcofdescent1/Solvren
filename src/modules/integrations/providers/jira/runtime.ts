import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";

export function getJiraRuntime(): ConnectorRuntime {
  return createStubRuntime("jira");
}
