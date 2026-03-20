"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Input, Button, Card, CardBody, PageHeader } from "@/ui";

const COMPANY_SIZE_OPTIONS = [
  { value: "", label: "Select size (optional)" },
  { value: "1_10", label: "1–10" },
  { value: "11_50", label: "11–50" },
  { value: "51_200", label: "51–200" },
  { value: "201_1000", label: "201–1,000" },
  { value: "1000_plus", label: "1,000+" },
];

const INDUSTRY_OPTIONS = [
  { value: "", label: "Select industry (optional)" },
  { value: "Software", label: "Software" },
  { value: "Finance", label: "Finance" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Retail", label: "Retail" },
  { value: "Manufacturing", label: "Manufacturing" },
  { value: "Other", label: "Other" },
];

/** Suggest organization name from email domain (e.g. david@acme.com → Acme). */
function suggestOrgNameFromEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  const at = trimmed.indexOf("@");
  if (at === -1) return "";
  const domain = trimmed.slice(at + 1);
  const base = domain.split(".")[0] ?? "";
  if (!base) return "";
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Enterprise registration — Step 2: Create your organization.
 * Shown after email verification when user has no org. Establishes org context.
 */
export default function SignupOrganizationPage() {
  const supabase = createClient();
  const router = useRouter();

  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [industry, setIndustry] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login?next=/signup/organization");
        return;
      }
      const confirmed = (user as { email_confirmed_at?: string | null }).email_confirmed_at;
      if (!confirmed) {
        router.replace("/auth/verify-pending");
        return;
      }
      setReady(true);
      const email = user.email ?? "";
      if (!orgName && email) {
        const suggested = suggestOrgNameFromEmail(email);
        if (suggested) setOrgName(suggested);
      }
    });
  }, [router, supabase.auth]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const nameTrimmed = orgName.trim();
    if (!nameTrimmed) {
      setMsg("Organization name is required.");
      return;
    }

    setLoading(true);

    const createRes = await fetch("/api/org/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameTrimmed,
        website: website.trim() || null,
        companySize: companySize || null,
        industry: industry || null,
      }),
    });

    const createJson = await createRes.json().catch(() => ({}));

    if (!createRes.ok) {
      setLoading(false);
      setMsg(createJson?.error ?? "Failed to create organization.");
      return;
    }

    const org = createJson.org;
    if (!org?.id) {
      setLoading(false);
      setMsg("Organization created but invalid response.");
      return;
    }

    try {
      await fetch("/api/org/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id }),
      });
    } catch {
      // Non-fatal; user can switch org later
    }

    try {
      const bootstrapRes = await fetch("/api/org/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: org.id }),
      });
      const j = await bootstrapRes.json();
      if (!j?.ok) setMsg(`Org created, but setup had an issue: ${j?.error ?? "unknown"}`);
    } catch {
      setMsg("Org created, but setup request failed.");
    } finally {
      setLoading(false);
    }

    router.push("/onboarding");
  }

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <PageHeader
          title="Create your organization"
          description="This is the company workspace where your team will manage revenue governance."
        />
        <Card className="border-white/10 bg-slate-900/50">
          <CardBody className="space-y-4">
            <form data-testid="signup-org-form" onSubmit={onSubmit} className="space-y-4">
              <Input
                data-testid="signup-org-name"
                placeholder="Organization name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
              />
              <Input
                placeholder="Company website (optional)"
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                autoComplete="url"
              />
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
              >
                {COMPANY_SIZE_OPTIONS.map((o) => (
                  <option key={o.value || "empty"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <select
                className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
              >
                {INDUSTRY_OPTIONS.map((o) => (
                  <option key={o.value || "empty"} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Button
                data-testid="signup-org-submit"
                type="submit"
                className="w-full"
                disabled={loading || !orgName.trim()}
              >
                {loading ? "Creating…" : "Create organization"}
              </Button>
              {msg && <p className="text-sm text-slate-400">{msg}</p>}
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
