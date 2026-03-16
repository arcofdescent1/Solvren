"use client";

import { Button } from "@/ui";
import Link from "next/link";

type Props = {
  orgId: string;
  ssoConfigured: boolean;
  isAdmin: boolean;
};

export default function SsoIntegrationPanel({
  ssoConfigured,
  isAdmin,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-[var(--text)]">SSO / Enterprise Identity</h3>
        {ssoConfigured ? (
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
            Configured
          </span>
        ) : (
          <span className="rounded-full border border-[var(--border)] px-2.5 py-0.5 text-xs text-[var(--text-muted)]">
            Not configured
          </span>
        )}
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        Configure Okta, Google Workspace, Microsoft Entra ID, or custom OIDC/SAML for enterprise login.
      </p>
      {isAdmin && (
        <div className="flex items-center gap-2">
          <Link href="/org/settings/security/sso">
            <Button variant={ssoConfigured ? "outline" : "default"}>
              {ssoConfigured ? "Configure SSO" : "Set up SSO"}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
