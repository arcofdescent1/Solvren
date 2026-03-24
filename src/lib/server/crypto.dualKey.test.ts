import { describe, expect, it } from "vitest";
import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import { decryptSecretWithAnyKey, decryptSecretWithKeyBytes } from "@/lib/server/crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

describe("decryptSecretWithAnyKey", () => {
  it("decrypts when the second key matches", () => {
    const keyA = scryptSync("key-a-test", "salt", 32);
    const keyB = scryptSync("key-b-test", "salt2", 32);
    const ct = encryptWithKey("hello-rotation", keyA);
    const out = decryptSecretWithAnyKey(ct, [keyB, keyA]);
    expect(out).toBe("hello-rotation");
  });

  it("decryptSecretWithKeyBytes fails on wrong key", () => {
    const keyA = scryptSync("a", "s", 32);
    const keyB = scryptSync("b", "s", 32);
    const ct = encryptWithKey("x", keyA);
    expect(() => decryptSecretWithKeyBytes(ct, keyB)).toThrow();
  });
});
