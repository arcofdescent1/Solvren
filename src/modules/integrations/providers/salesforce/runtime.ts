import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";

export function getSalesforceRuntime(): ConnectorRuntime {
  return createStubRuntime("salesforce");
}
