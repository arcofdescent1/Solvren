#!/usr/bin/env npx tsx
/**
 * One-time bootstrap: grant internal super_admin from env user id.
 *
 * Env: SOLVREN_BOOTSTRAP_ADMIN_USER_ID (auth user UUID)
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local
 *
 * Safe to rerun: upserts existing row by user_id.
 * Does not commit secrets — user id comes from environment only.
 *
 * Other internal roles (set via SQL or admin tooling, not this script) include
 * support_admin, billing_support, account_ops, and technical_support (Phase 2 required).
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) {
        const key = m[1].trim();
        const val = m[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

const SOLVREN_SUFFIX = "@solvren.com";

async function main() {
  const userId = process.env.SOLVREN_BOOTSTRAP_ADMIN_USER_ID?.trim();
  if (!userId) {
    console.error("Set SOLVREN_BOOTSTRAP_ADMIN_USER_ID to a Supabase auth user UUID.");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: u, error: userErr } = await admin.auth.admin.getUserById(userId);
  if (userErr || !u?.user?.email) {
    console.error("Auth user not found:", userErr?.message ?? "no user");
    process.exit(1);
  }

  const email = u.user.email.toLowerCase();
  if (!email.endsWith(SOLVREN_SUFFIX)) {
    console.error("Auth user email must end with @solvren.com.");
    process.exit(1);
  }

  const { error: upsertErr } = await admin.from("internal_employee_accounts").upsert(
    {
      user_id: userId,
      email,
      employee_role: "super_admin",
      is_active: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertErr) {
    console.error("Upsert failed:", upsertErr.message);
    process.exit(1);
  }

  console.log("Bootstrap ok: internal_employee_accounts set to super_admin for", email);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
