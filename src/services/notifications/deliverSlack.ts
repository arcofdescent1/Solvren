/**
 * Deliver a Slack API call from outbox payload.
 * Payload: { method, args } — e.g. chat.postMessage, chat.update
 */
import { retryWithBackoff, RETRY_PRESETS } from "@/lib/retry/retryWithBackoff";

export async function deliverSlack(params: {
  botToken: string;
  payload: { method?: string; args?: Record<string, unknown>; meta?: Record<string, unknown> };
}) {
  const { botToken, payload } = params;
  const { method, args } = payload ?? {};

  if (!method || !args) throw new Error("Invalid Slack payload: method and args required");

  return retryWithBackoff(
    async () => {
      const res = await fetch(`https://slack.com/api/${method}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${botToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(args),
      });

      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        ts?: string;
        channel?: string;
      };

      if (!json?.ok) throw new Error(json?.error ?? `Slack API error: ${method}`);

      return json;
    },
    { retries: RETRY_PRESETS.slackOrEmail.retries, backoffMs: RETRY_PRESETS.slackOrEmail.backoffMs }
  );
}
