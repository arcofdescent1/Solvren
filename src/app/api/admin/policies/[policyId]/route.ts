/**
 * Phase 3 — GET/PUT /api/admin/policies/[policyId].
 * Phase 2 Gap 2 — PUT with validation, versioning.
 */
import { NextRequest, NextResponse } from "next/server";
import { getPolicyById, updatePolicy } from "@/modules/policy/repositories/policies.repository";
import { validatePolicyDraft } from "@/modules/policy/services/policy-validation.service";
import {
  authzErrorResponse,
  resolveResourceInOrg,
} from "@/lib/server/authz";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const { policyId } = await params;
    const ctx = await resolveResourceInOrg({
      table: "policies",
      resourceId: policyId,
      permission: "policy.manage",
    });

    const { data, error } = await getPolicyById(ctx.supabase, policyId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ policyId: string }> }
) {
  try {
    const { policyId } = await params;
    const ctx = await resolveResourceInOrg({
      table: "policies",
      resourceId: policyId,
      permission: "policy.manage",
    });

    const { data: existing } = await getPolicyById(ctx.supabase, policyId);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const platformNonRelaxable =
      String(existing.policy_owner_type ?? "").toUpperCase() === "PLATFORM" &&
      String(existing.relaxation_mode ?? "").toUpperCase() === "NON_RELAXABLE";

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (platformNonRelaxable) {
      const rulesChanged =
        body.rules != null &&
        JSON.stringify(body.rules) !== JSON.stringify(existing.rules_json ?? []);
      if (rulesChanged) {
        return NextResponse.json(
          { error: "Cannot modify rules on a non-relaxable platform policy" },
          { status: 403 }
        );
      }
      if (
        body.defaultDisposition != null &&
        String(body.defaultDisposition) !== String(existing.default_disposition)
      ) {
        return NextResponse.json(
          { error: "Cannot change default disposition on a non-relaxable platform policy" },
          { status: 403 }
        );
      }
      if (
        body.priorityOrder != null &&
        Number(body.priorityOrder) !== Number(existing.priority_order)
      ) {
        return NextResponse.json(
          { error: "Cannot change priority on a non-relaxable platform policy" },
          { status: 403 }
        );
      }
      if (body.scope != null && String(body.scope) !== String(existing.scope)) {
        return NextResponse.json(
          { error: "Cannot change scope on a non-relaxable platform policy" },
          { status: 403 }
        );
      }
      if (body.scopeRef !== undefined) {
        const nextRef = body.scopeRef as string | null;
        const curRef = existing.scope_ref ?? null;
        if (nextRef !== curRef) {
          return NextResponse.json(
            { error: "Cannot change scope reference on a non-relaxable platform policy" },
            { status: 403 }
          );
        }
      }
      if (body.status != null) {
        const next = String(body.status).toLowerCase();
        const cur = String(existing.status).toLowerCase();
        if (cur === "active" && next !== "active") {
          return NextResponse.json(
            { error: "Cannot archive or deactivate a non-relaxable platform policy via this API" },
            { status: 403 }
          );
        }
      }
    }

    const updates: Parameters<typeof updatePolicy>[2] = {
      updated_by_user_id: ctx.user.id,
    };
    if (body.displayName != null) updates.display_name = body.displayName as string;
    if (body.description != null) updates.description = body.description as string;
    if (body.scope != null) updates.scope = body.scope as string;
    if (body.scopeRef != null) updates.scope_ref = body.scopeRef as string | null;
    if (body.priorityOrder != null) updates.priority_order = body.priorityOrder as number;
    if (body.defaultDisposition != null) updates.default_disposition = body.defaultDisposition as string;
    if (body.rules != null) updates.rules_json = body.rules as unknown[];

    if (body.status != null && body.status === "active") {
      const validation = validatePolicyDraft({
        displayName: (body.displayName ?? existing.display_name) as string,
        scope: (body.scope ?? existing.scope) as string,
        scopeRef: (body.scopeRef ?? existing.scope_ref) as string | null,
        defaultDisposition: (body.defaultDisposition ?? existing.default_disposition) as string,
        rules: (body.rules ?? existing.rules_json) as import("@/modules/policy/domain").PolicyRule[],
      });
      if (!validation.valid) {
        return NextResponse.json({ error: "Validation failed", errors: validation.errors }, { status: 400 });
      }
    }
    if (body.status != null) updates.status = body.status as string;

    const { data, error } = await updatePolicy(ctx.supabase, policyId, updates);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ policy: data });
  } catch (e) {
    return authzErrorResponse(e);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ policyId: string }> }) {
  return PUT(req, ctx);
}
