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
  | "license"
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
  "license",
  "diagnostics",
  "audit",
];

const TAB_LABEL: Record<TabKey, string> = {
  overview: "Overview",
  onboarding: "Onboarding & Setup",
  team_access: "Team & Access",
  integrations: "Integrations",
  billing: "Billing",
  license: "License & rollout",
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
    licenseView: boolean;
    licenseManage: boolean;
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

type LicenseState = {
  tier: string;
  status: string;
  protectedRevenueBand: string;
  contractStart: string | null;
  contractEnd: string | null;
  renewalDate: string | null;
  licensedBusinessUnits: number | null;
  licensedIntegrations: string[] | null;
  licensedDomains: string[] | null;
  includedAdminSeats: number | null;
  unlimitedExecutiveAccess: boolean;
  premiumModules: string[];
  implementationMode: string;
  accountManagerUserId: string | null;
  customerSuccessOwnerUserId: string | null;
  orderFormReference: string | null;
  commercialNotes: string | null;
  capabilities: Record<string, boolean>;
  source: string;
};

export function InternalAccountWorkspace({ orgId }: { orgId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");
  const tab: TabKey = isTabKey(rawTab) ? rawTab : "overview";

  const setTab = useCallback(
    (t: TabKey) => {
      const q = new URLSearchParams(searchParams.toString());
      q.set("tab", t);
      router.replace(`${pathname}?${q.toString()}`);
    },
    [router, pathname, searchParams]
  );

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
  const [license, setLicense] = useState<LicenseState | null>(null);
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

  const loadLicense = useCallback(async () => {
    const res = await fetch(`/api/internal/accounts/${orgId}/license`, { cache: "no-store" });
    if (res.ok) {
      const d = (await res.json()) as { license: LicenseState };
      setLicense(d.license);
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
  }, [session, tab, setTab]);

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
    if (tab === "license" && session?.tabs.license) void loadLicense();
  }, [tab, session?.tabs.license, loadLicense]);

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

  async function saveLicense() {
    if (!license) return;
    setMsg(null);
    const res = await fetch(`/api/internal/accounts/${orgId}/license`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(license),
    });
    const data = (await res.json().catch(() => ({}))) as { license?: LicenseState; error?: string };
    if (!res.ok || !data.license) {
      setMsg(data.error ?? "License update failed");
      return;
    }
    setLicense(data.license);
    await loadSummary();
    setMsg("License and rollout scope saved.");
  }

  function patchLicense(patch: Partial<LicenseState>) {
    setLicense((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  function listToText(items: string[] | null) {
    return (items ?? []).join(", ");
  }

  function textToList(value: string) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
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

      {tab === "license" && session?.tabs.license && (
        <Card className="p-4 space-y-4 text-sm">
          {!license ? (
            <p>Loading...</p>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Tier</span>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.tier} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ tier: e.target.value })}>
                    {["FREE", "TEAM", "BUSINESS", "ENTERPRISE", "STRATEGIC_ENTERPRISE"].map((tier) => <option key={tier} value={tier}>{tier}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Status</span>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.status} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ status: e.target.value })}>
                    {["ACTIVE", "TRIALING", "PAST_DUE", "INCOMPLETE", "CANCELED"].map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Protected revenue band</span>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.protectedRevenueBand} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ protectedRevenueBand: e.target.value })}>
                    {["UNSET", "UNDER_25M", "25M_100M", "100M_250M", "250M_1B", "1B_PLUS"].map((band) => <option key={band} value={band}>{band}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-4">
                {[
                  ["Contract start", "contractStart"],
                  ["Contract end", "contractEnd"],
                  ["Renewal date", "renewalDate"],
                ].map(([label, key]) => (
                  <label key={key} className="space-y-1">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <input
                      type="date"
                      className="w-full rounded-md border border-border bg-background px-3 py-2"
                      value={(license[key as "contractStart" | "contractEnd" | "renewalDate"] as string | null) ?? ""}
                      disabled={!session.permissions.licenseManage}
                      onChange={(e) => patchLicense({ [key]: e.target.value || null } as Partial<LicenseState>)}
                    />
                  </label>
                ))}
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Implementation mode</span>
                  <select className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.implementationMode} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ implementationMode: e.target.value })}>
                    {["SELF_SERVE", "GUIDED", "WHITE_GLOVE"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Licensed business units</span>
                  <input type="number" min={0} className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.licensedBusinessUnits ?? ""} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ licensedBusinessUnits: e.target.value ? Number(e.target.value) : null })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Included admin seats</span>
                  <input type="number" min={0} className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.includedAdminSeats ?? ""} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ includedAdminSeats: e.target.value ? Number(e.target.value) : null })} />
                </label>
                <label className="flex items-center gap-2 pt-6">
                  <input type="checkbox" checked={license.unlimitedExecutiveAccess} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ unlimitedExecutiveAccess: e.target.checked })} />
                  <span>Unlimited executive/viewer access</span>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Licensed integrations</span>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={listToText(license.licensedIntegrations)} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ licensedIntegrations: textToList(e.target.value) })} placeholder="stripe, salesforce, hubspot" />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Licensed domains</span>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={listToText(license.licensedDomains)} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ licensedDomains: textToList(e.target.value) })} placeholder="REVENUE, DATA, SECURITY" />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Premium modules</span>
                <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={listToText(license.premiumModules)} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ premiumModules: textToList(e.target.value) })} placeholder="ADVANCED_AI, BOARD_REPORTING, ADVANCED_SECURITY" />
              </label>

              <div className="grid gap-3 md:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Account manager user ID</span>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.accountManagerUserId ?? ""} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ accountManagerUserId: e.target.value || null })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Customer success owner user ID</span>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.customerSuccessOwnerUserId ?? ""} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ customerSuccessOwnerUserId: e.target.value || null })} />
                </label>
                <label className="space-y-1">
                  <span className="text-xs font-medium text-muted-foreground">Order form reference</span>
                  <input className="w-full rounded-md border border-border bg-background px-3 py-2" value={license.orderFormReference ?? ""} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ orderFormReference: e.target.value || null })} />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-medium text-muted-foreground">Commercial notes</span>
                <textarea className="min-h-24 w-full rounded-md border border-border bg-background px-3 py-2" value={license.commercialNotes ?? ""} disabled={!session.permissions.licenseManage} onChange={(e) => patchLicense({ commercialNotes: e.target.value || null })} />
              </label>

              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">Enabled capabilities</div>
                <div className="grid gap-2 md:grid-cols-3">
                  {Object.entries(license.capabilities).filter(([, enabled]) => enabled).map(([capability]) => (
                    <span key={capability} className="rounded-md border border-border bg-muted px-2 py-1 text-xs">{capability}</span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {session.permissions.licenseManage ? <Button type="button" onClick={() => void saveLicense()}>Save license & rollout</Button> : <p className="text-muted-foreground">View-only license access.</p>}
                <span className="text-xs text-muted-foreground">Source: {license.source}</span>
              </div>
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
