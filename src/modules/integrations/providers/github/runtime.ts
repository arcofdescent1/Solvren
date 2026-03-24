import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";
import { getGitHubHealth, testGitHubConnection } from "./health";

export function getGitHubRuntime(): ConnectorRuntime {
  const stub = createStubRuntime("github");
  return {
    ...stub,
    async testConnection(input) {
      return testGitHubConnection(input.orgId);
    },
    async getHealth(input) {
      return getGitHubHealth(input.orgId);
    },
  };
}
