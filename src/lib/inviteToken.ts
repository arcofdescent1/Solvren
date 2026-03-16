import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;
const HASH_ALGORITHM = "sha256";

/**
 * Generate a secure random token for invite links. Return the raw token (to send in email)
 * and the hash (to store in DB). Never store the raw token.
 */
export function generateInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString("hex");
  const tokenHash = hashInviteToken(token);
  return { token, tokenHash };
}

/**
 * Hash a token for comparison with stored token_hash. Use this when validating accept requests.
 */
export function hashInviteToken(token: string): string {
  return createHash(HASH_ALGORITHM).update(token, "utf8").digest("hex");
}

/**
 * Constant-time comparison to reduce timing attacks when verifying token hash.
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
