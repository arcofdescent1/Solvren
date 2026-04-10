export async function slackApi(
  botToken: string,
  method: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const res = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok?: boolean; error?: string; channel?: { id?: string } };
  if (!json?.ok) throw new Error(json?.error ?? `Slack API error: ${method}`);
  return json as Record<string, unknown>;
}
