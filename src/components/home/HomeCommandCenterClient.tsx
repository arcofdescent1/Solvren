"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  Plug,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
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
import { PRODUCT_TERMS } from "@/config/productLanguage";
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
  roiSignalAsOf: string | null;
};

const ROLE_NAMES: Record<HomeRole, string> = {
  OWNER: "Executive owner",
  ADMIN: "Administrator",
  REVIEWER: "Reviewer",
  SUBMITTER: "Submitter",
  VIEWER: "Viewer",
};

const TOOL_LINKS = [
  { title: "Decisions", body: "Review changes, evidence, and approvals.", href: "/changes?view=all", icon: ClipboardCheck },
  { title: "Problems", body: "See revenue issues that need action.", href: "/issues", icon: TriangleAlert },
  { title: "Proof", body: "Show protected value and outcomes.", href: "/insights", icon: ShieldCheck },
  { title: "Setup", body: "Connect systems, people, and rules.", href: "/integrations", icon: Plug },
] as const;

function urgencyVariant(urgency: HomeWorkItem["urgency"]) {
  if (urgency === "critical") return "danger";
  if (urgency === "high") return "warning";
  return "secondary";
}

function statusText(item: HomeWorkItem) {
  if (item.overdue) return "Overdue";
  if (item.assignedToCurrentUser) return "Needs you";
  if (item.blocked) return "Blocked";
  if (item.highImpact) return "High impact";
  return "In progress";
}

function openLabel(item: HomeWorkItem) {
  if (item.objectType === "Issue") return "Open problem";
  if (item.objectType === "Change") return "Open decision";
  return "Open item";
}

function roiLabel(roiSignal: Props["roiSignal"]) {
  if (roiSignal === "improving") return "Improving";
  if (roiSignal === "needs_attention") return "Needs attention";
  return "Stable";
}

function roiSentence(roiSignal: Props["roiSignal"]) {
  if (roiSignal === "improving") return "Risk is trending down and Solvren has proof to show.";
  if (roiSignal === "needs_attention") return "The business needs attention before risk turns into loss.";
  return "The protection rhythm is steady.";
}

