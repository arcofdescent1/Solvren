"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  EmptyState,
  Grid,
  PageHeaderV2,
  SectionHeader,
  Stack,
} from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import type {
  HomeActivityItem,
  HomeExposureMetric,
  HomeProtectionCard,
  HomeRole,
  HomeRoleStats,
  HomeWorkItem,
} from "@/features/home/presentation/types";
import { HELP_COPY } from "@/config/helpCopy";
import {
  EmptyStateHelp,
  MetricHelpTooltip,
  PageHelpDrawer,
  WhatHappensNextCallout,
  WhySurfacedText,
} from "@/components/help";
import { Phase2ActivationSuccessCard } from "@/components/home/Phase2ActivationSuccessCard";
import { REVENUE_PROTECTION_PLAYBOOKS } from "@/lib/product/revenueProtectionPlaybooks";

type Props = {
  userId: string;
  orgId: string | null;
  role: HomeRole;
  roleStats: HomeRoleStats;
  showPhase2SuccessCard?: boolean;
  priorities: HomeWorkItem[];
  assigned: HomeWorkItem[];
  waiting: HomeWorkItem[];
  exposureLabel: string | null;
  exposureMetrics: HomeExposureMetric[];
  protectionCards: HomeProtectionCard[];
  activity: HomeActivityItem[];
  setupIncomplete: boolean;
  roiSignal: "improving" | "stable" | "needs_attention";
  /** ISO timestamp from the same ROI summary payload as Insights (30d, active org). */
  roiSignalAsOf: string | null;
};

function urgencyVariant(urgency: HomeWorkItem["urgency"]) {
  if (urgency === "critical") return "danger";
  if (urgency === "high") return "warning";
  return "secondary";
}

function whySurfaced(item: HomeWorkItem) {
  if (item.overdue && item.assignedToCurrentUser) return HELP_COPY.whySurfaced.overdue_assigned;
  if (item.nextStep === "Review approvals") return HELP_COPY.whySurfaced.awaiting_review;
  if (item.nextStep === "Add supporting details") return HELP_COPY.whySurfaced.missing_details;
  if (item.nextStep === "Retry notifications") return HELP_COPY.whySurfaced.delivery_problem;
  if (item.linkedToActiveIssue) return HELP_COPY.whySurfaced.linked_issue;
  return "Surfaced because it currently needs action or follow-up.";
}

function workflowNext(item: HomeWorkItem) {
  if (item.nextStep === "Add supporting details") return HELP_COPY.workflowNext.needs_details;
  if (item.nextStep === "Retry notifications") return HELP_COPY.workflowNext.delivery_issue;
  if (item.waitingReason && !item.assignedToCurrentUser) return HELP_COPY.workflowNext.waiting_on_others;
  return null;
}

const OPERATING_MODEL = [
  {
    title: "Detect revenue problems",
    body: "Find leakage, funnel risk, data quality issues, and risky change patterns.",
    href: "/issues",
  },
  {
    title: "Govern risky changes",
    body: "Declare changes, collect evidence, route approvals, and release with confidence.",
    href: "/changes?view=all",
  },
  {
    title: "Route work clearly",
    body: "Give each person one queue for reviews, evidence, assignments, and follow-up.",
    href: "/actions",
  },
  {
    title: "Prove business impact",
    body: "Show exposure, prevented incidents, recovered value, readiness, and ROI.",
    href: "/insights",
  },
] as const;

const CAPABILITY_LINKS = [
  { title: "Release readiness", body: "Portfolio and release risk", href: "/readiness" },
  { title: "Verified outcomes", body: "Value stories and prevented loss", href: "/outcomes" },
  { title: "Executive summary", body: "Leadership-ready overview", href: "/executive" },
  { title: "Integrations", body: "Coverage, health, and setup", href: "/integrations" },
  { title: "Policies", body: "Governance rules and exceptions", href: "/settings/policies" },
  { title: "Team settings", body: "Users, roles, access, and org setup", href: "/settings/users" },
] as const;

function roleLabel(role: HomeRole) {
  if (role === "OWNER") return "Executive owner";
  if (role === "ADMIN") return "Administrator";
  if (role === "REVIEWER") return "Reviewer";
  if (role === "SUBMITTER") return "Submitter";
  return "Viewer";
}

