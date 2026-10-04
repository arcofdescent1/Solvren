import "server-only";
import { calculateQuoteScenario, QuoteScenario, WorkflowSample } from "@/lib/quote-finance";
import { serverSupabase } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof serverSupabase>>;

export async function quoteEvidence(db: Db, orgId: string, scenarios: QuoteScenario[]) {
  const end = new Date(); end.setUTCHours(0, 0, 0, 0);
  const start = new Date(end); start.setUTCDate(start.getUTCDate() - 60);
  const from = start.toISOString().slice(0, 10);
  const to = end.toISOString().slice(0, 10);
  const { data, error } = await db.rpc("phase3_workflow_samples", {
    p_org: orgId, p_start: from, p_end: to,
  });
  if (error) throw new Error("Workflow evidence is unavailable");
  const samples = (data ?? []) as WorkflowSample[];
  const selected = new Set(scenarios.flatMap((scenario) => scenario.mix.map((line) => line.workflowId)));
  const results = scenarios.map((scenario) => calculateQuoteScenario(scenario, samples));
  return { samplePeriod: { from, to },
    samples: samples.filter((sample) => selected.has(sample.workflow_id)), results };
}
