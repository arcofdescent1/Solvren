import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export async function GET() {
  const started = Date.now();
  let dbOk = false;
  let dbError: string | null = null;

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("organizations").select("id").limit(1);
    if (error) {
      dbError = error.message;
    } else {
      dbOk = true;
    }
  } catch (e) {
    dbError = e instanceof Error ? e.message : "Unknown DB error";
  }

  const checks = {
    app: true,
    db: dbOk,
    env: {
      appUrl: Boolean(process.env.APP_URL),
      supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
      supabaseServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      cronSecret: Boolean(env.cronSecret),
      sentryDsn: Boolean(env.sentryDsn || env.nextPublicSentryDsn),
      resendApiKey: Boolean(env.resendApiKey),
      slackClientId: Boolean(env.slackClientId),
      stripeSecretKey: Boolean(env.stripeSecretKey),
    },
    integrations: {
      ai: env.aiEnabled,
      billing: env.billingEnabled,
      slack: env.slackEnabled,
      email: env.emailEnabled,
    },
  };

  const ok = checks.app && checks.db;
  return NextResponse.json(
    {
      ok,
      status: ok ? "healthy" : "degraded",
      checks,
      dbError,
      environment: process.env.NODE_ENV ?? "development",
      responseMs: Date.now() - started,
      now: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 }
  );
}
