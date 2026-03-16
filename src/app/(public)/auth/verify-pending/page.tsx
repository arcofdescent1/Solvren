"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, PageHeader } from "@/ui";

export default function VerifyPendingPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState<string | null>(null);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace("/login");
        return;
      }
      setEmail(user.email ?? null);
    });
  }, [router, supabase.auth]);

  async function resend() {
    setResendMsg(null);
    setResendLoading(true);
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setResendLoading(false);
    if (res.ok) {
      setResendMsg("Verification email sent. Check your inbox.");
    } else {
      setResendMsg((json as { error?: string })?.error ?? "Failed to resend.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <PageHeader
          title="Verify your email"
          description="Check your inbox to activate your account."
        />
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              We sent a verification link to{" "}
              {email != null ? (
                <strong className="text-[var(--text)]">{email}</strong>
              ) : (
                "your email"
              )}
              . Click the link in that email to continue.
            </p>
            <p className="text-sm text-[var(--text-muted)]">
              If you don&apos;t see it, check spam or wait a minute and resend.
            </p>
            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={resend}
                disabled={resendLoading}
              >
                {resendLoading ? "Sending…" : "Resend verification email"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="text-[var(--text-muted)]"
                onClick={logout}
              >
                Sign out
              </Button>
            </div>
            {resendMsg != null && (
              <p className="text-sm text-[var(--text-muted)]">{resendMsg}</p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
