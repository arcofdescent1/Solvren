import { getOpenAI } from "@/lib/openai";

export async function generateStructuredObject<T>(args: {
  model: string;
  systemInstruction: string;
  userPrompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const openai = getOpenAI();
  if (!openai) {
    throw new Error("AI integration disabled: OPENAI_API_KEY not configured");
  }

  const response = await openai.chat.completions.create({
    model: args.model,
    messages: [
      { role: "system", content: args.systemInstruction },
      { role: "user", content: args.userPrompt },
    ],
    temperature: args.temperature ?? 0.1,
    max_tokens: args.maxTokens ?? 2000,
    response_format: {
      type: "json_schema",
      json_schema: args.schema as never,
    },
  });

  const raw = response.choices?.[0]?.message?.content ?? "";
  return JSON.parse(raw) as T;
}
