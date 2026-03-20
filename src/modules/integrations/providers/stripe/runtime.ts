import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";

export function getStripeRuntime(): ConnectorRuntime {
  return createStubRuntime("stripe");
}
