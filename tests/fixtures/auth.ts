import { Page } from "@playwright/test";
import { PERSONAS, UAT_PASSWORD } from "./seed";

export type PersonaKey = keyof typeof PERSONAS;

/** Log in as a seeded persona. Assumes login page or any page that redirects to login. */
export async function loginAs(page: Page, persona: PersonaKey) {
  const { email } = PERSONAS[persona];
  await page.goto("/login");
  await page.getByPlaceholder("Email").fill(email);
  await page.getByPlaceholder("Password").fill(UAT_PASSWORD);
  await page.getByRole("button", { name: /^Login$/ }).click();
  try {
    await page.waitForURL(/\/(home|dashboard|onboarding)/, { timeout: 45_000 });
  } catch {
    if (page.url().includes("/auth/verify-pending")) {
      throw new Error(
        "Login redirected to verify-pending. Ensure UAT users have email confirmed (seed runs updateUserById with email_confirm: true)."
      );
    }
    throw new Error(`Login did not reach home/dashboard/onboarding. Current URL: ${page.url()}`);
  }
}
