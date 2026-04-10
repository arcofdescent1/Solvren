import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { scopeActiveChangeEvents } from "@/lib/db/changeEventScope";
import { canViewChange } from "@/lib/access/changeAccess";
import { isExecutiveUserForPhase1 } from "@/lib/rbac/isExecutiveUserForPhase1";
import { buildExecutiveChangeView } from "@/lib/executive/buildExecutiveChangeView";
import { PageHeader } from "@/ui";
import { HeroSummaryCard } from "@/components/executive/HeroSummaryCard";
import { ReadinessGrid } from "@/components/executive/ReadinessGrid";
import { ExposureSummary } from "@/components/executive/ExposureSummary";
import { SignoffSummary } from "@/components/executive/SignoffSummary";
import { ApprovalConflictBanner } from "@/components/executive/ApprovalConflictBanner";
import { ExecutiveDecisionPanel } from "@/components/executive/ExecutiveDecisionPanel";
import { TechnicalDetailsDrawer } from "@/components/executive/TechnicalDetailsDrawer";

export default async function ExecutiveChangePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const sp = (await searchParams) ?? {};
  const executiveLite = sp.view === "executive-lite";
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: change, error } = await scopeActiveChangeEvents(
    supabase.from("change_events").select("id, org_id, domain, status, created_by, is_restricted")
  )
    .eq("id", id)
    .maybeSingle();

  if (error || !change) {
    redirect("/changes");
  }

  const canView = await canViewChange(supabase, userRes.user.id, change);
  if (!canView) redirect("/changes");

  const exec = await isExecutiveUserForPhase1(supabase, userRes.user.id, change.org_id as string);
  if (!exec) {
    redirect(`/changes/${id}`);
  }

  const view = await buildExecutiveChangeView(supabase, id);
  if (!view) redirect(`/changes/${id}`);

  const attentionLines =
    executiveLite && view.attentionSummary.length === 0
      ? ["No material concerns identified"]
      : view.attentionSummary;

  return (
    <div className="mx-auto max-w-[960px] space-y-10 px-4 py-8 pb-16">
      <PageHeader
        breadcrumbs={[
          { label: "Home", href: "/home" },
          { label: "Executive", href: "/executive" },
          { label: "Change overview", href: `/executive/changes/${id}` },
        ]}
        title={executiveLite ? "Executive overview (Slack)" : "Executive overview"}
        description={
          executiveLite
            ? "Lightweight leadership view. Open the full change record for operator tools."
            : "A concise read for leadership. Open the full change record anytime from the operator view."
        }
      />

      <div data-testid="executive-hero-summary">
        <HeroSummaryCard view={view} executiveLite={executiveLite} />
      </div>

      <section className="space-y-2">
        <h2 className="text-xl font-bold text-[var(--text)]">Why this needs your attention</h2>
        <ul className="list-inside list-disc space-y-1 text-base leading-relaxed text-[var(--text)]">
          {attentionLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>

      <ApprovalConflictBanner message={view.approvalConflictMessage} />

      {!executiveLite && <ReadinessGrid rows={view.readiness} />}

      {executiveLite && view.readiness.length === 0 && (
        <p className="text-sm text-[var(--text-muted)]">Evidence requirements not configured</p>
      )}

      {!executiveLite && <ExposureSummary view={view} />}

      <SignoffSummary signoffs={view.signoffs} />

      <ExecutiveDecisionPanel changeId={id} view={view} />

      {!executiveLite && <TechnicalDetailsDrawer view={view} />}
    </div>
  );
}
