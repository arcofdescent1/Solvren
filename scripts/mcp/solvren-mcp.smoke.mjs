#!/usr/bin/env node
import { spawn } from "node:child_process";

const expectedTools = [
  "get_home_summary",
  "list_decisions_needing_action",
  "get_decision",
  "list_open_problems",
  "get_problem",
  "get_proof_summary",
  "generate_executive_brief",
  "get_setup_health",
  "get_mcp_server_health",
  "get_mcp_data_freshness",
  "get_mcp_policy",
  "explain_mcp_policy",
  "list_mcp_policy_profiles",
  "get_effective_mcp_permissions",
  "simulate_mcp_tool_call",
  "simulate_mcp_action",
  "explain_why_mcp_action_blocked",
  "get_mcp_audit_summary",
  "get_mcp_action_history",
  "generate_mcp_trust_report",
  "explain_decision_readiness",
  "list_missing_proof",
  "list_pending_approvers",
  "recommend_decision_next_step",
  "recommend_problem_actions",
  "summarize_problem_root_cause",
  "list_related_decisions",
  "list_related_incidents",
  "generate_board_brief",
  "generate_decision_brief",
  "generate_problem_brief",
  "generate_setup_gap_summary",
  "draft_approval_comment",
  "draft_request_for_proof",
  "draft_owner_message",
  "draft_exec_update",
  "recommend_next_setup_step",
  "explain_coverage_gap",
  "list_unprotected_revenue_surfaces",
  "prepare_approve_decision",
  "prepare_request_more_proof",
  "prepare_attach_proof_link",
  "prepare_assign_problem_owner",
  "prepare_add_problem_comment",
  "confirm_action",
];

const child = spawn(process.execPath, ["scripts/mcp/solvren-mcp.mjs"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "test-service-role-key",
  },
});

const responses = [];
let stdout = "";
let stderr = "";

child.stdout.on("data", (chunk) => {
  stdout += chunk.toString();
  for (;;) {
    const idx = stdout.indexOf("\n");
    if (idx === -1) break;
    const line = stdout.slice(0, idx).trim();
    stdout = stdout.slice(idx + 1);
    if (line) responses.push(JSON.parse(line));
  }
});

child.stderr.on("data", (chunk) => {
  stderr += chunk.toString();
});

function send(message) {
  child.stdin.write(`${JSON.stringify(message)}\n`);
}

send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
send({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
send({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_mcp_server_health", arguments: {} } });

const timeout = setTimeout(() => {
  child.kill();
  throw new Error(`Timed out waiting for MCP responses. stderr=${stderr}`);
}, 5000);

while (responses.length < 3) {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

clearTimeout(timeout);
child.kill();

const init = responses.find((row) => row.id === 1);
const list = responses.find((row) => row.id === 2);
const health = responses.find((row) => row.id === 3);
if (init?.result?.serverInfo?.name !== "solvren-revenue-protection") {
  throw new Error(`Unexpected initialize response: ${JSON.stringify(init)}`);
}

const toolNames = new Set((list?.result?.tools ?? []).map((tool) => tool.name));
for (const tool of expectedTools) {
  if (!toolNames.has(tool)) throw new Error(`Missing MCP tool: ${tool}`);
}

const healthText = health?.result?.content?.[0]?.text;
const healthPayload = healthText ? JSON.parse(healthText) : null;
if (healthPayload?.schemaVersion !== "solvren.mcp.v1.2") {
  throw new Error(`Unexpected health envelope: ${healthText}`);
}

console.log(`Solvren MCP smoke passed with ${toolNames.size} tools.`);
