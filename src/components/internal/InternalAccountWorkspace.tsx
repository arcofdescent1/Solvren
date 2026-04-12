/* eslint-disable react-hooks/set-state-in-effect -- tabbed workspace loads internal APIs on mount / tab changes */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/ui/layout/page-header";
import { Stack } from "@/ui/layout/stack";
import { Button } from "@/ui/primitives/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/ui/primitives/table";
import { Card } from "@/ui/primitives/card";

type TabKey =
  | "overview"
  | "onboarding"
  | "team_access"
  | "integrations"
  | "billing"
  | "diagnostics"
  | "audit";

type InviteRow = {
  inviteId: string;
  email: string;
  role: string;
  invitedAt: string;
  invitedByUserId: string | null;
  invitedByEmail: string | null;
  status: string;
};

const TAB_ORDER: TabKey[] = [
  "overview",
  "onboarding",
  "team_access",
  "integrations",
  "billing",
  "diagnostics",
  "audit",
];

const TAB_LABEL: Record<TabKey, string> = {
  overview: "Overview",
  onboarding: "Onboarding & Setup",
  team_access: "Team & Access",
  integrations: "Integrations",
  billing: "Billing",
  diagnostics: "Diagnostics",
  audit: "Audit",
};

function isTabKey(v: string | null): v is TabKey {
  return v != null && TAB_ORDER.includes(v as TabKey);
}

type SessionState = {
  tabs: Record<TabKey, boolean>;
  permissions: {
    billingView: boolean;
    billingManage: boolean;
    teamManage: boolean;
    onboardingView: boolean;
    onboardingManage: boolean;
    onboardingOverride: boolean;
    integrationsView: boolean;
    integrationsManage: boolean;
    diagnosticsView: boolean;
    diagnosticsRemediate: boolean;
    integrationDisableEnable: boolean;
  };
};

