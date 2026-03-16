/**
 * Centralized auth redirect logic.
 * Ensures deterministic redirect targets for login, post-auth, and shell transitions.
 */

/** Allowed app routes for returnTo/next param validation. Must start with / and not be external. */
const ALLOWED_APP_PREFIXES = [
  "/dashboard",
  "/changes",
  "/queue",
  "/reviews",
  "/org",
  "/settings",
  "/admin",
  "/signals",
  "/search",
  "/notifications",
  "/onboarding",
  "/executive",
  "/ops",
  "/invite",
];

/**
 * Validates and returns a safe redirect URL for post-login.
 * If explicit returnTo exists and is allowed, use it. Otherwise /dashboard.
 */
export function getSafeAppRedirect(returnTo: string | null): string {
  if (!returnTo || typeof returnTo !== "string" || !returnTo.startsWith("/") || returnTo.startsWith("//")) {
    return "/dashboard";
  }
  const allowed = ALLOWED_APP_PREFIXES.some((prefix) => returnTo === prefix || returnTo.startsWith(prefix + "/"));
  return allowed ? returnTo : "/dashboard";
}
