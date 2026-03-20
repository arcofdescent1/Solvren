/**
 * Phase 2 Gap 2 — POST /api/admin/policies/preview.
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { previewPolicy, type PolicyPreviewDraft } from "@/modules/policy/services/policy-preview.service";

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    policyDraft?: {
      displayName?: string;
      policyKey?: string;
      scope?: string;
      scopeRef?: string | null;
      defaultDisposition?: "ALLOW" | "BLOCK";
      rules?: unknown[];
    };
    evaluationContext?: {
      orgId?: string;
      environment?: string;
      actionKey?: string;
      impactAmount?: number;
      requestedMode?: string;
    };
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ctx = body.evaluationContext ?? {};
  const decision = previewPolicy((body.policyDraft ?? {}) as PolicyPreviewDraft, {
    orgId: ctx.orgId ?? "",
    environment: (ctx.environment as "production" | "staging") ?? "production",
    actionKey: ctx.actionKey,
    impactAmount: ctx.impactAmount ?? null,
    requestedMode: (ctx.requestedMode as "approve_then_execute") ?? "approve_then_execute",
  });

  return NextResponse.json({ decision });
}
