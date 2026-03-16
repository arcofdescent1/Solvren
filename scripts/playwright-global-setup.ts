#!/usr/bin/env npx tsx
/**
 * Playwright global setup: ensure UAT seed data exists before e2e tests.
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 * Set SKIP_E2E_SEED=1 to skip (e.g. if you already seeded or use a different flow).
 */
import { execSync } from "child_process";
import * as path from "path";

export default async function globalSetup() {
  if (process.env.SKIP_E2E_SEED === "1") {
    console.log("[playwright] SKIP_E2E_SEED=1, skipping seed");
    return;
  }
  const cwd = process.cwd();
  const envPath = path.join(cwd, ".env.local");
  const fs = await import("fs");
  if (!fs.existsSync(envPath)) {
    console.warn(
      "[playwright] No .env.local found. E2E login will fail unless Supabase is configured and DB is seeded."
    );
    return;
  }
  console.log("[playwright] Running UAT seed for e2e...");
  try {
    execSync("npx tsx scripts/seed-uat.ts", {
      cwd,
      stdio: "inherit",
      env: { ...process.env },
    });
  } catch (e) {
    console.error("[playwright] Seed failed. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in .env.local.");
    throw e;
  }
}
