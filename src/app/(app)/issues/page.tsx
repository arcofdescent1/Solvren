/**
 * Phase 0 — Issues index with filters, status tabs, and table.
 */
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listIssues } from "@/modules/issues";
import type { IssueSourceType } from "@/modules/issues";
import { Card, CardBody, PageHeaderV2, SectionHeader } from "@/ui";
import {
  IssuesFilters,
  IssuesSavedViews,
  IssueStatusTabs,
  IssuesTable,
  getStatusTabFromParam,
  getStatusesForTab,
} from "@/components/issues";
import { PAGE_COPY } from "@/config/pageCopy";
import { PageHelpDrawer } from "@/components/help";

export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) redirect("/onboarding");

  const params = await searchParams;
  const statusParam = typeof params.status === "string" ? params.status : null;
  const activeTab = getStatusTabFromParam(statusParam);
  const statusesForTab = getStatusesForTab(activeTab);
  const sourceType = typeof params.source_type === "string" ? params.source_type : undefined;
  const severity = typeof params.severity === "string" ? params.severity : undefined;
  const domainKey = typeof params.domain_key === "string" ? params.domain_key : undefined;
  const verificationStatus = typeof params.verification_status === "string" ? params.verification_status : undefined;
  const assignee = typeof params.assignee === "string" ? params.assignee : undefined;
  const ownerUserId = assignee === "me" ? userRes.user.id : undefined;

  const result = await listIssues(supabase, {
    org_id: membership.org_id,
    source_type: sourceType as IssueSourceType | undefined,
    severity: severity as "low" | "medium" | "high" | "critical" | undefined,
    domain_key: domainKey,
    verification_status: verificationStatus as "pending" | "passed" | "failed" | "not_required" | undefined,
    owner_user_id: ownerUserId,
    limit: 500,
  });

  const allIssues = result.issues ?? [];
  const statusSet = new Set(statusesForTab);
  const issues = statusSet.size > 0 ? allIssues.filter((i) => statusSet.has(i.status)) : allIssues;

  const tabCounts = {
    open: allIssues.filter((i) => ["open", "triaged", "assigned", "in_progress"].includes(i.status)).length,
    assigned: allIssues.filter((i) => ["assigned", "in_progress"].includes(i.status)).length,
    pending_verification: allIssues.filter((i) => i.status === "resolved").length,
    verified: allIssues.filter((i) => i.status === "verified").length,
    dismissed: allIssues.filter((i) => i.status === "dismissed").length,
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeaderV2
        title={PAGE_COPY.issues.title}
        description={PAGE_COPY.issues.description}
        helper={PAGE_COPY.issues.helper}
        helpTrigger={<PageHelpDrawer page="issues" />}
      />
      <SectionHeader title="Issue queue" helper="Filter and triage detected problems by status, ownership, and severity." />
      <Card>
        <CardBody className="flex flex-col gap-4">
          <IssuesSavedViews />
          <IssuesFilters />
          <IssueStatusTabs activeTab={activeTab} counts={tabCounts} />
          <IssuesTable issues={issues} />
        </CardBody>
      </Card>
    </div>
  );
}
