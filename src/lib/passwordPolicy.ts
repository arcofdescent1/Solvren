/**
 * Shared password policy for registration, password reset, and future password change.
 * Keep this in one place so rules do not diverge.
 */

export const PASSWORD_MIN_LENGTH = 12;

export const PASSWORD_SPECIAL_CHARACTER_PATTERN = /[^A-Za-z0-9]/;

export const PASSWORD_REQUIREMENTS = [
  `At least ${PASSWORD_MIN_LENGTH} characters`,
  "One uppercase letter",
  "One lowercase letter",
  "One number",
  "One special character",
] as const;

export type PasswordValidation = {
  valid: boolean;
  message?: string;
};

/**
 * Validates password against policy. Use on signup and reset-password forms.
 */
export function validatePassword(password: string): PasswordValidation {
  if (!password || password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`,
    };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must include at least one uppercase letter." };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must include at least one lowercase letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must include at least one number." };
  }
  if (!PASSWORD_SPECIAL_CHARACTER_PATTERN.test(password)) {
    return { valid: false, message: "Password must include at least one special character." };
  }
  return { valid: true };
}

/**
 * Returns an error message if passwords do not match; otherwise undefined.
 */
export function validatePasswordMatch(
  password: string,
  confirmPassword: string
): string | undefined {
  if (password !== confirmPassword) return "Passwords do not match.";
  return undefined;
}
