import { getOpenAI } from "@/lib/openai";

export type ExecSummaryOutput = {
  headline: string;
  bullets: string[];
  actions: string[];
  cited_change_ids: string[];
};

type ExecSummaryPayload = {
  window_days: number;
  metrics: Record<string, unknown>;
  top_drivers: Array<Record<string, unknown>>;
};

const ExecSummarySchema = {
  name: "exec_summary",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["headline", "bullets", "actions", "cited_change_ids"],
    properties: {
      headline: { type: "string", minLength: 1, maxLength: 200 },
      bullets: {
        type: "array",
        minItems: 0,
        maxItems: 8,
        items: { type: "string", minLength: 1, maxLength: 300 },
      },
      actions: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: { type: "string", minLength: 1, maxLength: 200 },
      },
      cited_change_ids: {
        type: "array",
        items: { type: "string", minLength: 1, maxLength: 64 },
      },
    },
  },
};

export async function runExecutiveSummaryLLM(payload: ExecSummaryPayload): Promise<ExecSummaryOutput> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error("AI integration disabled: OPENAI_API_KEY not configured");
  }

  const system = "You write an executive weekly revenue-risk brief. ONLY use the numbers and change rows provided. Do NOT invent any metrics, surfaces, or change IDs.";
  const userContent = "Summarize this revenue-at-risk data. Return JSON: headline, bullets (3-6), actions (2-5), cited_change_ids.\n\n" + JSON.stringify(payload);

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "system", content: system }, { role: "user", content: userContent }],
    temperature: 0.2,
    max_tokens: 500,
    response_format: { type: "json_schema", json_schema: ExecSummarySchema },
  });

  const raw = resp.choices?.[0]?.message?.content ?? "";
  return JSON.parse(raw) as ExecSummaryOutput;
}
