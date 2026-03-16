export async function slackChatUpdate(args: {
  token: string;
  channel: string;
  ts: string;
  blocks: unknown[];
  text: string;
}) {
  const res = await fetch("https://slack.com/api/chat.update", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      channel: args.channel,
      ts: args.ts,
      text: args.text,
      blocks: args.blocks,
    }),
  });

  const json = await res.json().catch(() => null);

  if (!res.ok || !json?.ok) {
    const err = json?.error ?? `http_${res.status}`;
    throw new Error(`Slack chat.update failed: ${err}`);
  }

  return json;
}