function roleCommand(role: HomeRole, stats: HomeRoleStats) {
  if (role === "OWNER") {
    return {
      title: "Executive command view",
      body: "Start with decisions, exposure, and whether the operating rhythm is protecting revenue.",
      primary: { label: "Review decisions", href: "/changes?view=needs-my-review", value: stats.needsReviewCount },
      secondary: [
        { label: "High-impact items", href: "/issues", value: stats.highImpactCount },
        { label: "Revenue impact", href: "/insights", value: null },
        { label: "Verified outcomes", href: "/outcomes", value: null },
      ],
    };
  }
  if (role === "ADMIN") {
    return {
      title: "Admin control view",
      body: "Keep coverage, governance, and system follow-up healthy so teams can trust the workflow.",
      primary: { label: "Fix system follow-up", href: "/actions", value: stats.staleIntegrationCount + stats.waitingCount },
      secondary: [
        { label: "Connected systems", href: "/integrations", value: stats.connectedSystemCount },
        { label: "Governance rules", href: "/settings/policies", value: null },
        { label: "Team access", href: "/settings/users", value: null },
      ],
    };
  }
  if (role === "REVIEWER") {
    return {
      title: "Reviewer desk",
      body: "Focus on decisions waiting for you, missing evidence, and risks that need judgment.",
      primary: { label: "Decisions for me", href: "/changes?view=needs-my-review", value: stats.needsReviewCount },
      secondary: [
        { label: "Overdue work", href: "/changes?view=overdue", value: stats.overdueCount },
        { label: "High-impact risks", href: "/issues", value: stats.highImpactCount },
        { label: "Evidence gaps", href: "/changes?view=needs-details", value: stats.waitingCount },
      ],
    };
  }
  if (role === "SUBMITTER") {
    return {
      title: "Submitter workspace",
      body: "Prepare changes for review by finishing intake, evidence, and follow-up before they block release.",
      primary: { label: "Finish drafts", href: "/changes?view=needs-details", value: stats.draftCount },
      secondary: [
        { label: "Create change", href: "/intake/new", value: null },
        { label: "Waiting on others", href: "/home#waiting-on-others", value: stats.waitingCount },
        { label: "Changes in flight", href: "/changes?view=all", value: null },
      ],
    };
  }
  return {
    title: "Read-only overview",
    body: "See current risks, changes, and business impact without taking operational actions.",
    primary: { label: "View revenue risks", href: "/issues", value: stats.openIssueCount },
    secondary: [
      { label: "Changes in flight", href: "/changes?view=all", value: null },
      { label: "Business impact", href: "/insights", value: null },
      { label: "Reports", href: "/insights/governance-reports", value: null },
    ],
  };
}

