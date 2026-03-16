import crypto from "crypto";
import { env } from "@/lib/env";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function verifySlackSignature(args: {
  rawBody: string;
  slackSignature: string | null;
  slackTimestamp: string | null;
}) {
  const signingSecret = env.slackSigningSecret;
  if (!signingSecret) throw new Error("Missing SLACK_SIGNING_SECRET");

  const { rawBody, slackSignature, slackTimestamp } = args;

  if (!slackSignature || !slackTimestamp) return false;

  const ts = Number(slackTimestamp);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 60 * 5) return false;

  const baseString = `v0:${slackTimestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(baseString)
    .digest("hex");
  const computed = `v0=${hmac}`;

  return safeEqual(computed, slackSignature);
}
