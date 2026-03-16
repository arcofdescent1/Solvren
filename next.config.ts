import type { NextConfig } from "next";
import path from "path";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
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

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
