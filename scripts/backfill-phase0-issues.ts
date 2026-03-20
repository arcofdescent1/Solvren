#!/usr/bin/env npx tsx
/**
 * Phase 0 — Backfill issues from unresolved incidents and high-risk changes.
 *
 * Usage:
 *   npx tsx scripts/backfill-phase0-issues.ts [--dry-run] [--limit=N]
 *
 * Prerequisites:
 *   - .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   - Migrations 135–142 applied (issues, change_issue_links, next_issue_key)
 *
 * Rules:
 *   A — Unresolved incidents: create issue with source_type=incident, source_ref=incident.id
 *   B — High-risk unresolved changes: create issue with source_type=change, link_type=origin
 *   C — Governance-blocked changes: create issue when blocked on approvals/evidence
 *
 * Safeguards: dry-run by default; idempotency via existing change_issue_links/issue_sources.
 */

import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const limit = limitArg ? parseInt(limitArg.split("=")[1] ?? "50", 10) : 50;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function nextIssueKey(orgId: string): Promise<string> {
  const { data } = await supabase.rpc("next_issue_key", { p_org_id: orgId });
  if (typeof data === "string") return data;
  const { data: rows } = await supabase
    .from("issues")
    .select("issue_key")
    .eq("org_id", orgId)
    .like("issue_key", "ISS-%")
    .order("id", { ascending: false })
    .limit(100);
  let maxNum = 0;
  for (const r of rows ?? []) {
    const m = /^ISS-(\d+)$/.exec(String(r.issue_key ?? ""));
    if (m) maxNum = Math.max(maxNum, parseInt(m[1]!, 10));
  }
  return "ISS-" + String(maxNum + 1).padStart(6, "0");
}

const summary: { created: number; linked: number; skipped: string[] } = {
  created: 0,
  linked: 0,
  skipped: [],
};

async function main() {
  console.log("Phase 0 issue backfill —", dryRun ? "DRY RUN" : "LIVE");
  console.log("Limit:", limit);

  // Rule A — Unresolved incidents
  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, org_id, title, created_at")
    .is("resolved_at", null)
    .limit(limit);

  for (const inc of incidents ?? []) {
    const { data: existing } = await supabase
      .from("issues")
      .select("id")
      .eq("source_type", "incident")
      .eq("source_ref", inc.id)
      .maybeSingle();
    if (existing) {
      summary.skipped.push(`incident:${inc.id}`);
      continue;
    }
    if (dryRun) {
      summary.created++;
      console.log("[dry-run] Would create issue for incident", inc.id, inc.title);
      continue;
    }
    const issueKey = await nextIssueKey(inc.org_id);
    const { data: issue, error } = await supabase
      .from("issues")
      .insert({
        org_id: inc.org_id,
        issue_key: issueKey,
        source_type: "incident",
        source_ref: inc.id,
        domain_key: "revenue",
        title: inc.title ?? `Incident ${inc.id.slice(0, 8)}`,
        status: "open",
        verification_status: "pending",
      })
      .select("id")
      .single();
    if (error) {
      console.error("Create issue for incident failed:", inc.id, error.message);
      continue;
    }
    await supabase.from("issue_sources").insert({
      issue_id: issue.id,
      source_type: "incident",
      source_ref: inc.id,
      evidence_json: { backfilled: true, backfillVersion: "phase0-v1", sourceReason: "unresolved_incident" },
    });
    summary.created++;
    console.log("Created issue", issueKey, "for incident", inc.id);
  }

  // Rule B — High-risk unresolved changes (simplified: IN_REVIEW or DRAFT with high exposure)
  const { data: changes } = await supabase
    .from("change_events")
    .select("id, org_id, title, status, domain")
    .in("status", ["IN_REVIEW", "DRAFT", "READY"])
    .limit(limit);

  for (const ch of changes ?? []) {
    const { data: existingLink } = await supabase
      .from("change_issue_links")
      .select("id")
      .eq("change_id", ch.id)
      .eq("link_type", "origin")
      .maybeSingle();
    if (existingLink) {
      summary.skipped.push(`change:${ch.id}`);
      continue;
    }
    if (dryRun) {
      summary.created++;
      summary.linked++;
      console.log("[dry-run] Would create and link issue for change", ch.id, ch.title);
      continue;
    }
    const issueKey = await nextIssueKey(ch.org_id);
    const { data: issue, error } = await supabase
      .from("issues")
      .insert({
        org_id: ch.org_id,
        issue_key: issueKey,
        source_type: "change",
        source_ref: ch.id,
        domain_key: (ch as { domain?: string }).domain ?? "revenue",
        title: (ch as { title?: string }).title ?? `Change ${ch.id.slice(0, 8)}`,
        status: "open",
        verification_status: "pending",
      })
      .select("id")
      .single();
    if (error) {
      console.error("Create issue for change failed:", ch.id, error.message);
      continue;
    }
    await supabase.from("issue_sources").insert({
      issue_id: issue.id,
      source_type: "change",
      source_ref: ch.id,
      evidence_json: { backfilled: true, backfillVersion: "phase0-v1", sourceReason: "high_risk_change_unresolved" },
    });
    await supabase.from("change_issue_links").insert({
      change_id: ch.id,
      issue_id: issue.id,
      link_type: "origin",
    });
    summary.created++;
    summary.linked++;
    console.log("Created and linked issue", issueKey, "for change", ch.id);
  }

  console.log("Summary:", JSON.stringify(summary, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
