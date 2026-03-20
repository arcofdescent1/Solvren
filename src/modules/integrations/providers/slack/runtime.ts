import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";

export function getSlackRuntime(): ConnectorRuntime {
  return createStubRuntime("slack");
}
