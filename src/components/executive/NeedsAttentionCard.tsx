/* eslint-disable react-hooks/purity -- Async RSC: wall time for SLA window queries is per request. */
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { Card, CardBody, CardHeader, CardTitle, Badge } from "@/ui";

type Row = {
  id: string;
  title: string;
  status: string;
  approval_state: string | null;
  severity: string | null;
  sla_due_at: string | null;
};

export default async function NeedsAttentionCard() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  const userId = userRes.user?.id;
  if (!userId) return null;

  const { activeOrgId } = await getActiveOrg(supabase, userId);
  if (!activeOrgId) return null;

  const soon = new Date(Date.now() + 86400000).toISOString();
  const now = new Date().toISOString();

  const [{ data: pending }, { data: slaSoon }] = await Promise.all([
    supabase
      .from("issues")
      .select("id, title, status, approval_state, severity, sla_due_at")
      .eq("org_id", activeOrgId)
      .eq("source_type", "detector")
      .eq("approval_state", "pending")
      .neq("status", "dismissed")
      .order("opened_at", { ascending: false })
      .limit(8),
    supabase
      .from("issues")
      .select("id, title, status, approval_state, severity, sla_due_at")
      .eq("org_id", activeOrgId)
      .eq("source_type", "detector")
      .not("sla_due_at", "is", null)
      .lte("sla_due_at", soon)
      .gte("sla_due_at", now)
      .neq("status", "dismissed")
      .order("sla_due_at", { ascending: true })
      .limit(8),
  ]);

  const byId = new Map<string, Row>();
  for (const r of [...(pending ?? []), ...(slaSoon ?? [])]) {
    byId.set((r as Row).id, r as Row);
  }
  const list = Array.from(byId.values()).slice(0, 10);

  if (list.length === 0) return null;

  return (
    <Card className="border-amber-200/80 dark:border-amber-900/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            Needs attention
            <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
              {list.length}
            </Badge>
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Pending approvals or SLA due within 24 hours.
          </p>
        </div>
        <Link href="/action-queue" className="text-sm font-semibold text-[var(--primary)] hover:underline shrink-0">
          Action queue →
        </Link>
      </CardHeader>
      <CardBody className="space-y-3">
        <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <Link
                href={`/executive/value-issues/${r.id}`}
                className="font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline"
              >
                {r.title || "Untitled issue"}
              </Link>
              <div className="flex flex-wrap gap-1">
                {r.approval_state === "pending" ? (
                  <Badge variant="outline">Approval</Badge>
                ) : null}
                {r.severity ? (
                  <Badge variant="secondary">{r.severity}</Badge>
                ) : null}
                <Badge variant="outline">{r.status}</Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