function workItemCard(item: HomeWorkItem, eventName: string, payload: Record<string, unknown>, showWhy: boolean) {
  const next = workflowNext(item);
  return (
    <Card key={item.id} className="shadow-sm">
      <CardBody>
        <Stack gap={2}>
          <Stack direction="row" justify="between" align="center">
            <p className="text-sm font-semibold">{item.title}</p>
            <Badge variant={urgencyVariant(item.urgency)}>{item.urgency}</Badge>
          </Stack>
          <Stack direction="row" align="center" gap={2} className="text-xs text-[var(--text-muted)]">
            <Badge variant="outline">{item.objectType}</Badge>
            <span>{item.why}</span>
          </Stack>
          {showWhy ? <WhySurfacedText text={whySurfaced(item)} /> : null}
          <p className="text-sm">Next step: {item.nextStep}</p>
          {next ? <WhatHappensNextCallout text={next} /> : null}
          <Button asChild variant="secondary" size="sm">
            <Link href={item.destination} onClick={() => trackAppEvent(eventName, payload)}>
              {item.objectType === "Issue" ? "Open issue" : item.objectType === "Change" ? "Open change" : "Open action"}
            </Link>
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}

export default function HomeCommandCenterClient({
  userId,
  orgId,
  role,
  roleStats,
  priorities,
  assigned,
  waiting,
  exposureLabel,
  exposureMetrics,
  protectionCards,
  activity,
  setupIncomplete,
  roiSignal,
  roiSignalAsOf,
  showPhase2SuccessCard = false,
}: Props) {
  const roleView = roleCommand(role, roleStats);

  useEffect(() => {
    trackAppEvent("home_page_view", { user_id: userId, org_id: orgId, section: "home" });
  }, [userId, orgId]);

  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Home" }]}
        title="Command Center"
        description="A simple control room for revenue risk: what needs attention, what is exposed, and what Solvren is protecting."
        helper="Start here for daily work. Use the queue for decisions, risks for investigations, changes for governance, and impact for executive proof."
        helpTrigger={<PageHelpDrawer page="home" />}
      />

      {showPhase2SuccessCard ? <Phase2ActivationSuccessCard /> : null}

      <Card className="border-[var(--primary)]/20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_7%,var(--bg-surface)),var(--bg-surface)_58%,color-mix(in_oklab,var(--success)_5%,var(--bg-surface)))]">
        <CardBody>
          <Stack gap={4}>
            <Stack direction="row" justify="between" gap={4} className="flex-wrap">
              <div className="max-w-3xl">
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--primary)]">Today in Solvren</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-normal text-[var(--text)]">Act on the few things that protect revenue now.</h2>
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  You are seeing the {roleLabel(role).toLowerCase()} view. Solvren turns detections, risky changes, approvals, and verification into plain next steps for your role.
                </p>
              </div>
              <div className="grid min-w-[16rem] grid-cols-2 gap-2 text-sm">
                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Needs you</p>
                  <p className="text-xl font-semibold">{assigned.length}</p>
                </div>
                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                  <p className="text-xs text-[var(--text-muted)]">Blocked</p>
                  <p className="text-xl font-semibold">{waiting.length}</p>
                </div>
              </div>
            </Stack>
            <Stack direction="row" gap={2} className="flex-wrap">
              <Button asChild>
                <Link data-testid="home-hero-action-center" href="/actions">
                  Open Work Queue
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link data-testid="home-hero-changes" href="/changes?view=all">
                  Review changes
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/insights">
                  View business impact
                </Link>
              </Button>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      <Card className="border-[var(--border)]">
        <CardBody>
          <Stack gap={4}>
            <Stack direction="row" justify="between" gap={4} className="flex-wrap">
              <div className="max-w-2xl">
                <Badge variant="outline">{roleLabel(role)}</Badge>
                <h2 className="mt-3 text-lg font-semibold">{roleView.title}</h2>
                <p className="mt-1 text-sm text-[var(--text-muted)]">{roleView.body}</p>
              </div>
              <Button asChild>
                <Link href={roleView.primary.href}>
                  {roleView.primary.label}
                  {roleView.primary.value != null ? ` (${roleView.primary.value})` : ""}
                </Link>
              </Button>
            </Stack>
            <Grid cols={1} gap={3} className="md:grid-cols-3">
              {roleView.secondary.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface)]"
                >
                  <Stack direction="row" justify="between" align="center" gap={3}>
                    <span className="text-sm font-semibold text-[var(--text)]">{item.label}</span>
                    {item.value != null ? <Badge variant="secondary">{item.value}</Badge> : null}
                  </Stack>
                </Link>
              ))}
            </Grid>
          </Stack>
        </CardBody>
      </Card>

      <Stack gap={3}>
        <SectionHeader title="How to use Solvren" helper="The app is organized around four everyday jobs. Every capability rolls up into one of these areas." />
        <Grid cols={1} gap={3} className="md:grid-cols-2 lg:grid-cols-4">
          {OPERATING_MODEL.map((item) => (
            <Link key={item.title} href={item.href} className="group block rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface-2)]">
              <p className="font-semibold text-[var(--text)] group-hover:text-[var(--primary)]">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{item.body}</p>
            </Link>
          ))}
        </Grid>
      </Stack>

      <Card>
        <CardBody>
          <SectionHeader
            title="Revenue protection playbooks"
            helper="Common enterprise paths that turn Solvren from monitoring into a repeatable operating model."
            action={
              <Link href="/insights" className="text-sm font-semibold text-[var(--primary)] hover:underline">
                View proof
              </Link>
            }
          />
          <Grid cols={1} gap={3} className="mt-3 md:grid-cols-3">
            {REVENUE_PROTECTION_PLAYBOOKS.slice(0, 3).map((playbook) => (
              <Link
                key={playbook.key}
                href={playbook.href}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 transition hover:border-[var(--primary)]/40"
              >
                <p className="text-sm font-semibold">{playbook.title}</p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{playbook.trigger}</p>
                <p className="mt-2 text-xs font-medium text-[var(--primary)]">{playbook.systems.slice(0, 3).join(" + ")}</p>
              </Link>
            ))}
          </Grid>
        </CardBody>
      </Card>

      <Stack gap={3} id="waiting-on-others">
        <SectionHeader title="Today's priorities" helper={HELP_COPY.sections.todays_priorities} />
        {priorities.length === 0 ? (
          <EmptyState
            variant="good_empty"
            title="No urgent priorities right now"
            body="There are no major items that need immediate review, resolution, or follow-up."
          />
        ) : (
          <Grid cols={1} gap={3} className="md:grid-cols-2 lg:grid-cols-3">
            {priorities.map((item, index) =>
              workItemCard(
                item,
                "home_priority_open",
                {
                  user_id: userId,
                  org_id: orgId,
                  object_type: item.objectType,
                  object_id: item.id,
                  destination: item.destination,
                  position: index,
                },
                true
              )
            )}
          </Grid>
        )}
      </Stack>

      <Stack gap={3}>
        <SectionHeader title="Assigned to me" helper={HELP_COPY.sections.assigned_to_me} />
        {assigned.length === 0 ? (
          <EmptyState
            variant="good_empty"
            title="Nothing is assigned to you right now"
            body="Solvren will surface new work here when your review or follow-up is needed."
          />
        ) : (
          <Grid cols={1} gap={3} className="md:grid-cols-2">
            {assigned.map((item, index) =>
              workItemCard(
                item,
                "home_assigned_open",
                {
                  user_id: userId,
                  org_id: orgId,
                  object_type: item.objectType,
                  object_id: item.id,
                  destination: item.destination,
                  position: index,
                },
                false
              )
            )}
          </Grid>
        )}
      </Stack>

      <Stack gap={3}>
        <SectionHeader title="Waiting on others" helper={HELP_COPY.sections.waiting_on_others} />
        {waiting.length === 0 ? (
          <EmptyState
            variant="good_empty"
            title="Nothing is blocked right now"
            body="There are no major items currently waiting on another person, team, or system."
          />
        ) : (
          <Grid cols={1} gap={3} className="md:grid-cols-2">
            {waiting.map((item, index) =>
              workItemCard(
                item,
                "home_waiting_open",
                {
                  user_id: userId,
                  org_id: orgId,
                  object_type: item.objectType,
                  object_id: item.id,
                  destination: item.destination,
                  position: index,
                },
                false
              )
            )}
          </Grid>
        )}
      </Stack>

      <Stack gap={3}>
        <SectionHeader title="Revenue at risk" helper="A plain-English snapshot of current exposure and where attention is concentrated." />
        <Card className="shadow-sm">
          <CardBody>
            <Stack gap={3}>
              <p className="text-2xl font-semibold">{exposureLabel ?? "Exposure data is still building"}</p>
              <Grid cols={1} gap={3} className="md:grid-cols-2 lg:grid-cols-4">
                {exposureMetrics.map((metric) => (
                  <Card key={metric.label}>
                    <CardBody>
                      <Stack gap={1}>
                        <Stack direction="row" align="center" gap={1}>
                          <p className="text-xs text-[var(--text-muted)]">{metric.label}</p>
                          <MetricHelpTooltip metricKey="revenue_at_risk" page="home" section="exposure" />
                        </Stack>
                        <p className="text-lg font-semibold">{metric.value}</p>
                      </Stack>
                    </CardBody>
                  </Card>
                ))}
              </Grid>
              <Button asChild variant="secondary">
                <Link href="/insights">See impact details</Link>
              </Button>
            </Stack>
          </CardBody>
        </Card>
      </Stack>

      <Stack gap={3}>
        <SectionHeader
          title="Impact signal"
          helper="30-day trend for whether Solvren is reducing risk and improving operational outcomes."
        />
        <Card className="shadow-sm">
          <CardBody>
            <Stack direction="row" justify="between" align="center">
              <p className="text-sm">
                {roiSignal === "improving"
                  ? "The business is moving in the right direction."
                  : roiSignal === "stable"
                    ? "The operating rhythm is stable."
                    : "Leadership attention may be needed."}
              </p>
              <Badge variant={roiSignal === "improving" ? "success" : roiSignal === "stable" ? "secondary" : "warning"}>
                {roiSignal.replaceAll("_", " ")}
              </Badge>
            </Stack>
            {roiSignalAsOf ? (
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                As of {new Date(roiSignalAsOf).toLocaleString()} · 30d window vs previous 30d
              </p>
            ) : null}
            <Button asChild variant="secondary" size="sm">
              <Link href="/insights/roi?range=30d">View impact and outcomes</Link>
            </Button>
          </CardBody>
        </Card>
      </Stack>

      <Stack gap={3}>
        <SectionHeader
          title="Where Solvren is protecting the business"
          helper={HELP_COPY.sections.protection}
        />
        <Card className="shadow-sm">
          <CardBody>
            <Stack gap={3}>
              <Grid cols={1} gap={3} className="md:grid-cols-3">
                {protectionCards.map((card) => (
                  <Card key={card.label}>
                    <CardBody>
                      <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
                      <p className="text-lg font-semibold">{card.value}</p>
                    </CardBody>
                  </Card>
                ))}
              </Grid>
              {setupIncomplete ? (
                <EmptyStateHelp
                  variant="incomplete_setup"
                  title="Finish setup to expand Solvren's protection"
                  body="Connect systems and configure review coverage so Solvren can monitor more of your revenue-critical workflows."
                  ctaLabel="Go to Integrations"
                  ctaHref="/integrations"
                  page="home"
                  section="protection"
                />
              ) : null}
              <Button asChild variant="secondary">
                <Link href="/integrations">Go to Integrations</Link>
              </Button>
            </Stack>
          </CardBody>
        </Card>
      </Stack>

      <Stack gap={3}>
        <SectionHeader title="Recent activity" helper={HELP_COPY.sections.recent_activity} />
        <Card>
          <CardBody>
            <Stack gap={2}>
              {activity.length === 0 ? (
                <EmptyStateHelp
                  variant="still_building"
                  title="No recent activity yet"
                  body="Important detections, changes, approvals, and follow-up will appear here as Solvren works."
                  page="home"
                  section="activity"
                />
              ) : (
                activity.map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.destination}
                    className="rounded-md border p-3 hover:bg-[var(--table-row-hover)]"
                    onClick={() =>
                      trackAppEvent("home_activity_open", {
                        user_id: userId,
                        org_id: orgId,
                        object_type: item.objectType,
                        object_id: item.id,
                        destination: item.destination,
                        position: index,
                      })
                    }
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-[var(--text-muted)]">{item.context ?? ""} · {item.relativeTime}</p>
                  </Link>
                ))
              )}
            </Stack>
          </CardBody>
        </Card>
      </Stack>

      <Stack gap={3}>
        <SectionHeader title="All capabilities" helper="Nothing is hidden. These links expose the deeper surfaces for operators, admins, and executives." />
        <Grid cols={1} gap={3} className="md:grid-cols-2 lg:grid-cols-3">
          {CAPABILITY_LINKS.map((dest, index) => (
            <Card key={dest.title} className="shadow-sm">
              <CardBody>
                <Stack gap={2}>
                  <p className="font-semibold">{dest.title}</p>
                  <p className="text-sm text-[var(--text-muted)]">{dest.body}</p>
                  <Button asChild variant="secondary" size="sm">
                    <Link
                      data-testid={`home-go-next-${dest.title.toLowerCase().replaceAll(" ", "-")}`}
                      href={dest.href}
                      onClick={() =>
                        trackAppEvent("home_go_next_click", {
                          user_id: userId,
                          org_id: orgId,
                          destination: dest.href,
                          position: index,
                        })
                      }
                    >
                      Open
                    </Link>
                  </Button>
                </Stack>
              </CardBody>
            </Card>
          ))}
        </Grid>
      </Stack>
    </Stack>
  );
}
