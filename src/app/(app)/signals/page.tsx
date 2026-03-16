import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  PageHeader,
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Stack,
} from "@/ui";

function learningStatus(eligibleSignals: number) {
  if (eligibleSignals <= 0) return "Early";
  if (eligibleSignals < 10) return "Active";
  return "Mature";
}

export default async function SignalsLeaderboardPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { data: baselineRow, error: baseErr } = await supabase
    .from("risk_learning_baseline")
    .select("baseline_incident_rate_smoothed, min_samples, last_computed_at")
    .eq("id", 1)
    .maybeSingle();

  if (baseErr) {
    redirect("/dashboard");
  }

  const baseline = Number(baselineRow?.baseline_incident_rate_smoothed ?? 0);
  const minSamples = Number(baselineRow?.min_samples ?? 20);

  const { count: eligibleSignals } = await supabase
    .from("signal_statistics")
    .select("*", { count: "exact", head: true })
    .gte("total_changes", minSamples);

  const { data: rows } = await supabase
    .from("signal_statistics")
    .select("signal_key, total_changes, incident_rate_smoothed, incident_count, last_computed_at")
    .order("incident_rate_smoothed", { ascending: false })
    .limit(50);

  const fmtPct = (n: number) => `${Math.round(n * 100)}%`;
  const lastComputed = baselineRow?.last_computed_at
    ? new Date(baselineRow.last_computed_at).toLocaleString()
    : "—";

  return (
    <Stack gap={4}>
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Signals" },
        ]}
        title="Top risky signals"
        description={
          <>
            Baseline (smoothed): {fmtPct(baseline)} • min samples: {minSamples}
            {" • "}
            Learning: {learningStatus(eligibleSignals ?? 0)}
            {" • "}
            Eligible signals: {eligibleSignals ?? 0}
            {" • "}
            Last computed: {lastComputed}
          </>
        }
        right={
          <Stack direction="row" gap={3}>
            <Link
              href="/reviews"
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              ← Reviews
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              Dashboard
            </Link>
          </Stack>
        }
      />

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signal</TableHead>
              <TableHead>Incident rate</TableHead>
              <TableHead>Δ vs baseline</TableHead>
              <TableHead>Samples</TableHead>
              <TableHead>Incidents</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(rows ?? []).map((r) => {
              const rate = Number((r as { incident_rate_smoothed?: number }).incident_rate_smoothed ?? 0);
              const delta = rate - baseline;
              const sampleOk = Number(r.total_changes ?? 0) >= minSamples;

              return (
                <TableRow key={r.signal_key}>
                  <TableCell className="font-mono">
                    {r.signal_key}
                    {!sampleOk && (
                      <span className="ml-2 text-xs text-[var(--text-muted)]">(warming up)</span>
                    )}
                  </TableCell>
                  <TableCell>{fmtPct(rate)}</TableCell>
                  <TableCell>
                    {delta >= 0 ? "+" : ""}
                    {fmtPct(delta)}
                  </TableCell>
                  <TableCell>{r.total_changes}</TableCell>
                  <TableCell>{r.incident_count}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </Stack>
  );
}
