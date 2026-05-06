import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

/**
 * Phase 1 CSP: measured hardening (explicit high-trust hosts + https:/wss: fallbacks).
 * Before changing: verify login, Supabase, Sentry, and integrations in staging (see security-reports/PHASE1-OPERATIONAL.md).
 * Do not add Cross-Origin-Resource-Policy: same-origin (breaks OAuth/embeds).
 */
function buildConnectSrcParts(): string[] {
  const parts: string[] = [
    "'self'",
    "https:",
    "wss:",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.sentry.io",
    "https://*.ingest.sentry.io",
    "https://api.stripe.com",
    "https://*.vercel-insights.com",
  ];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  try {
    if (supabaseUrl) {
      parts.push(new URL(supabaseUrl).origin);
    }
  } catch {
    /* ignore malformed */
  }

  const sentryDsn =
    process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN ?? "";
  try {
    if (sentryDsn) {
      parts.push(new URL(sentryDsn).origin);
    }
  } catch {
    /* ignore */
  }

  return [...new Set(parts)];
}

const nextConfig: NextConfig = {
  async headers() {
    const isProd = process.env.NODE_ENV === "production";
    const connectSrc = buildConnectSrcParts();

    const scriptSrc = isProd
      ? ["'self'", "'unsafe-inline'", "https:"]
      : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:"];

    const styleSrc = ["'self'", "'unsafe-inline'"];

    const cspDirectives = [
      "default-src 'self'",
      `script-src ${scriptSrc.join(" ")}`,
      `style-src ${styleSrc.join(" ")}`,
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrc.join(" ")}`,
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
      ...(isProd ? (["upgrade-insecure-requests"] as const) : []),
    ].join("; ");

    const security: { key: string; value: string }[] = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
      {
        key: "Content-Security-Policy",
        value: cspDirectives,
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
    ];

    if (isProd) {
      security.unshift({
        key: "Strict-Transport-Security",
        value: "max-age=63072000; includeSubDomains; preload",
      });
    }

    return [{ source: "/:path*", headers: security }];
  },
  // Explicitly pass Supabase env into client bundle (ensures Vercel build sees them)
  env:
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ? {
          NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
          NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        }
      : {},
  turbopack: {
    root: path.resolve(process.cwd()),
  },
  async redirects() {
    return [
      // Phase 5 — canonical nav (dashboard / home → action queue)
      { source: "/dashboard", destination: "/action-queue", permanent: false },
      { source: "/home", destination: "/dashboard", permanent: false },
      { source: "/signals", destination: "/issues", permanent: false },
      { source: "/value", destination: "/roi", permanent: false },
      { source: "/org/settings", destination: "/settings", permanent: false },
      { source: "/admin", destination: "/admin/jobs", permanent: true },
      // Gap 1: demote Reviews
      { source: "/reviews", destination: "/changes?view=in_review", permanent: false },
      // Gap 2: Ops moved to Settings → System diagnostics
      { source: "/ops", destination: "/settings/system/diagnostics", permanent: false },
      // Gap 3: integration marketplace at /settings/integrations
      { source: "/settings/integrations", destination: "/org/settings/integrations", permanent: false },
      { source: "/getting-started", destination: "/onboarding", permanent: false },
      { source: "/setup", destination: "/onboarding", permanent: false },
      { source: "/intro", destination: "/onboarding", permanent: false },
    ];
  },
};

const sentryDsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
const useSentry = Boolean(sentryDsn);

export default useSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
    })
  : nextConfig;
