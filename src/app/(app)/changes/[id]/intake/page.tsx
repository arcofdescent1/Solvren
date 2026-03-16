import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ChangeIntakeStepperClient } from "@/components/intake/ChangeIntakeStepperClient";
import type { IntakeDraft, IntakeStepId } from "@/components/intake/types";

export default async function ChangeIntakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { id } = await params;
  const { step: stepParam } = await searchParams;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: change, error } = await supabase
    .from("change_events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !change)
    redirect("/changes/new");

  const status = (change.status ?? "DRAFT") as string;
  if (status !== "DRAFT" && status !== "READY") {
    redirect(`/changes/${id}`);
  }

  const { data: member } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("org_id", change.org_id)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  if (!member) redirect("/dashboard");

  const validSteps: IntakeStepId[] = [
    "change-type",
    "systems",
    "describe",
    "revenue",
    "customer",
    "rollout",
    "evidence",
    "approvals",
    "review",
  ];
  const step: IntakeStepId = validSteps.includes(stepParam as IntakeStepId)
    ? (stepParam as IntakeStepId)
    : "change-type";

  const draft: IntakeDraft = {
    id: change.id,
    title: (change.title as string) || "Untitled change",
    org_id: change.org_id as string,
    status: change.status as string,
    domain: (change.domain as string) ?? "REVENUE",
    change_type: (change.change_type as string) ?? null,
    structured_change_type: (change.structured_change_type as string) ?? null,
    systems_involved: (change.systems_involved as string[]) ?? [],
    revenue_impact_areas: (change.revenue_impact_areas as string[]) ?? [],
    rollout_method: (change.rollout_method as string) ?? null,
    planned_release_at: (change.planned_release_at as string) ?? null,
    requested_release_at: (change.requested_release_at as string) ?? null,
    rollback_time_estimate_hours:
      (change.rollback_time_estimate_hours as number) ?? null,
    backfill_required: Boolean(change.backfill_required),
    customer_impact_expected: Boolean(change.customer_impact_expected),
    affected_customer_segments:
      (change.affected_customer_segments as string[]) ?? [],
    revenue_surface: (change.revenue_surface as string) ?? null,
    estimated_mrr_affected: (change.estimated_mrr_affected as number) ?? null,
    percent_customer_base_affected:
      (change.percent_customer_base_affected as number) ?? null,
    description:
      ((change.intake as Record<string, unknown>)?.description as string) ??
      null,
  };

  return (
    <ChangeIntakeStepperClient
      initialDraft={draft}
      step={step}
    />
  );
}
