/**
 * Phase 2 — Canonical entity detail page (§15.2).
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { getCanonicalEntityById } from "@/modules/identity/repositories/canonicalEntityRepository";
import { getLinksByCanonicalEntityId } from "@/modules/identity/repositories/entityLinkRepository";
import { getRelationshipsByEntityId } from "@/modules/identity/repositories/relationshipRepository";
import { getResolutionEventsByEntity } from "@/modules/identity/repositories/resolutionEventRepository";
import { getMatchCandidateById } from "@/modules/identity/repositories/matchCandidateRepository";
import { PageHeader, Card, CardBody } from "@/ui";
import { EntityProfileCard } from "@/components/identity/EntityProfileCard";
import { EntityLinksTable } from "@/components/identity/EntityLinksTable";
import { MatchCandidateReviewPanel } from "@/components/identity/MatchCandidateReviewPanel";

export default async function IdentityEntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ entityId: string }>;
  searchParams: Promise<{ review?: string }>;
}) {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { activeOrgId } = await getActiveOrg(supabase, userRes.user.id);
  if (!activeOrgId) redirect("/dashboard");

  const { entityId } = await params;
  const { review: reviewCandidateId } = await searchParams;
  const { data: entity, error } = await getCanonicalEntityById(supabase, entityId);
  if (error || !entity) notFound();
  if (entity.org_id !== activeOrgId) redirect("/dashboard");

  const [linksRes, relationshipsRes, eventsRes, reviewCandidate] = await Promise.all([
    getLinksByCanonicalEntityId(supabase, entityId, true),
    getRelationshipsByEntityId(supabase, entityId, true),
    getResolutionEventsByEntity(supabase, entityId, 20),
    reviewCandidateId ? getMatchCandidateById(supabase, reviewCandidateId) : Promise.resolve({ data: null, error: null }),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Identity", href: "/admin/identity" },
          { label: entity.display_name ?? entityId.slice(0, 8) },
        ]}
        title={entity.display_name ?? `${entity.entity_type} entity`}
        description={`Canonical ${entity.entity_type} — linked records and relationships`}
        right={
          <Link href="/admin/identity" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Identity
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

      <EntityProfileCard
        entityType={entity.entity_type}
        displayName={entity.display_name}
        preferredAttributes={entity.preferred_attributes_json as Record<string, unknown>}
        status={entity.status}
        createdAt={entity.created_at}
      />

      <Card>
        <CardBody>
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Linked source records</h3>
          <EntityLinksTable
            links={linksRes.data.map((l) => ({
              id: l.id,
              provider: l.provider,
              external_object_type: l.external_object_type,
              external_id: l.external_id,
              link_status: l.link_status,
              confidence_score: l.confidence_score,
              match_strategy: l.match_strategy,
              created_at: l.created_at,
            }))}
            orgId={activeOrgId}
            entityId={entityId}
          />
        </CardBody>
      </Card>

      {relationshipsRes.data.length > 0 && (
        <Card>
          <CardBody>
            <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Relationships</h3>
            <ul className="space-y-1 text-sm">
              {relationshipsRes.data.map((r) => (
                <li key={r.id}>
                  <span className="text-[var(--text-muted)]">{r.relationship_type}</span>{" "}
                  <Link href={`/identity/${r.to_entity_id === entityId ? r.from_entity_id : r.to_entity_id}`} className="text-[var(--primary)] hover:underline">
                    {r.to_entity_id === entityId ? "from" : "to"} entity
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <h3 className="mb-3 text-sm font-semibold text-[var(--text)]">Recent resolution events</h3>
          {eventsRes.data.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No resolution events yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-[var(--text-muted)]">
              {eventsRes.data.slice(0, 10).map((e) => (
                <li key={e.id}>
                  {e.event_type} — {new Date(e.created_at).toLocaleString()}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
