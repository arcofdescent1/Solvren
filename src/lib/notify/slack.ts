export async function slackPostMessage(params: {
  botToken: string;
  channel: string;
  text: string;
  blocks?: Record<string, unknown>[];
}) {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      channel: params.channel,
      text: params.text,
      blocks: params.blocks,
      unfurl_links: false,
      unfurl_media: false,
    }),
  });

  const json = (await res.json()) as { ok?: boolean; error?: string };
  if (!json?.ok) {
    throw new Error(json?.error ?? "slack_post_failed");
  }
  return json;
}
