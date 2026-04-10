import crypto from "crypto";

export function rootCauseHash(parts: string[]): string {
  const s = parts.map((p) => String(p).trim()).join("|");
  return crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 32);
}
