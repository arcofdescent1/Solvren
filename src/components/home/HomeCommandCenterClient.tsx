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
import type { HomeActivityItem, HomeExposureMetric, HomeProtectionCard, HomeWorkItem } from "@/features/home/presentation/types";
import { HELP_COPY } from "@/config/helpCopy";
import {
  EmptyStateHelp,
  MetricHelpTooltip,
  PageHelpDrawer,
  WhatHappensNextCallout,
  WhySurfacedText,
} from "@/components/help";
import { Phase2ActivationSuccessCard } from "@/components/home/Phase2ActivationSuccessCard";

type Props = {
  userId: string;
  orgId: string | null;
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
  useEffect(() => {
    trackAppEvent("home_page_view", { user_id: userId, org_id: orgId, section: "home" });
  }, [userId, orgId]);

  return (
    <Stack gap={6}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Home" }]}
        title="Home"
        description="Your revenue risk command center. See what needs attention, what is assigned to you, what is blocked, and where Solvren is protecting the business."
        helper="Solvren helps your team detect revenue-impacting issues, govern risky changes, and coordinate action before problems become losses."
        helpTrigger={<PageHelpDrawer page="home" />}
      />

      {showPhase2SuccessCard ? <Phase2ActivationSuccessCard /> : null}

      <Card className="border-[var(--primary)]/25 bg-[color:color-mix(in_oklab,var(--primary)_6%,white)] shadow-sm">
        <CardBody>
          <Stack gap={3}>
            <h2 className="text-lg font-semibold">What Solvren is protecting right now</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Solvren continuously monitors revenue-impacting issues and changes across your systems so your team can catch risk early, act quickly, and verify outcomes.
            </p>
            <Stack direction="row" gap={2} className="flex-wrap text-sm">
              <Badge variant="secondary">Detect issues earlier</Badge>
              <Badge variant="secondary">Review risky changes before damage spreads</Badge>
              <Badge variant="secondary">Coordinate action with clear ownership</Badge>
            </Stack>
            <Stack direction="row" gap={2} className="flex-wrap">
              <Button asChild>
                <Link data-testid="home-hero-action-center" href="/actions">
                  View Action Center
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link data-testid="home-hero-changes" href="/changes?view=all">
                  See Changes in flight
                </Link>
              </Button>
            </Stack>
          </Stack>
        </CardBody>
      </Card>

      <Stack gap={3}>
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
        <SectionHeader title="Revenue at risk" helper={HELP_COPY.sections.revenue_at_risk} />
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
                <Link href="/insights">See Insights</Link>
              </Button>
            </Stack>
          </CardBody>
        </Card>
      </Stack>

      <Stack gap={3}>
        <SectionHeader
          title="Impact signal"
          helper="Same 30d ROI trend as Insights (active organization), from the shared ROI summary model."
        />
        <Card className="shadow-sm">
          <CardBody>
            <Stack direction="row" justify="between" align="center">
              <p className="text-sm">
                {roiSignal === "improving"
                  ? "Risk and operational outcomes are trending in the right direction."
                  : roiSignal === "stable"
                    ? "Outcomes are stable; continue current governance and response rhythm."
                    : "Outcomes need attention due to rising risk or overdue follow-up."}
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
        <SectionHeader title="Go next" helper={HELP_COPY.sections.go_next} />
        <Grid cols={1} gap={3} className="md:grid-cols-2 lg:grid-cols-4">
          {[
            { title: "Issues", body: "Investigate detected problems", href: "/issues" },
            { title: "Changes", body: "Review changes in flight", href: "/changes?view=all" },
            { title: "Action Center", body: "See everything needing action", href: "/actions" },
            { title: "Insights", body: "Understand exposure and outcomes", href: "/insights" },
          ].map((dest, index) => (
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
