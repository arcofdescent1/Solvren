/**
 * Phase 2 — Identity Review Queue (§15.1). Admin page for match candidates.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { listMatchCandidates } from "@/modules/identity/repositories/matchCandidateRepository";
import { getMatchCandidateById } from "@/modules/identity/repositories/matchCandidateRepository";
import { IdentityReviewQueueClient } from "@/components/identity/IdentityReviewQueueClient";
import { MatchCandidateReviewPanel } from "@/components/identity/MatchCandidateReviewPanel";

export default async function AdminIdentityPage({
  searchParams,
}: {
  searchParams: Promise<{ review?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) redirect("/dashboard");

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <PageHeader title="Identity" breadcrumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Admin" }, { label: "Identity" }]} />
        <Card>
          <CardBody>
            <p className="text-sm text-[var(--text-muted)]">Only org admins can access the Identity Review Queue.</p>
            <Link href="/dashboard" className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] hover:underline">← Dashboard</Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const { review: reviewCandidateId } = await searchParams;
  const [candidatesRes, reviewCandidate] = await Promise.all([
    listMatchCandidates(supabase, { orgId: activeOrgId, reviewStatus: "pending", limit: 50 }),
    reviewCandidateId ? getMatchCandidateById(supabase, reviewCandidateId) : Promise.resolve({ data: null, error: null }),
  ]);
  const pendingCandidates = candidatesRes.data ?? [];

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Identity" },
        ]}
        title="Identity Review Queue"
        description="Review and accept or reject proposed entity matches. Resolve ambiguous links before they affect detection and impact."
        right={
          <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Dashboard
          </Link>
        }
      />
      {reviewCandidate?.data && reviewCandidate.data.review_status === "pending" && (
        <MatchCandidateReviewPanel
          candidateId={reviewCandidate.data.id}
          orgId={activeOrgId}
          proposedCanonicalEntityId={reviewCandidate.data.proposed_canonical_entity_id}
          primaryProvider={reviewCandidate.data.primary_provider}
          primaryObjectType={reviewCandidate.data.primary_object_type}
          primaryExternalId={reviewCandidate.data.primary_external_id}
          confidenceScore={reviewCandidate.data.confidence_score}
        />
      )}
      <Card>
        <CardBody>
          <IdentityReviewQueueClient orgId={activeOrgId} initialCandidates={pendingCandidates} />
        </CardBody>
      </Card>
    </div>
  );
}
