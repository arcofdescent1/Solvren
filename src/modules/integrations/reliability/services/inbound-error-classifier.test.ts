import { describe, expect, it } from "vitest";
import {
  classifyInboundError,
  isInboundErrorRetryable,
  INBOUND_ERROR_CODES,
} from "./inbound-error-classifier";

describe("Phase 4 — inbound error classification", () => {
  it("exports a closed set of error codes", () => {
    expect(INBOUND_ERROR_CODES.length).toBeGreaterThan(0);
    expect(new Set(INBOUND_ERROR_CODES).size).toBe(INBOUND_ERROR_CODES.length);
  });

  it("classifies signature-related failures as non-retryable", () => {
    const code = classifyInboundError("Webhook signature invalid");
    expect(code).toBe("SIGNATURE_INVALID");
    expect(isInboundErrorRetryable(code)).toBe(false);
  });

  it("classifies transient network errors as retryable", () => {
    const code = classifyInboundError("ECONNRESET from provider");
    expect(code).toBe("TRANSIENT_PROVIDER_PAYLOAD_ERROR");
    expect(isInboundErrorRetryable(code)).toBe(true);
  });
});
