/**
 * Policy Check API — for integrations to call before applying a change.
 * Evaluates a proposed change against org policies and returns allow / require_approval / block.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CheckBody = {
  org_id: string;
  system: string;
  object_type?: string;
  field?: string;
  new_value?: unknown;
  old_value?: unknown;
};

type PolicyRow = {
  id: string;
  rule_type: string;
  rule_config: unknown;
  systems_affected: string[];
  enforcement_mode: string;
};

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: CheckBody;
  try {
    body = (await req.json()) as CheckBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const orgId = body.org_id;
  if (!orgId) return NextResponse.json({ error: "org_id required" }, { status: 400 });

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();
  if (!member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: policies } = await supabase
    .from("revenue_policies")
    .select("id, rule_type, rule_config, systems_affected, enforcement_mode")
    .eq("org_id", orgId)
    .eq("enabled", true)
    .order("priority", { ascending: false });

  const policiesList = (policies ?? []) as PolicyRow[];
  const sys = (body.system ?? "").toLowerCase();
  const applicable = policiesList.filter((p) => {
    const systems = (p.systems_affected ?? []) as string[];
    if (systems.length === 0) return true;
    return systems.some((s) => s.toLowerCase() === sys || s === "*");
  });

  let result: "allow" | "require_approval" | "block" = "allow";
  let matchedPolicy: PolicyRow | null = null;
  let reason = "";

  for (const p of applicable) {
    const cfg = (p.rule_config ?? {}) as Record<string, unknown>;
    const ruleType = (p.rule_type ?? "").toUpperCase();
    let triggers = false;

    if (ruleType === "DISCOUNT_LIMIT") {
      const field = (cfg.field as string) ?? "discount";
      const threshold = Number(cfg.threshold ?? 30);
      if ((body.field ?? "").toLowerCase().includes(String(field).toLowerCase())) {
        const val = Number(body.new_value ?? body.old_value ?? 0);
        if (val > threshold) {
          triggers = true;
          reason = `Discount ${val}% exceeds ${threshold}% threshold`;
        }
      }
    } else if (ruleType === "CONTRACT_THRESHOLD") {
      const threshold = Number(cfg.threshold ?? 1_000_000);
      const val = Number(body.new_value ?? body.old_value ?? 0);
      if (val >= threshold) {
        triggers = true;
        reason = `Contract value $${val.toLocaleString()} exceeds $${threshold.toLocaleString()} threshold`;
      }
    } else if (ruleType === "PRICING_CHANGE" || ruleType === "BILLING_RULE") {
      const obj = (body.object_type ?? "").toLowerCase();
      if (
        obj.includes("price") || obj.includes("pricing") || obj.includes("billing") ||
        obj.includes("opportunity") || obj.includes("quote")
      ) {
        triggers = true;
        reason = `${ruleType.replace("_", " ")} policy applies`;
      }
    }

    if (triggers) {
      const mode = (p.enforcement_mode ?? "MONITOR") as string;
      matchedPolicy = p;
      if (mode === "BLOCK") {
        result = "block";
        break;
      }
      if (mode === "REQUIRE_APPROVAL" && result === "allow") result = "require_approval";
    }
  }

  return NextResponse.json({
    ok: true,
    result,
    allowed: result === "allow",
    requires_approval: result === "require_approval",
    blocked: result === "block",
    matched_policy_id: matchedPolicy?.id ?? null,
    reason: result !== "allow" ? reason : null,
  });
}
