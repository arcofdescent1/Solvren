"use client";

import { Button, Input, PageHeader, Card, CardBody } from "@/ui";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<"org" | "connect">("org");
  const [orgName, setOrgName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    createClient()
      .from("organization_members")
      .select("org_id")
      .limit(1)
      .then(({ data }) => {
        if (!cancelled && data?.length) setStep("connect");
      });
    return () => { cancelled = true; };
  }, []);

  async function createOrg(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    const res = await fetch("/api/org/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: orgName }),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setLoading(false);
      setMsg(json?.error ?? "Failed to create organization.");
      return;
    }

    const org = json.org;

    try {
      const bootstrapRes = await fetch("/api/org/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id }),
      });
      const j = await bootstrapRes.json();
      if (!j?.ok) setMsg(`Org created, but bootstrap failed: ${j?.error ?? "unknown"}`);
    } catch (e) {
      setMsg("Org created, but bootstrap request failed.");
    } finally {
      setLoading(false);
    }

    setStep("connect");
  }

  if (step === "connect") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-6">
        <div className="w-full max-w-2xl space-y-6">
          <PageHeader
            title="Connect Your First System"
            description="Solvren works best when connected to your revenue systems."
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Card className="border-[var(--primary)]/40 bg-[var(--primary)]/5">
              <CardBody className="flex flex-col gap-4">
                <h3 className="font-semibold text-lg">Jira</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Monitor issues, link changes, detect revenue risk.
                </p>
                <Link
                  href="/integrations/jira/setup"
                  className="inline-flex h-10 items-center justify-center rounded-md bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-contrast)] hover:opacity-90"
                >
                  Connect Jira
                </Link>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="flex flex-col gap-4">
                <h3 className="font-semibold text-lg">Slack</h3>
                <p className="text-sm text-[var(--text-muted)]">
                  Approvals and alerts in Slack.
                </p>
                <Link
                  href="/integrations"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-[var(--border)] px-4 text-sm font-semibold hover:bg-[var(--bg-surface-2)]"
                >
                  Connect Slack
                </Link>
              </CardBody>
            </Card>
            <Card className="opacity-75">
              <CardBody>
                <h3 className="font-semibold text-lg text-[var(--text-muted)]">Salesforce</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Coming Soon</p>
              </CardBody>
            </Card>
            <Card className="opacity-75">
              <CardBody>
                <h3 className="font-semibold text-lg text-[var(--text-muted)]">NetSuite</h3>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Coming Soon</p>
              </CardBody>
            </Card>
          </div>
          <Link href="/dashboard" className="block text-center text-sm text-[var(--primary)] hover:underline">
            Skip for now →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <PageHeader
          breadcrumbs={[{ label: "Onboarding" }]}
          title="Create your organization"
          description="Set up your first organization to get started."
        />
        <Card>
          <CardBody>
            <form onSubmit={createOrg} className="space-y-4">
              <Input
                placeholder="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !orgName}
              >
                {loading ? "Creating…" : "Continue"}
              </Button>
              {msg && <p className="text-sm text-[var(--text-muted)]">{msg}</p>}
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
