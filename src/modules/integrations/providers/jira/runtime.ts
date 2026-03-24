import type { ConnectorRuntime } from "../../contracts/runtime";
import { createStubRuntime } from "../_shared/stubRuntime";
import { getJiraHealth, testJiraConnection } from "./health";
import { executeJiraCreateIssue } from "./actions/createIssue";
import { createAdminClient } from "@/lib/supabase/admin";

export function getJiraRuntime(): ConnectorRuntime {
  const stub = createStubRuntime("jira");
  const admin = createAdminClient();
  return {
    ...stub,
    async testConnection(input) {
      return testJiraConnection(input.orgId);
    },
    async getHealth(input) {
      return getJiraHealth(input.orgId);
    },
    async executeAction(input) {
      if (input.actionKey === "create_issue") {
        return executeJiraCreateIssue(admin, {
          orgId: input.orgId,
          issueId: input.issueId ?? null,
          params: input.params,
        });
      }
      return { success: false, errorCode: "not_implemented", errorMessage: `Unknown action: ${input.actionKey}` };
    },
  };
}
