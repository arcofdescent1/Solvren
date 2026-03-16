export async function slackUpdateMessage(params: {
  botToken: string;
  channel: string;
  ts: string;
  text: string;
  blocks?: unknown[];
}) {
  const res = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: params.channel,
      ts: params.ts,
      text: params.text,
      blocks: params.blocks,
    }),
  });

  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!json?.ok) {
    throw new Error(json?.error ?? "slack_update_failed");
  }
  return json;
}
