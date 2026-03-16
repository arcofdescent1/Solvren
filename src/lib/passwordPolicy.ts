/**
 * Shared password policy for registration, password reset, and future password change.
 * Keep this in one place so rules do not diverge.
 */

export const PASSWORD_MIN_LENGTH = 8;

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
