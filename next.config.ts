import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  async headers() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseHost = (() => {
      try {
        return supabaseUrl ? new URL(supabaseUrl).origin : "";
      } catch {
        return "";
      }
    })();
    const connectSrc = ["'self'", "https:", "wss:"];
    if (supabaseHost) connectSrc.push(supabaseHost);

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
        value: [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob: https:",
          "font-src 'self' data:",
          `connect-src ${connectSrc.join(" ")}`,
          "frame-ancestors 'self'",
        ].join("; "),
      },
    ];

    if (process.env.NODE_ENV === "production") {
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
      { source: "/settings", destination: "/org/settings", permanent: true },
      { source: "/admin", destination: "/admin/jobs", permanent: true },
      // Gap 1: demote Reviews, Signals from primary nav
      { source: "/reviews", destination: "/changes?view=in_review", permanent: false },
      { source: "/signals", destination: "/risk/audit", permanent: false },
      // Gap 2: Ops moved to Settings → System diagnostics
      { source: "/ops", destination: "/settings/system/diagnostics", permanent: false },
      // Gap 3: integration marketplace at /settings/integrations
      { source: "/settings/integrations", destination: "/org/settings/integrations", permanent: false },
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
