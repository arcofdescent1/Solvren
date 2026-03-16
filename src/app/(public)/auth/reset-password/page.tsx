"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Input, Button, Card, CardBody, PageHeader } from "@/ui";
import {
  validatePassword,
  validatePasswordMatch,
  PASSWORD_MIN_LENGTH,
} from "@/lib/passwordPolicy";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [hasValidSession, setHasValidSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const urlError = searchParams.get("error");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setHasValidSession(!!session);
    });
  }, [supabase.auth]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const v = validatePassword(password);
    if (!v.valid) {
      setError(v.message ?? "Invalid password");
      return;
    }
    const matchErr = validatePasswordMatch(password, confirmPassword);
    if (matchErr) {
      setError(matchErr);
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?reset=success");
  }

  if (hasValidSession === null && !urlError) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-md">
          <p className="text-sm text-slate-400">Loading…</p>
        </div>
      </div>
    );
  }

  if (!hasValidSession || urlError === "invalid") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <PageHeader
            title="Link invalid or expired"
            description="This password reset link doesn't work or was already used."
          />
          <Card>
            <CardBody className="space-y-4">
              <p className="text-sm text-slate-400">
                Reset links are one-time use and expire after a short time.
                Request a new link to try again.
              </p>
              <Link
                href="/auth/forgot-password"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-white px-4 py-2 text-sm font-medium text-slate-950 hover:brightness-95"
              >
                Request a new reset link
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
          title="Set new password"
          description="Choose a password you'll use to sign in."
        />
        <Card>
          <CardBody className="space-y-4">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <Input
                  placeholder="New password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={PASSWORD_MIN_LENGTH}
                />
                <p className="mt-1 text-xs text-slate-400">
                  At least {PASSWORD_MIN_LENGTH} characters
                </p>
              </div>
              <Input
                placeholder="Confirm password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={PASSWORD_MIN_LENGTH}
              />
              {error && (
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
