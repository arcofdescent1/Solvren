import Link from "next/link";
import { notFound } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeaderV2, Card, CardBody, Stack } from "@/ui";

function formatMoneyCents(n: number, currency: string) {
  const cur = currency?.toLowerCase() === "usd" ? "USD" : currency?.toUpperCase() ?? "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: cur, maximumFractionDigits: 0 }).format(
    n / 100
  );
}

export default async function ValueEngineIssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) notFound();

  const { activeOrgId } = await getActiveOrg(supabase, userId);
  if (!activeOrgId) notFound();

  const { data: row } = await supabase
    .from("issues")
    .select(
      "id, title, description, revenue_impact_cents, currency, affected_count, detection_metadata, detection_confidence, recommended_action, status, approval_state, opened_at, detection_source, detection_type, verification_status, baseline_value, post_fix_value, actual_roi_cents, roi_confidence, resolved_at, verified_at, regression_detected, regression_count"
    )
    .eq("id", id)
    .eq("org_id", activeOrgId)
    .eq("source_type", "detector")
    .maybeSingle();

  if (!row) notFound();

  const meta = (row as { detection_metadata?: { sampleRecords?: { id: string; label: string }[] } })
    .detection_metadata ?? {};
  const samples = Array.isArray(meta.sampleRecords) ? meta.sampleRecords : [];

  return (
    <div className="space-y-6">
      <PageHeaderV2
        breadcrumbs={[
          { label: "Insights", href: "/insights" },
          { label: "Executive", href: "/executive" },
          { label: "Issue detail" },
        ]}
        title={(row as { title?: string }).title ?? "Issue"}
        description={(row as { description?: string }).description ?? ""}
        actions={
          <Link href="/executive" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Executive summary
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Revenue impact</p>
            <p className="mt-2 text-2xl font-bold">
              {formatMoneyCents(
                (row as { revenue_impact_cents?: number }).revenue_impact_cents ?? 0,
                (row as { currency?: string }).currency ?? "usd"
              )}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {(row as { affected_count?: number }).affected_count ?? 0} affected record(s) · Confidence{" "}
              {(row as { detection_confidence?: string }).detection_confidence ?? "—"}
            </p>
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              Status: <span className="text-[var(--text)]">{(row as { status?: string }).status}</span> · Approval:{" "}
              <span className="text-[var(--text)]">{(row as { approval_state?: string }).approval_state}</span>
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Recommended action</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text)]">
              {(row as { recommended_action?: string }).recommended_action ?? "—"}
            </p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Affected records (sample)</p>
          {samples.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">No samples attached.</p>
          ) : (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
              {samples.map((s) => (
                <li key={s.id}>
                  <span className="font-mono text-xs text-[var(--text-muted)]">{s.id}</span> — {s.label}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Verification &amp; impact
          </p>
          <Stack gap={2} className="mt-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Verification</span>
              <span className="capitalize">
                {(row as { verification_status?: string }).verification_status ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Baseline metric</span>
              <span>{(row as { baseline_value?: number | null }).baseline_value ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">After fix</span>
              <span>{(row as { post_fix_value?: number | null }).post_fix_value ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Estimated impact</span>
              <span>
                {formatMoneyCents(
                  (row as { revenue_impact_cents?: number }).revenue_impact_cents ?? 0,
                  (row as { currency?: string }).currency ?? "usd"
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Actual ROI</span>
              <span>
                {(row as { actual_roi_cents?: number | null }).actual_roi_cents != null
                  ? formatMoneyCents(
                      (row as { actual_roi_cents?: number }).actual_roi_cents ?? 0,
                      (row as { currency?: string }).currency ?? "usd"
                    )
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">ROI confidence</span>
              <span className="capitalize">
                {(row as { roi_confidence?: string }).roi_confidence ?? "—"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Regression</span>
              <span>
                {(row as { regression_detected?: boolean }).regression_detected ? "Yes" : "No"} · count{" "}
                {(row as { regression_count?: number }).regression_count ?? 0}
              </span>
            </div>
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--text-muted)]">Breakdown</p>
          <Stack gap={2} className="mt-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Source</span>
              <span className="capitalize">{(row as { detection_source?: string }).detection_source ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-[var(--text-muted)]">Detection type</span>
              <span className="font-mono text-xs">{(row as { detection_type?: string }).detection_type ?? "—"}</span>
            </div>
          </Stack>
        </CardBody>
      </Card>
    </div>
  );
}
