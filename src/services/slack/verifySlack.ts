// src/services/slack/verifySlack.ts
import crypto from "crypto";

export function verifySlackRequest(args: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  signingSecret: string;
}) {
  const { rawBody, timestamp, signature, signingSecret } = args;

  if (!timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;

  // Replay protection: 5 minutes
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 60 * 5) return false;

  const base = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto
    .createHmac("sha256", signingSecret)
    .update(base)
    .digest("hex");
  const expected = `v0=${hmac}`;

  try {
    const ab = Buffer.from(expected, "utf8");
    const bb = Buffer.from(signature, "utf8");
    if (ab.length !== bb.length) return false;
    return crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
