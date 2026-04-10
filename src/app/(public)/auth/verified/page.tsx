"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, PageHeader } from "@/ui";

export default function VerifiedPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const confirmed = (user as { email_confirmed_at?: string | null }).email_confirmed_at;
      if (!confirmed) {
        router.replace("/auth/verify-pending");
        return;
      }
      supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", user.id)
        .limit(1)
        .then(({ data }) => {
          if (!data?.length) {
            router.replace("/signup/organization");
            return;
          }
          setChecked(true);
        });
    });
  }, [router, supabase]);

  function continueToApp() {
    router.push("/dashboard");
  }

  if (!checked) {
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
          title="Email verified"
          description="Your account is active. You can continue to Solvren."
        />
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              Your email was successfully verified. You can now create
              organizations, submit changes, and use all product features.
            </p>
            <Button type="button" onClick={continueToApp} className="w-full">
              Continue to Solvren
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
