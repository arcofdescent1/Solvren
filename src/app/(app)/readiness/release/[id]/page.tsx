import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { canRole } from "@/lib/rbac/permissions";
import { parseOrgRole } from "@/lib/rbac/roles";
import { Card, CardBody, PageHeaderV2, Stack } from "@/ui";

export default async function ReadinessReleasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: releaseId } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes?.user) redirect("/login");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("org_id, role")
    .eq("user_id", userRes.user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!membership?.org_id) redirect("/onboarding");
  const orgRole = parseOrgRole((membership as { role?: string | null }).role ?? null);
  if (!canRole(orgRole, "change.approve")) redirect("/home");

  const { data: rel } = await supabase
    .from("releases")
    .select("id, org_id, name, status, target_release_at")
    .eq("id", releaseId)
    .maybeSingle();
  if (!rel) notFound();

  const { data: score } = await supabase
    .from("readiness_scores")
    .select("readiness_score, readiness_level")
    .eq("org_id", (rel as { org_id: string }).org_id)
    .eq("scope_type", "RELEASE")
    .eq("scope_id", releaseId)
    .maybeSingle();

  const { data: rcs } = await supabase
    .from("release_changes")
    .select("change_event_id")
    .eq("release_id", releaseId);
  const changeIds = (rcs ?? []).map((r) => (r as { change_event_id: string }).change_event_id);

  const { data: childScores } =
    changeIds.length > 0
      ? await supabase
          .from("readiness_scores")
          .select("scope_id, readiness_score, readiness_level")
          .eq("org_id", (rel as { org_id: string }).org_id)
          .eq("scope_type", "CHANGE")
          .in("scope_id", changeIds)
      : { data: [] as { scope_id: string; readiness_score: number; readiness_level: string }[] };

  const r = rel as { id: string; name: string; status: string; target_release_at: string | null };

  return (
    <Stack gap={6} className="pb-10">
      <PageHeaderV2
        title={r.name || "Release"}
        description={
          r.target_release_at
            ? `Target: ${new Date(r.target_release_at).toLocaleString()} · ${r.status}`
            : r.status
        }
        actions={
          <Link href="/readiness" className="text-sm font-medium text-[var(--primary)] hover:underline">
            ← Portfolio readiness
          </Link>
        }
      />
      <Card>
        <CardBody>
          <p className="text-xs text-[var(--text-muted)]">Release readiness</p>
          <p className="text-2xl font-semibold tabular-nums">
            {score && typeof (score as { readiness_score?: number }).readiness_score === "number"
              ? (score as { readiness_score: number }).readiness_score
              : "—"}
          </p>
          <p className="text-sm">{(score as { readiness_level?: string } | null)?.readiness_level ?? "—"}</p>
        </CardBody>
      </Card>
      <Stack gap={2}>
        <p className="text-sm font-medium text-[var(--text-muted)]">Changes in release</p>
        {(childScores ?? []).length === 0 ? (
          <p className="text-sm text-[var(--text-muted)]">No linked changes.</p>
        ) : (
          (childScores ?? []).map((c) => (
            <Card key={c.scope_id}>
              <CardBody className="flex flex-row justify-between gap-3">
                <Link
                  href={`/changes/${c.scope_id}`}
                  className="text-sm font-medium text-[var(--primary)] hover:underline"
                >
                  Change {c.scope_id.slice(0, 8)}…
                </Link>
                <span className="text-sm tabular-nums">
                  {c.readiness_score} · {c.readiness_level}
                </span>
              </CardBody>
            </Card>
          ))
        )}
      </Stack>
    </Stack>
  );
}
