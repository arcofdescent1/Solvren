import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";

export function getNetSuiteRuntime(): ConnectorRuntime {
  return createStubRuntime("netsuite");
}
