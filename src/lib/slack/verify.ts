import crypto from "crypto";
import { env } from "@/lib/env";

export async function verifySlackRequest(req: Request): Promise<{ ok: boolean; body: string }> {
  const signingSecret = env.slackSigningSecret;
  if (!signingSecret) throw new Error("missing SLACK_SIGNING_SECRET");

  const ts = req.headers.get("x-slack-request-timestamp");
  const sig = req.headers.get("x-slack-signature");
  if (!ts || !sig) return { ok: false, body: "" };

  const ageSec = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(ageSec) || ageSec > 60 * 5) return { ok: false, body: "" };

  const body = await req.text();
  const base = `v0:${ts}:${body}`;
  const hash = crypto.createHmac("sha256", signingSecret).update(base).digest("hex");
  const expected = `v0=${hash}`;

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return { ok: false, body };
  const match = crypto.timingSafeEqual(a, b);
  return { ok: match, body };
}
