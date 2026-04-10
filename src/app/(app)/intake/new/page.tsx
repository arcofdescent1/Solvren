"use client";

import { Button, Input, NativeSelect, PageHeader, Card, CardBody } from "@/ui";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

type AdoptionMode = "NATIVE_FIRST" | "MANUAL_FIRST" | "HYBRID" | null;

export default function IntakeNewPage() {
  const supabase = createClient();
  const router = useRouter();

  const [orgs, setOrgs] = useState<{ id: string; name: string }[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [adoptionMode, setAdoptionMode] = useState<AdoptionMode>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState("MEDIUM");
  const [intakeType, setIntakeType] = useState("CHANGE_REQUEST");
  const [submitMode, setSubmitMode] = useState<"DRAFT" | "ACTIVE">("DRAFT");
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

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      const res = await fetch(`/api/org/settings?orgId=${encodeURIComponent(orgId)}`);
      const j = (await res.json().catch(() => ({}))) as {
        settings?: { intake?: { adoptionMode?: AdoptionMode } };
      };
      const mode = j.settings?.intake?.adoptionMode ?? null;
      setAdoptionMode(mode ?? "HYBRID");
    })();
  }, [orgId]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId,
          title: title.trim(),
          description: description.trim() || undefined,
          severity,
          intakeRecordType: intakeType,
          submitMode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to create intake");
      }
      const changeId = (json as { changeEventId: string }).changeEventId;
      router.push(`/changes/${changeId}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function startGuidedFromTemplate() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/changes/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId, title: title.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error((json as { error?: string }).error ?? "Failed to create draft");
      }
      const changeId = (json as { changeId: string }).changeId;
      router.push(`/changes/${changeId}/intake?step=change-type`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const showHub = adoptionMode === "HYBRID" || adoptionMode === null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Overview", href: "/dashboard" },
          { label: "New intake" },
        ]}
        title="New intake"
        description="Create a change from manual details, a spreadsheet, or the guided flow."
      />

      {showHub && (
        <Card>
          <CardBody className="space-y-3">
            <p className="text-sm font-semibold">Choose a source</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/imports/new")}>
                Spreadsheet import
              </Button>
              <Button
                type="button"
                variant="secondary"
                data-testid="start-guided-intake"
                onClick={startGuidedFromTemplate}
                disabled={loading}
              >
                Guided intake
              </Button>
            </div>
            <p className="text-xs text-[var(--text-muted)]">
              Native integrations continue to create changes from connected systems automatically.
            </p>
          </CardBody>
        </Card>
      )}

      {adoptionMode === "NATIVE_FIRST" && (
        <Card>
          <CardBody className="space-y-2 text-sm text-[var(--text-muted)]">
            <p>
              Your organization prefers connected systems. New items usually arrive from integrations you have
              enabled.
            </p>
            <Link href="/org/settings/integrations" className="font-semibold text-[var(--primary)] hover:underline">
              Integration settings
            </Link>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">Manual intake</div>
            {!showHub && (
              <Button
                type="button"
                variant="secondary"
                data-testid="start-guided-intake"
                onClick={startGuidedFromTemplate}
                disabled={loading}
              >
                Guided intake
              </Button>
            )}
          </div>
          <form className="space-y-4" onSubmit={submitManual}>
            {orgs.length > 1 && (
              <label className="block space-y-1 text-sm">
                <span>Organization</span>
                <NativeSelect value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            <label className="block space-y-1 text-sm">
              <span>Title</span>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short title (e.g. annual plan migration)"
                required
                maxLength={500}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span>Description</span>
              <textarea
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] p-2 text-sm"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-1 text-sm">
                <span>Record type</span>
                <NativeSelect value={intakeType} onChange={(e) => setIntakeType(e.target.value)}>
                  <option value="CHANGE_REQUEST">Change request</option>
                  <option value="OPERATIONAL_RISK">Operational risk</option>
                  <option value="READINESS_CONCERN">Readiness concern</option>
                  <option value="DEPLOYMENT_BLOCKER">Deployment blocker</option>
                  <option value="OTHER">Other</option>
                </NativeSelect>
              </label>
              <label className="block space-y-1 text-sm">
                <span>Severity</span>
                <NativeSelect value={severity} onChange={(e) => setSeverity(e.target.value)}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical</option>
                </NativeSelect>
              </label>
            </div>
            <label className="block space-y-1 text-sm">
              <span>Submit mode</span>
              <NativeSelect
                value={submitMode}
                onChange={(e) => setSubmitMode(e.target.value as "DRAFT" | "ACTIVE")}
              >
                <option value="DRAFT">Save as draft</option>
                <option value="ACTIVE">Submit for review now</option>
              </NativeSelect>
            </label>
            {msg && <p className="text-sm text-red-600">{msg}</p>}
            <Button type="submit" disabled={loading || !orgId}>
              {loading ? "Working…" : "Create intake"}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
