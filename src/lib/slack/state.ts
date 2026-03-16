import crypto from "crypto";
import { env } from "@/lib/env";

type SlackState = { orgId: string; userId: string; iat: number };

function secret() {
  const s = env.slackStateSecret;
  if (!s) throw new Error("missing SLACK_STATE_SECRET");
  return s;
}

export function signSlackState(input: { orgId: string; userId: string }) {
  const payload: SlackState = { ...input, iat: Date.now() };
  const raw = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", secret())
    .update(raw)
    .digest("base64url");
  return `${raw}.${sig}`;
}

export function verifySlackState(state: string): SlackState {
  const [raw, sig] = state.split(".");
  if (!raw || !sig) throw new Error("invalid_state_format");

  const expected = crypto
    .createHmac("sha256", secret())
    .update(raw)
    .digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error("invalid_state_signature");
  }

  const payload = JSON.parse(
    Buffer.from(raw, "base64url").toString("utf8")
  ) as SlackState;

  if (Date.now() - payload.iat > 10 * 60 * 1000) throw new Error("state_expired");

  return payload;
}
