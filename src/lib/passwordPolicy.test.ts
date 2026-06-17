import { describe, expect, it } from "vitest";
import { validatePassword, validatePasswordMatch } from "./passwordPolicy";

describe("passwordPolicy", () => {
  it("requires an enterprise-strength password", () => {
    expect(validatePassword("short").valid).toBe(false);
    expect(validatePassword("lowercasepassword1!").valid).toBe(false);
    expect(validatePassword("UPPERCASEPASSWORD1!").valid).toBe(false);
    expect(validatePassword("NoNumberPassword!").valid).toBe(false);
    expect(validatePassword("NoSpecialPassword1").valid).toBe(false);
    expect(validatePassword("ValidPassword1!").valid).toBe(true);
  });

  it("validates password confirmation", () => {
    expect(validatePasswordMatch("ValidPassword1!", "ValidPassword1!")).toBeUndefined();
    expect(validatePasswordMatch("ValidPassword1!", "DifferentPassword1!")).toBe("Passwords do not match.");
  });
});