function WorkCard({
  item,
  eventName,
  position,
  userId,
  orgId,
}: {
  item: HomeWorkItem;
  eventName: string;
  position: number;
  userId: string;
  orgId: string | null;
}) {
  return (
    <Card className="h-full border-[var(--border)] shadow-sm transition hover:border-[var(--primary)]/35 hover:shadow-md">
      <CardBody>
        <Stack gap={3}>
          <Stack direction="row" justify="between" align="start" gap={3}>
            <div>
              <Badge variant={urgencyVariant(item.urgency)}>{statusText(item)}</Badge>
              <h3 className="mt-3 text-base font-semibold leading-snug text-[var(--text)]">{item.title}</h3>
            </div>
            <Badge variant="outline">{item.objectType === "Issue" ? "Problem" : item.objectType}</Badge>
          </Stack>
          <p className="text-sm leading-6 text-[var(--text-muted)]">{item.why}</p>
          <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Next best action</p>
            <p className="mt-1 text-sm font-medium text-[var(--text)]">{item.nextStep}</p>
          </div>
          <Button asChild variant="secondary" size="sm" className="w-fit">
            <Link
              href={item.destination}
              onClick={() =>
                trackAppEvent(eventName, {
                  user_id: userId,
                  org_id: orgId,
                  object_type: item.objectType,
                  object_id: item.id,
                  destination: item.destination,
                  position,
                })
              }
            >
              {openLabel(item)}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}

function MetricTile({
  label,
  value,
  body,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  body: string;
  tone: "primary" | "danger" | "warning" | "success";
  icon: typeof CircleDollarSign;
}) {
  const toneClass =
    tone === "danger"
      ? "bg-[var(--danger)]/10 text-[var(--danger)]"
      : tone === "warning"
        ? "bg-[var(--warning)]/15 text-[var(--warning)]"
        : tone === "success"
          ? "bg-[var(--success)]/10 text-[var(--success)]"
          : "bg-[var(--primary)]/10 text-[var(--primary)]";

  return (
    <Card className="h-full shadow-sm">
      <CardBody>
        <Stack gap={3}>
          <div className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] ${toneClass}`}>
            <Icon className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm text-[var(--text-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--text)]">{value}</p>
          </div>
          <p className="text-sm leading-6 text-[var(--text-muted)]">{body}</p>
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
  useEffect(() => {
    trackAppEvent("home_page_view", { user_id: userId, org_id: orgId, section: "home" });
  }, [userId, orgId]);

  const exposure = exposureLabel ?? "Learning from connected systems";
  const proofWindow = roiSignalAsOf ? `Updated ${new Date(roiSignalAsOf).toLocaleDateString()}` : "30-day view";

  return (
    <Stack gap={8}>
      <PageHeaderV2
        breadcrumbs={[{ label: "Home" }]}
        title={PRODUCT_TERMS.home.title}
        description="A simple view of the money at risk, the decisions that need action, and the proof that Solvren is protecting revenue."
        helper="Everyone sees the same product. Solvren only changes what it prioritizes first."
      />

      {showPhase2SuccessCard ? <Phase2ActivationSuccessCard /> : null}

      <section className="rounded-[var(--radius-xl)] border border-[var(--primary)]/20 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_8%,var(--bg-surface)),var(--bg-surface)_48%,color-mix(in_oklab,var(--success)_7%,var(--bg-surface)))] p-5 shadow-sm sm:p-7">
        <Stack gap={6}>
          <Stack direction="row" justify="between" gap={6} className="flex-wrap">
            <div className="max-w-3xl">
              <Badge variant="outline">{ROLE_NAMES[role]}</Badge>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight text-[var(--text)]">
                Protect revenue before a change, system issue, or missed decision turns into loss.
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-muted)]">
                Solvren watches revenue-critical work, tells the right people what to decide, and produces proof leaders can trust.
              </p>
            </div>
            <div className="min-w-[16rem] rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm">
              <p className="text-sm text-[var(--text-muted)]">Right now</p>
              <p className="mt-2 text-3xl font-semibold">{assigned.length + waiting.length}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">items need action or follow-up</p>
            </div>
          </Stack>

          <Grid cols={1} gap={3} className="md:grid-cols-2 xl:grid-cols-4">
            <MetricTile
              icon={CircleDollarSign}
              tone="danger"
              label="Revenue at risk"
              value={exposure}
              body="The current dollar exposure Solvren can see from connected systems."
            />
            <MetricTile
              icon={ClipboardCheck}
              tone="warning"
              label="Decisions waiting"
              value={roleStats.needsReviewCount}
              body="Approvals or change decisions that should not drift."
            />
            <MetricTile
              icon={TriangleAlert}
              tone="primary"
              label="Open problems"
              value={roleStats.openIssueCount}
              body="Known issues that may affect customers, revenue, or delivery."
            />
            <MetricTile
              icon={CheckCircle2}
              tone="success"
              label="Proof signal"
              value={roiLabel(roiSignal)}
              body={roiSentence(roiSignal)}
            />
          </Grid>

          <Stack direction="row" gap={2} className="flex-wrap">
            <Button asChild>
              <Link data-testid="home-hero-action-center" href="/actions">
                Review what needs attention
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/insights">
                See proof
                <ShieldCheck className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={setupIncomplete ? "/integrations" : "/changes?view=all"}>
                {setupIncomplete ? "Connect systems" : "Review decisions"}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          </Stack>
        </Stack>
      </section>

      <Stack gap={3}>
        <SectionHeader
          title="Today's focus"
          helper="The shortest path to protecting revenue today."
          action={
            <Button asChild variant="secondary" size="sm">
              <Link href="/actions">
                Open all
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          }
        />
        {priorities.length === 0 ? (
          <EmptyState
            variant="good_empty"
            title="No urgent work right now"
            body="Solvren will surface the next decision, problem, or follow-up as soon as it matters."
          />
        ) : (
          <Grid cols={1} gap={3} className="lg:grid-cols-3">
            {priorities.slice(0, 3).map((item, index) => (
              <WorkCard
                key={item.id}
                item={item}
                eventName="home_priority_open"
                position={index}
                userId={userId}
                orgId={orgId}
              />
            ))}
          </Grid>
        )}
      </Stack>

      <Grid cols={1} gap={4} className="xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="shadow-sm">
          <CardBody>
            <Stack gap={4}>
              <SectionHeader title="For you" helper="Your reviews, evidence, and follow-up in one place." />
              {assigned.length === 0 ? (
                <EmptyState
                  variant="good_empty"
                  title="Nothing is assigned to you"
                  body="You can step away from this queue until Solvren asks for your judgment."
                />
              ) : (
                <Stack gap={3}>
                  {assigned.slice(0, 4).map((item, index) => (
                    <WorkCard
                      key={item.id}
                      item={item}
                      eventName="home_assigned_open"
                      position={index}
                      userId={userId}
                      orgId={orgId}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardBody>
        </Card>

        <Card className="shadow-sm" id="waiting-on-others">
          <CardBody>
            <Stack gap={4}>
              <SectionHeader title="Waiting on others" helper="Items Solvren is tracking so they do not disappear." />
              {waiting.length === 0 ? (
                <EmptyState
                  variant="good_empty"
                  title="Nothing is blocked"
                  body="No major item is currently waiting on another person, team, or system."
                />
              ) : (
                <Stack gap={3}>
                  {waiting.slice(0, 4).map((item, index) => (
                    <WorkCard
                      key={item.id}
                      item={item}
                      eventName="home_waiting_open"
                      position={index}
                      userId={userId}
                      orgId={orgId}
                    />
                  ))}
                </Stack>
              )}
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Grid cols={1} gap={4} className="xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="shadow-sm">
          <CardBody>
            <Stack gap={4}>
              <SectionHeader title="Proof of protection" helper={`${proofWindow}. Plain proof that Solvren is reducing business risk.`} />
              <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-4">
                <Stack direction="row" justify="between" align="center" gap={3}>
                  <div>
                    <p className="text-sm text-[var(--text-muted)]">Protected value trend</p>
                    <p className="mt-1 text-xl font-semibold">{roiLabel(roiSignal)}</p>
                  </div>
                  <Badge variant={roiSignal === "improving" ? "success" : roiSignal === "stable" ? "secondary" : "warning"}>
                    {roiSentence(roiSignal)}
                  </Badge>
                </Stack>
              </div>
              <Grid cols={1} gap={3} className="md:grid-cols-3">
                {protectionCards.map((card) => (
                  <div key={card.label} className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface)] p-3">
                    <p className="text-xs text-[var(--text-muted)]">{card.label}</p>
                    <p className="mt-1 text-lg font-semibold">{card.value}</p>
                  </div>
                ))}
              </Grid>
              {exposureMetrics.length > 0 ? (
                <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4">
                  <p className="text-sm font-semibold">Current proof points</p>
                  <Grid cols={1} gap={3} className="mt-3 md:grid-cols-2">
                    {exposureMetrics.map((metric) => (
                      <div key={metric.label}>
                        <p className="text-xs text-[var(--text-muted)]">{metric.label}</p>
                        <p className="mt-1 text-base font-semibold">{metric.value}</p>
                      </div>
                    ))}
                  </Grid>
                </div>
              ) : null}
              <Button asChild variant="secondary" size="sm" className="w-fit">
                <Link href="/insights">
                  Open proof
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </Stack>
          </CardBody>
        </Card>

        <Card className="shadow-sm">
          <CardBody>
            <Stack gap={4}>
              <SectionHeader title="What Solvren protects" helper="Common business moments where revenue loss usually hides." />
              <Grid cols={1} gap={3} className="md:grid-cols-3">
                {REVENUE_PROTECTION_PLAYBOOKS.slice(0, 3).map((playbook) => (
                  <Link
                    key={playbook.key}
                    href={playbook.href}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface)]"
                  >
                    <p className="text-sm font-semibold text-[var(--text)]">{playbook.title}</p>
                    <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">{playbook.trigger}</p>
                  </Link>
                ))}
              </Grid>
            </Stack>
          </CardBody>
        </Card>
      </Grid>

      <Stack gap={3}>
        <SectionHeader title="Everything else" helper="Nothing is hidden. These are the same core tools, grouped by the job they help you finish." />
        <Grid cols={1} gap={3} className="md:grid-cols-2 xl:grid-cols-4">
          {TOOL_LINKS.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.title}
                href={tool.href}
                className="group rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-surface)] p-4 shadow-sm transition hover:border-[var(--primary)]/40 hover:shadow-md"
              >
                <Stack gap={3}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--bg-surface-2)] text-[var(--primary)]">
                    <Icon className="h-5 w-5" aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--text)] group-hover:text-[var(--primary)]">{tool.title}</p>
                    <p className="mt-1 text-sm leading-6 text-[var(--text-muted)]">{tool.body}</p>
                  </div>
                </Stack>
              </Link>
            );
          })}
        </Grid>
      </Stack>

      <Stack gap={3}>
        <SectionHeader title="Recent activity" helper="A short history of important decisions, problems, and follow-up." />
        <Card className="shadow-sm">
          <CardBody>
            {activity.length === 0 ? (
              <EmptyState
                variant="still_building"
                title="No recent activity yet"
                body="Important detections, decisions, and follow-up will appear here as Solvren works."
              />
            ) : (
              <Stack gap={2}>
                {activity.slice(0, 6).map((item, index) => (
                  <Link
                    key={item.id}
                    href={item.destination}
                    className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-surface-2)] p-3 transition hover:border-[var(--primary)]/40 hover:bg-[var(--bg-surface)]"
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
                    <Stack direction="row" justify="between" align="center" gap={3}>
                      <div>
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{item.context ?? "Activity"}</p>
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">{item.relativeTime}</span>
                    </Stack>
                  </Link>
                ))}
              </Stack>
            )}
          </CardBody>
        </Card>
      </Stack>

      {setupIncomplete ? (
        <Card className="border-[var(--warning)]/35 bg-[var(--warning)]/5 shadow-sm">
          <CardBody>
            <Stack direction="row" justify="between" align="center" gap={4} className="flex-wrap">
              <div className="max-w-2xl">
                <Stack direction="row" align="center" gap={2}>
                  <Plug className="h-5 w-5 text-[var(--warning)]" aria-hidden />
                  <h2 className="text-lg font-semibold">Connect systems to expand protection</h2>
                </Stack>
                <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">
                  Solvren gets more valuable as it watches CRM, billing, engineering, and support workflows together.
                </p>
              </div>
              <Button asChild>
                <Link href="/integrations">
                  Connect systems
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </Stack>
          </CardBody>
        </Card>
      ) : null}

    </Stack>
  );
}
