/**
 * Phase 4 — Detector detail page (§16).
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getDetectorDefinitionByKey } from "@/modules/detection/persistence/detector-definitions.repository";
import { DetectorDetailClient } from "@/components/detection/DetectorDetailClient";

export default async function DetectorDetailPage({
  params,
}: {
  params: Promise<{ detectorKey: string }>;
}) {
  const { detectorKey } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) notFound();

  const { activeOrgId, memberships } = await getActiveOrg(supabase, userRes.user.id);
  const membership = memberships.find((m) => m.orgId === activeOrgId);
  if (!activeOrgId || !membership) notFound();

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));
  if (!isAdmin) notFound();

  const { data: def } = await getDetectorDefinitionByKey(supabase, detectorKey);
  if (!def) notFound();

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Admin", href: "/admin/domains" },
          { label: "Detectors", href: "/admin/detectors" },
          { label: def.display_name },
        ]}
        title={def.display_name}
        description={def.description}
        right={
          <Link href="/admin/detectors" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Catalog
          </Link>
        }
      />
      <DetectorDetailClient
        orgId={activeOrgId}
        detectorKey={detectorKey}
        detector={def}
      />
    </div>
  );
}
