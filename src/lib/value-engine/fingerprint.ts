import { createHash } from "crypto";

export function computeEventFingerprint(
  orgId: string,
  source: string,
  externalId: string,
  eventType: string
): string {
  return createHash("sha256")
    .update([orgId, source, externalId, eventType].join("|"), "utf8")
    .digest("hex");
}
