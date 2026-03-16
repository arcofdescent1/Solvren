"use client";

import { Button, Input, NativeSelect, PageHeader, Card, CardBody } from "@/ui";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { OnboardingWalkthrough } from "@/components/intake/OnboardingWalkthrough";

export default function NewChangePage() {
  const supabase = createClient();
  const router = useRouter();

  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) {
        router.push("/login");
        return;
      }

      const { data: memberships, error } = await supabase
        .from("organization_members")
        .select("org_id, organizations(id, name)");

      if (error) {
        setMsg(error.message);
        return;
      }

      type MemberRow = {
        org_id: string;
        organizations: { id: string; name: string } | { id: string; name: string }[] | null;
      };
      const mapped = (memberships || []).flatMap((m) => {
        const org = (m as MemberRow).organizations;
        if (!org) return [];
        return Array.isArray(org) ? org : [org];
      });
      setOrgs(mapped);
      if (mapped.length > 0) setOrgId(mapped[0].id);
      if (mapped.length === 0) router.push("/onboarding");
    })();
  }, [router, supabase]);

  async function startGuidedIntake(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/changes/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          title: title.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to create draft");
      }
      const changeId = (json as { changeId: string }).changeId;
      router.push(`/changes/${changeId}/intake?step=change-type`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to create draft");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Changes", href: "/changes" },
          { label: "New change" },
        ]}
        title="Create revenue change"
        description="Start the guided wizard. We’ll walk you through what’s changing, where, and what’s needed to get approval."
      />

      <OnboardingWalkthrough />

      {msg && (
        <Card className="border-[var(--danger)]/50 bg-[color-mix(in_oklab,var(--danger)_8%,var(--bg-surface))]">
          <CardBody>
            <p className="text-sm text-[var(--text)]">{msg}</p>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody>
          <form onSubmit={startGuidedIntake} className="space-y-5 max-w-md">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organization</label>
              <NativeSelect
                className="border rounded px-3 py-2 w-full"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </NativeSelect>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Title (optional)
              </label>
              <Input
                className="border rounded px-3 py-2 w-full"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Add annual plan + Stripe coupon logic"
              />
            </div>

            <Button data-testid="start-guided-intake" type="submit" disabled={loading || !orgId}>
              {loading ? "Starting…" : "Start the wizard"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
