"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, PageHeader } from "@/ui";

export default function VerifyErrorPage() {
  const supabase = createClient();
  const router = useRouter();

  async function resend() {
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    if (res.ok) {
      router.push("/auth/verify-pending");
    }
  }

  function toLogin() {
    router.push("/login");
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <PageHeader
          title="Link invalid or expired"
          description="This verification link doesn't work or was already used."
        />
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              Verification links are single-use and expire after a short time. If
              you still need to verify your email, we can send a new link.
            </p>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" onClick={resend}>
                Resend verification email
              </Button>
              <Button type="button" variant="link" onClick={toLogin}>
                Back to sign in
              </Button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
