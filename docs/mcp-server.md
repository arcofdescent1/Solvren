# Solvren MCP Server

Solvren includes an enterprise MCP server for AI assistants that need trusted revenue-protection context, guided decision support, setup guidance, proof summaries, draft-only messaging, carefully controlled write actions, and customer-configurable policy profiles.

The server exposes the core product sentence through tools:

> Solvren shows what revenue is at risk, what needs action, and what value was protected.

## Run

```bash
npm run mcp:server
```

The server communicates over stdio and is intended to be launched by an MCP client.

## Required Environment

The server uses the Supabase service role key because MCP clients do not provide a browser session.

```bash
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SOLVREN_MCP_MODE=readonly
SOLVREN_MCP_ALLOWED_ORG_IDS=optional-comma-separated-org-id-list
SOLVREN_MCP_ALLOWED_TOOLS=optional-comma-separated-tool-list
SOLVREN_MCP_MAX_LIMIT=50
SOLVREN_MCP_CALLER_LABEL=executive-assistant
SOLVREN_MCP_POLICY_PROFILE_KEY=executive-assistant
SOLVREN_MCP_AUDIT_ENABLED=true
SOLVREN_MCP_ALLOWED_MUTATIONS=approve_decision,request_more_proof,attach_proof_link,assign_problem_owner,add_problem_comment,confirm_action
SOLVREN_MCP_REQUIRE_CONFIRMATION=true
SOLVREN_MCP_WRITE_AUDIT_REQUIRED=true
SOLVREN_MCP_ACTION_TTL_MINUTES=10
```

For local development, `.env.local` is loaded automatically when present.

When `SOLVREN_MCP_ALLOWED_ORG_IDS` is set, the server rejects tool calls for any org outside that list.

When `SOLVREN_MCP_ALLOWED_TOOLS` is set, the server only advertises and executes those tools. `SOLVREN_MCP_MAX_LIMIT` caps list-style responses even when a client asks for more.

`SOLVREN_MCP_POLICY_PROFILE_KEY` selects the customer policy profile stored in `mcp_policy_profiles`. If no matching profile exists, the server falls back to environment guardrails. Effective permission is the intersection of:

- environment mode, org allowlist, tool allowlist, mutation allowlist, and max result limit
- customer MCP policy profile
- optional user context role and email domain rules
- Solvren object-level authorization for controlled writes
- explicit confirmation and audit requirements

## Tools

Most tools are read-only and require an explicit `orgId` unless noted. Controlled writes are limited to the Phase 3 prepare/confirm flow and are further constrained by Phase 4 customer policy profiles.

### Phase 1 Tools

- `get_home_summary`: money at risk, items needing action, problems, protected value, and setup health.
- `list_decisions_needing_action`: active revenue-impacting decisions that need review.
- `get_decision`: CEO-readable decision detail with what happened, why it matters, next action, proof, approvals, and warnings.
- `list_open_problems`: open revenue problems ordered by priority.
- `get_problem`: CEO-readable problem detail with impact, owner, actions, and sources.
- `get_proof_summary`: protected value, prevented incidents, time saved, value stories, and board-ready reports.
- `generate_executive_brief`: concise executive brief from current risk, action, setup, and proof context.
- `get_setup_health`: connected systems, setup gaps, onboarding status, and latest scan.
- `get_mcp_server_health`: server mode, audit status, configured guardrails, and enabled tools.
- `get_mcp_data_freshness`: latest update timestamps for decision, problem, proof, setup, and scan data.

### Phase 2 Decision Readiness

- `explain_decision_readiness`: whether a decision can be approved and what blocks it.
- `list_missing_proof`: required proof still missing for a decision.
- `list_pending_approvers`: pending approvers and missing approval lanes.
- `recommend_decision_next_step`: one clear next step for the decision.

### Phase 2 Problem Resolution

- `recommend_problem_actions`: practical actions to resolve a revenue problem.
- `summarize_problem_root_cause`: likely root-cause framing from problem sources and related decisions.
- `list_related_decisions`: decisions linked to a problem.
- `list_related_incidents`: incidents related to a problem.

### Phase 2 Proof Packets

- `generate_board_brief`: board-ready Markdown brief about exposure, action, and protected value.
- `generate_decision_brief`: structured Markdown brief for a decision.
- `generate_problem_brief`: structured Markdown brief for a problem.
- `generate_setup_gap_summary`: Markdown setup gap summary.

### Phase 2 Draft-Only Outputs

These tools generate text only. They do not mutate Solvren data.

- `draft_approval_comment`
- `draft_request_for_proof`
- `draft_owner_message`
- `draft_exec_update`

### Phase 2 Setup Guidance

- `recommend_next_setup_step`
- `explain_coverage_gap`
- `list_unprotected_revenue_surfaces`

### Phase 3 Controlled Writes

Controlled write tools use a two-step prepare/confirm flow. Prepare tools create a short-lived action request and do not execute the mutation. `confirm_action` is the only tool that mutates Solvren data.

Controlled writes require:

- `SOLVREN_MCP_MODE=controlled_write`
- `SOLVREN_MCP_AUDIT_ENABLED=true`
- `SOLVREN_MCP_WRITE_AUDIT_REQUIRED=true`
- the mutation in `SOLVREN_MCP_ALLOWED_MUTATIONS`
- `userContext.userEmail`
- valid org membership and role permissions
- exact confirmation phrase before execution

Prepare tools:

- `prepare_approve_decision`
- `prepare_request_more_proof`
- `prepare_attach_proof_link`
- `prepare_assign_problem_owner`
- `prepare_add_problem_comment`

Execution tool:

- `confirm_action`

The prepare response includes an `actionId`, `willChange`, `cannotProceedReasons`, `confirmationPhrase`, and `expiresAt`. The confirmation call must include the same user email and the exact confirmation phrase.

### Phase 4 Customer Policy Layer

Phase 4 concludes the MCP implementation with customer-visible assistant policy profiles, simulation tools, action audit reporting, and a trust report suitable for enterprise review.

Policy and trust tools:

- `get_mcp_policy`: show the effective policy profile for the configured assistant key.
- `explain_mcp_policy`: explain the profile in plain English.
- `list_mcp_policy_profiles`: list policy profiles configured for the organization.
- `get_effective_mcp_permissions`: show environment guardrails, customer profile, actor context, and effective boundaries.
- `simulate_mcp_tool_call`: test whether a read or draft tool would be allowed.
- `simulate_mcp_action`: test whether a controlled write action would be allowed.
- `explain_why_mcp_action_blocked`: explain blocked controlled actions without preparing an action.
- `get_mcp_audit_summary`: summarize recent MCP action audit events.
- `get_mcp_action_history`: list recent MCP action audit events.
- `generate_mcp_trust_report`: generate a Markdown report for security, CIO, CISO, or enterprise admin review.

The logged-in app also includes a read-only admin surface at `/settings/mcp` for policy profile visibility and recent controlled-action audit.

## Optional User Context

Phase 2 tools that produce guidance or drafts can accept optional user context. Phase 3 controlled writes require it:

```json
{
  "orgId": "...",
  "decisionId": "...",
  "userContext": {
    "userEmail": "olivia@example.com",
    "role": "executive"
  }
}
```

In read-only mode this lets responses prioritize executive, finance, engineering, or risk-manager concerns. In controlled-write mode this identifies the actor for permission checks and audit.

## Response Contract

Each tool returns a stable JSON envelope:

```json
{
  "schemaVersion": "solvren.mcp.v1.2",
  "toolName": "get_home_summary",
  "orgId": "organization-id-or-null",
  "generatedAt": "2026-06-25T00:00:00.000Z",
  "whatThisMeans": "Plain-English summary.",
  "whyItMatters": "Business reason this matters.",
  "recommendedNextAction": "The next sensible action.",
  "sourceRecords": [{ "table": "change_events", "id": "record-id", "label": "Record label" }],
  "links": [{ "label": "Open Solvren", "url": "/" }],
  "data": {}
}
```

Sensitive key names such as tokens, secrets, passwords, credentials, API keys, and refresh values are redacted before output.

## Example MCP Client Config

```json
{
  "mcpServers": {
    "solvren": {
      "command": "npm",
      "args": ["run", "mcp:server"],
      "cwd": "C:\\Users\\dsepp\\revenueguard",
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "SOLVREN_MCP_MODE": "readonly",
        "SOLVREN_MCP_ALLOWED_ORG_IDS": "org-id-1,org-id-2",
        "SOLVREN_MCP_ALLOWED_TOOLS": "get_home_summary,list_decisions_needing_action,get_decision,get_proof_summary,get_setup_health,get_mcp_server_health,get_mcp_data_freshness,explain_decision_readiness,list_missing_proof,list_pending_approvers,recommend_decision_next_step,generate_board_brief,draft_exec_update",
        "SOLVREN_MCP_MAX_LIMIT": "25",
        "SOLVREN_MCP_CALLER_LABEL": "claude-desktop",
        "SOLVREN_MCP_POLICY_PROFILE_KEY": "claude-desktop",
        "SOLVREN_MCP_ALLOWED_MUTATIONS": "approve_decision,request_more_proof,attach_proof_link,assign_problem_owner,add_problem_comment,confirm_action",
        "SOLVREN_MCP_REQUIRE_CONFIRMATION": "true",
        "SOLVREN_MCP_WRITE_AUDIT_REQUIRED": "true"
      }
    }
  }
}
```

## Smoke Test

```bash
npm run mcp:smoke
```

The smoke test verifies the MCP initialize response and tool catalog without calling live database tools.

## Security Notes

- Default mode is `readonly`; controlled writes require `SOLVREN_MCP_MODE=controlled_write`.
- Draft tools produce suggested text only and include `mutatesData: false`.
- Controlled writes are narrow: approval, proof request, proof link attach, problem owner assignment, and problem comments.
- `confirm_action` rejects expired, already-used, unauthorized, mismatched, or incorrectly confirmed action requests.
- Action requests and audit rows are stored in `mcp_action_requests` and `mcp_action_audit_log`.
- Customer MCP policy profiles and policy events are stored in `mcp_policy_profiles` and `mcp_policy_events`.
- MCP cannot modify its own policy, invite users, alter integrations, change licenses, administer organizations, or bypass Solvren authorization.
- The service role key must only be configured on trusted machines or secure server environments.
- Read-only tool calls are audit logged to stderr by default with request ID, caller label, tool name, org ID, status, result count, elapsed time, and timestamp.
- Do not expose this stdio server over HTTP without adding authentication, tenant authorization, rate limits, and audit logs.
- Do not add destructive actions, policy overrides, user invites, integration changes, license changes, or org administration to MCP without a separate security design and customer approval workflow.
