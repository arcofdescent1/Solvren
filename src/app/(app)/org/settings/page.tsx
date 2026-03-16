import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import OrgSettingsForm from "@/components/OrgSettingsForm";
import LearningRecomputePanel from "@/components/LearningRecomputePanel";
import BootstrapPanel from "@/components/BootstrapPanel";
import SlackLinkPanel from "@/components/SlackLinkPanel";
import SlackIntegrationPanel from "@/components/SlackIntegrationPanel";
import SsoIntegrationPanel from "@/components/SsoIntegrationPanel";
import JiraIntegrationPanel from "@/components/JiraIntegrationPanel";
import GitHubIntegrationPanel from "@/components/GitHubIntegrationPanel";
import NetSuiteIntegrationPanel from "@/components/NetSuiteIntegrationPanel";
import SalesforceIntegrationPanel from "@/components/SalesforceIntegrationPanel";
import HubSpotIntegrationPanel from "@/components/HubSpotIntegrationPanel";
import BillingPanel from "@/components/BillingPanel";
import WeeklyDigestPanel from "@/components/WeeklyDigestPanel";
import Link from "next/link";
import { getActiveOrg } from "@/lib/org/activeOrg";
import { PageHeader, Card, CardBody, Stack } from "@/ui";
import { isAdminLikeRole, parseOrgRole } from "@/lib/rbac/roles";
import { getIntegrationsList } from "@/lib/integrations/list";

export default async function OrgSettingsPage() {
  const supabase = await createServerSupabaseClient();
  const { data: userRes } = await supabase.auth.getUser();
  if (!userRes.user) redirect("/login");

  const { activeOrgId, memberships } = await getActiveOrg(
    supabase,
    userRes.user.id
  );

  const membership = memberships.find((m) => m.orgId === activeOrgId) ?? null;

  if (!membership?.orgId) {
    return (
      <Stack gap={4}>
        <p className="text-sm text-[var(--text)]">No organization found for your account.</p>
        <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
          Back to dashboard
        </Link>
      </Stack>
    );
  }

  const orgId = membership.orgId;

  const { data: settings } = await supabase
    .from("organization_settings")
    .select(
      "org_id, slack_enabled, slack_webhook_url, email_enabled, notification_emails"
    )
    .eq("org_id", orgId)
    .maybeSingle();

  const { data: ssoProviders } = await supabase
    .from("sso_providers")
    .select("id")
    .eq("org_id", orgId);

  const integrations = await getIntegrationsList(supabase, orgId);

  const { data: slackMap } = await supabase
    .from("slack_user_map")
    .select("slack_user_id")
    .eq("org_id", orgId)
    .eq("user_id", userRes.user.id)
    .maybeSingle();

  const { data: baselineRow } = await supabase
    .from("risk_learning_baseline")
    .select(
      "baseline_incident_rate_smoothed, min_samples, window_days, last_computed_at"
    )
    .eq("id", 1)
    .maybeSingle();

  const baseline = baselineRow
    ? {
        window_days: Number(baselineRow.window_days ?? 14),
        min_samples: Number(baselineRow.min_samples ?? 20),
        alpha: (baselineRow as { alpha?: number }).alpha ?? 1,
        beta: (baselineRow as { beta?: number }).beta ?? 4,
        baseline_incident_rate_smoothed: Number(
          baselineRow.baseline_incident_rate_smoothed ?? 0
        ),
        last_computed_at: baselineRow.last_computed_at ?? null,
      }
    : null;

  const isAdmin = isAdminLikeRole(parseOrgRole(membership.role ?? null));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "Settings" },
        ]}
        title="Settings"
        description="Organization and integration configuration"
        right={
          <Link href="/dashboard" className="text-sm font-semibold text-[var(--primary)] hover:underline">
            ← Dashboard
          </Link>
        }
      />

      <Card>
        <CardBody>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Quick links
          </h2>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/integrations"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Integrations
            </Link>
            <Link
              href="/settings/organization"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              Organization
            </Link>
            <Link href="/settings/users" className="text-sm font-medium text-[var(--primary)] hover:underline">
              Team & invites
            </Link>
            {isAdmin && (
              <>
                <span className="w-full shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  Governance
                </span>
                <Link href="/settings/approval-roles" className="text-sm font-medium text-[var(--primary)] hover:underline">
                  Approval policies
                </Link>
                <Link href="/settings/approval-mappings" className="text-sm font-medium text-[var(--primary)] hover:underline">
                  Approval role mappings
                </Link>
                <span className="w-full shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                  System (admin only)
                </span>
                <Link href="/settings/system/diagnostics" className="text-sm font-medium text-[var(--primary)] hover:underline">
                  System diagnostics
                </Link>
              </>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <BillingPanel orgId={orgId} isAdmin={isAdmin} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <SsoIntegrationPanel
            orgId={orgId}
            ssoConfigured={(ssoProviders ?? []).length > 0}
            isAdmin={isAdmin}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardBody>
                <JiraIntegrationPanel
              orgId={orgId}
              jiraConnected={integrations.jira.connected}
              jiraConfig={integrations.jira.meta?.config ?? null}
              isAdmin={isAdmin}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
                <GitHubIntegrationPanel
              orgId={orgId}
              githubConnected={integrations.github.connected}
              accountLogin={(integrations.github.meta?.accountLogin as string | undefined) ?? null}
              isAdmin={isAdmin}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
                <NetSuiteIntegrationPanel
              orgId={orgId}
              netsuiteConnected={integrations.netsuite.connected}
              accountId={(integrations.netsuite.meta?.accountId as string | undefined) ?? null}
              isAdmin={isAdmin}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
                <SalesforceIntegrationPanel
              orgId={orgId}
              salesforceConnected={integrations.salesforce.connected}
              sfOrgId={(integrations.salesforce.meta?.sfOrgId as string | undefined) ?? null}
              isAdmin={isAdmin}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
                <HubSpotIntegrationPanel
              orgId={orgId}
              hubspotConnected={integrations.hubspot.connected}
              hubId={(integrations.hubspot.meta?.hubId as number | undefined) ?? null}
              isAdmin={isAdmin}
            />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
                <SlackIntegrationPanel
              orgId={orgId}
              slackConnected={integrations.slack.connected}
              teamName={(integrations.slack.meta?.teamName as string | undefined) ?? null}
              isAdmin={isAdmin}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardBody>
            <SlackLinkPanel
            orgId={orgId}
            initialSlackUserId={slackMap?.slack_user_id ?? null}
          />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <WeeklyDigestPanel orgId={orgId} isAdmin={isAdmin} />
        </CardBody>
      </Card>

      <Card>
        <CardBody>
            <OrgSettingsForm
            orgId={orgId}
            isAdmin={isAdmin}
            initial={
              settings ?? {
                org_id: orgId,
                slack_enabled: false,
                slack_webhook_url: null,
                email_enabled: false,
                notification_emails: null,
              }
            }
          />
        </CardBody>
      </Card>

      {isAdmin && (
        <>
          <Card>
            <CardBody>
              <BootstrapPanel orgId={orgId} isAdmin={isAdmin} />
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <LearningRecomputePanel isAdmin={isAdmin} baseline={baseline} />
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
