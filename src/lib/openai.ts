import OpenAI from "openai";
import { env } from "@/lib/env";

let openaiInstance: OpenAI | null = null;

/**
 * Returns OpenAI client when AI is configured. Null when disabled.
 * Never use placeholder keys - missing config = feature disabled.
 */
export function getOpenAI(): OpenAI | null {
  if (!env.aiEnabled) return null;
  if (!openaiInstance) {
    const key = env.openaiApiKey;
    if (!key) return null;
    openaiInstance = new OpenAI({ apiKey: key });
  }
  return openaiInstance;
}

/** Use getOpenAI() and check for null before calling. Throws if AI disabled - for legacy callers. */
export const openai = {
  get chat() {
    const client = getOpenAI();
    if (!client) {
      throw new Error("AI integration disabled: OPENAI_API_KEY not configured");
    }
    return client.chat;
  },
};
