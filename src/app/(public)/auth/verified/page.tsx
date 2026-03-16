"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, PageHeader } from "@/ui";

export default function VerifiedPage() {
  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      const confirmed = (user as { email_confirmed_at?: string | null }).email_confirmed_at;
      if (!confirmed) {
        router.replace("/auth/verify-pending");
      }
    });
  }, [router, supabase.auth]);

  function continueToApp() {
    router.push("/dashboard");
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
