import { createPrivilegedClient } from "@/lib/server/adminClient";

/**
 * Service role client — bypasses RLS.
 * @deprecated Prefer {@link createPrivilegedClient} from `@/lib/server/adminClient` with an explicit reason string.
 */
export function createAdminClient() {
  return createPrivilegedClient("legacy:createAdminClient()");
}
