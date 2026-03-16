"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Input, Button, Card, CardBody, PageHeader } from "@/ui";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectTo =
      typeof window !== "undefined"
        ? `${window.location.origin}/auth/reset-password`
        : "";
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: redirectTo || undefined,
    });
    setLoading(false);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <PageHeader
            title="Check your email"
            description="If an account exists for that email, we've sent a password reset link."
          />
          <Card>
            <CardBody className="space-y-4">
              <p className="text-sm text-slate-400">
                The link will expire after a short time. If you don&apos;t see it,
                check spam or try again.
              </p>
              <Link
                href="/auth/forgot-password"
                className="inline-flex h-10 w-full items-center justify-center rounded-md border border-white/15 px-4 py-2 text-sm font-medium text-white hover:bg-white/5"
              >
                Send another link
              </Link>
              <Link href="/login">
                <span className="inline-flex h-10 w-full items-center justify-center text-sm font-medium text-cyan-300 underline hover:text-cyan-200">
                  Back to sign in
                </span>
              </Link>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-4">
        <PageHeader
          title="Forgot password?"
          description="Enter your email and we'll send a reset link."
        />
        <Card>
          <CardBody className="space-y-4">
            <form onSubmit={onSubmit} className="space-y-4">
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Sending…" : "Send reset link"}
              </Button>
              <Link href="/login">
                <span className="inline-flex h-10 w-full items-center justify-center text-sm font-medium text-cyan-300 underline hover:text-cyan-200">
                  Back to sign in
                </span>
              </Link>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