export function InternalAccountWorkspace({ orgId }: { orgId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabKey = isTabKey(rawTab) ? rawTab : "overview";

  const setTab = (t: TabKey) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", t);
    router.replace(`${pathname}?${q.toString()}`);
  };

  const [session, setSession] = useState<SessionState | null>(null);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [onboarding, setOnboarding] = useState<Record<string, unknown> | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, unknown> | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [members, setMembers] = useState<
    { userId: string; email: string | null; fullName: string | null; role: string; joinedAt: string }[]
  >([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [billing, setBilling] = useState<{
    plan: string;
    billingStatus: string;
    portalEligible: boolean;
    currentPeriodEnd: string | null;
  } | null>(null);
  const [audit, setAudit] = useState<{ items: Record<string, unknown>[]; total: number }>({ items: [], total: 0 });
  const [auditPage, setAuditPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadSession = useCallback(async () => {
    const res = await fetch("/api/internal/session", { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as SessionState;
    setSession(d);
  }, []);

  const loadSummary = useCallback(async () => {
    const res = await fetch(`/api/internal/accounts/${orgId}/summary`, { cache: "no-store" });
    if (res.ok) setSummary((await res.json()) as Record<string, unknown>);
  }, [orgId]);

  const loadOnboarding = useCallback(async () => {
    const res = await fetch(`/api/internal/accounts/${orgId}/onboarding`, { cache: "no-store" });
    if (res.ok) setOnboarding((await res.json()) as Record<string, unknown>);
  }, [orgId]);

  const loadIntegrations = useCallback(async () => {
    const res = await fetch(`/api/internal/accounts/${orgId}/integrations`, { cache: "no-store" });
    if (res.ok) setIntegrations((await res.json()) as Record<string, unknown>);
  }, [orgId]);

  const loadDiagnostics = useCallback(async () => {
    const res = await fetch(`/api/internal/accounts/${orgId}/diagnostics`, { cache: "no-store" });
    if (res.ok) setDiagnostics((await res.json()) as Record<string, unknown>);
  }, [orgId]);

  const loadTeam = useCallback(async () => {
    const [m, i] = await Promise.all([
      fetch(`/api/internal/accounts/${orgId}/members`, { cache: "no-store" }),
      fetch(`/api/internal/accounts/${orgId}/invites`, { cache: "no-store" }),
    ]);
    if (m.ok) {
      const d = (await m.json()) as {
        members: { userId: string; email: string | null; fullName: string | null; role: string; joinedAt: string }[];
      };
      setMembers(d.members);
    }
    if (i.ok) {
      const d = (await i.json()) as { invites: InviteRow[] };
      setInvites(d.invites);
    }
  }, [orgId]);

  const loadBilling = useCallback(async () => {
    const res = await fetch(`/api/internal/accounts/${orgId}/billing`, { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as typeof billing;
      setBilling(d);
    }
  }, [orgId]);

  const loadAudit = useCallback(async () => {
    const res = await fetch(`/api/internal/accounts/${orgId}/audit?page=${auditPage}&pageSize=25`, { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { items: Record<string, unknown>[]; total: number };
      setAudit(d);
    }
  }, [orgId, auditPage]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!session) return;
    if (!session.tabs[tab]) {
      setTab("overview");
    }
  }, [session, tab]);

  useEffect(() => {
    setLoading(true);
    void (async () => {
      await loadSummary();
      setLoading(false);
    })();
  }, [loadSummary]);

  useEffect(() => {
    if (tab === "onboarding" && session?.tabs.onboarding) void loadOnboarding();
  }, [tab, session?.tabs.onboarding, loadOnboarding]);

  useEffect(() => {
    if (tab === "integrations" && session?.tabs.integrations) void loadIntegrations();
  }, [tab, session?.tabs.integrations, loadIntegrations]);

  useEffect(() => {
    if (tab === "diagnostics" && session?.tabs.diagnostics) void loadDiagnostics();
  }, [tab, session?.tabs.diagnostics, loadDiagnostics]);

  useEffect(() => {
    if (tab === "team_access" && session?.tabs.team_access) void loadTeam();
  }, [tab, session?.tabs.team_access, loadTeam]);

  useEffect(() => {
    if (tab === "billing" && session?.tabs.billing) void loadBilling();
  }, [tab, session?.tabs.billing, loadBilling]);

  useEffect(() => {
    if (tab === "audit" && session?.tabs.audit) void loadAudit();
  }, [tab, session?.tabs.audit, loadAudit]);

  const title = useMemo(() => (summary?.name as string) ?? "Account", [summary]);

  async function openPortal() {
    setMsg(null);
    const res = await fetch(`/api/internal/accounts/${orgId}/billing/portal`, { method: "POST" });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok) {
      setMsg(data.error ?? "Portal request failed");
      return;
    }
    if (data.url) window.location.href = data.url;
  }

  async function refreshOnboarding() {
    setMsg(null);
    const res = await fetch(`/api/internal/accounts/${orgId}/onboarding/refresh`, { method: "POST" });
    if (!res.ok) {
      setMsg("Refresh failed");
      return;
    }
    await loadOnboarding();
  }

  const visibleTabs = session ? TAB_ORDER.filter((t) => session.tabs[t]) : TAB_ORDER;

  return (
    <Stack gap={6}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={title}
          description={summary?.slug ? String(summary.slug) : undefined}
          breadcrumbs={[
            { label: "Accounts", href: "/internal/accounts" },
            { label: title },
          ]}
        />
        <Button asChild variant="outline" size="sm">
          <Link href="/internal/accounts">Back</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {visibleTabs.map((t) => (
          <Button key={t} type="button" size="sm" variant={tab === t ? "default" : "ghost"} onClick={() => setTab(t)}>
            {TAB_LABEL[t]}
          </Button>
        ))}
      </div>

      {msg ? <p className="text-sm text-red-600">{msg}</p> : null}

      {tab === "overview" && (
        <Card className="p-4 space-y-2 text-sm">
          {loading || !summary ? (
            <p>Loading…</p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <dt className="text-muted-foreground">Plan</dt>
                <dd className="font-medium">{String(summary.plan)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Billing status</dt>
                <dd className="font-medium">{summary.billingStatus != null ? String(summary.billingStatus) : "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Onboarding phase</dt>
                <dd className="font-medium">{String(summary.onboardingPhaseSummary)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Last activity</dt>
                <dd className="font-medium">{new Date(String(summary.lastActivityAt)).toLocaleString()}</dd>
              </div>
            </dl>
          )}
        </Card>
      )}

      {tab === "onboarding" && session?.tabs.onboarding && (
        <Stack gap={4}>
          <div className="flex gap-2">
            {session.permissions.onboardingManage ? (
              <Button type="button" size="sm" onClick={() => void refreshOnboarding()}>
                Refresh onboarding state
              </Button>
            ) : null}
          </div>
          {!onboarding ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <Card className="p-4 text-sm space-y-3">
              <div>
                <strong>{String(onboarding.onboardingPhaseSummary)}</strong> · {String(onboarding.percentComplete)}%
              </div>
              <div className="text-muted-foreground">Current step: {String(onboarding.currentStepLabel)}</div>
              <div className="font-medium mt-2">Blockers</div>
              <ul className="list-disc pl-5">
                {((onboarding.blockers as { code: string; label: string }[]) ?? []).map((b) => (
                  <li key={b.code}>{b.label}</li>
                ))}
              </ul>
              <div className="font-medium mt-2">Checklist</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((onboarding.items as { key: string; label: string; status: string; mode: string }[]) ?? []).map((it) => (
                    <TableRow key={it.key}>
                      <TableCell>{it.label}</TableCell>
                      <TableCell>{it.status}</TableCell>
                      <TableCell>{it.mode}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </Stack>
      )}

      {tab === "team_access" && session?.tabs.team_access && (
        <Stack gap={6}>
          <section>
            <h2 className="text-lg font-semibold mb-2">Accepted members</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email / name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      <div className="font-medium">{m.email ?? m.userId}</div>
                      {m.fullName ? <div className="text-xs text-muted-foreground">{m.fullName}</div> : null}
                    </TableCell>
                    <TableCell>{m.role}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(m.joinedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
          <section>
            <h2 className="text-lg font-semibold mb-2">Invites</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Invited</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv.inviteId}>
                    <TableCell>{inv.email}</TableCell>
                    <TableCell>{inv.role}</TableCell>
                    <TableCell>{inv.status}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{new Date(inv.invitedAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </Stack>
      )}

      {tab === "integrations" && session?.tabs.integrations && (
        <Card className="p-4 text-sm">
          {!integrations ? (
            <p>Loading…</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Connection</TableHead>
                  <TableHead>Sync</TableHead>
                  <TableHead>Health</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {((integrations.items as Record<string, unknown>[]) ?? []).map((row) => (
                  <TableRow key={String(row.integrationId)}>
                    <TableCell>{String(row.provider)}</TableCell>
                    <TableCell>{String(row.connectionStatus)}</TableCell>
                    <TableCell>{String(row.syncStatus)}</TableCell>
                    <TableCell>{String(row.healthRollup)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      )}

      {tab === "billing" && session?.tabs.billing && (
        <Card className="p-4 space-y-3 text-sm">
          {!billing ? (
            <p>Loading…</p>
          ) : (
            <>
              <div>
                Plan: <strong>{billing.plan}</strong>
              </div>
              <div>
                Status: <strong>{billing.billingStatus}</strong>
              </div>
              <div>Portal eligible: {billing.portalEligible ? "yes" : "no"}</div>
              {session.permissions.billingManage && billing.portalEligible ? (
                <Button type="button" onClick={() => void openPortal()}>
                  Open Stripe billing portal
                </Button>
              ) : session.permissions.billingManage && !billing.portalEligible ? (
                <p className="text-muted-foreground">Billing portal is not available for this account.</p>
              ) : (
                <p className="text-muted-foreground">View-only billing access.</p>
              )}
            </>
          )}
        </Card>
      )}

      {tab === "diagnostics" && session?.tabs.diagnostics && (
        <Card className="p-4 text-sm space-y-2">
          {!diagnostics ? (
            <p>Loading…</p>
          ) : (
            <pre className="text-xs overflow-auto max-h-[480px]">{JSON.stringify(diagnostics.summary, null, 2)}</pre>
          )}
        </Card>
      )}

      {tab === "audit" && session?.tabs.audit && (
        <Stack gap={3}>
          <div className="flex gap-2 items-center">
            <Button type="button" size="sm" variant="outline" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>
              Prev
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={auditPage * 25 >= audit.total}
              onClick={() => setAuditPage((p) => p + 1)}
            >
              Next
            </Button>
            <span className="text-xs text-muted-foreground">{audit.total} events</span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Target</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit.items.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell className="text-xs whitespace-nowrap">
                    {new Date(String(row.createdAt)).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs">{String(row.action)}</TableCell>
                  <TableCell className="text-xs">{String(row.employeeEmail)}</TableCell>
                  <TableCell className="text-xs">
                    {String(row.targetType)}
                    {row.targetId ? ` · ${String(row.targetId)}` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Stack>
      )}
    </Stack>
  );
}
