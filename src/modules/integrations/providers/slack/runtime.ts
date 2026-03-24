import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";
import { getSlackHealth, testSlackConnection } from "./health";
import { executeSlackPostMessage } from "./actions/postMessage";
import { executeSlackPostIssueSummary } from "./actions/postIssueSummary";
import { createAdminClient } from "@/lib/supabase/admin";

export function getSlackRuntime(): ConnectorRuntime {
  const stub = createStubRuntime("slack");
  const admin = createAdminClient();
  return {
    ...stub,
    async testConnection(input) {
      return testSlackConnection(input.orgId);
    },
    async getHealth(input) {
      return getSlackHealth(input.orgId);
    },
    async executeAction(input) {
      const actionKey = input.actionKey;
      if (actionKey === "post_message") {
        return executeSlackPostMessage(admin, {
          orgId: input.orgId,
          params: input.params,
        });
      }
      if (actionKey === "post_issue_summary") {
        return executeSlackPostIssueSummary(admin, {
          orgId: input.orgId,
          issueId: input.issueId ?? null,
          params: input.params,
        });
      }
      return { success: false, errorCode: "not_implemented", errorMessage: `Unknown action: ${actionKey}` };
    },
  };
}
