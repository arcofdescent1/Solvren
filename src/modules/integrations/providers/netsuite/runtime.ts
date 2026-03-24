import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";
import { getNetSuiteHealth, testNetSuiteConnection } from "./health";

export function getNetSuiteRuntime(): ConnectorRuntime {
  const stub = createStubRuntime("netsuite");
  return {
    ...stub,
    async testConnection(input) {
      return testNetSuiteConnection(input.orgId);
    },
    async getHealth(input) {
      return getNetSuiteHealth(input.orgId);
    },
  };
}
