"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input, Button, Card, CardBody, PageHeader } from "@/ui";
import { validatePassword, PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";

/**
 * Enterprise registration — Step 1: Create your account.
 * Collects full name, work email, password. Next step is organization creation.
 */
export default function SignupPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = searchParams.get("next");
    if (next && next.startsWith("/invite/")) {
      // Preserve invite flow
    }
  }, [searchParams]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const nameTrimmed = fullName.trim();
    if (!nameTrimmed || nameTrimmed.length < 2) {
      setMsg("Please enter your full name.");
      return;
    }

    const v = validatePassword(password);
    if (!v.valid) {
      setMsg(v.message ?? "Password too weak");
      return;
    }

    setLoading(true);

    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

    const { error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: { full_name: nameTrimmed },
        emailRedirectTo,
      },
    });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    const next = searchParams.get("next");
    const invitePath = next && (next === "/invite/accept" || next.startsWith("/invite/accept?"));
    if (invitePath && next) {
      router.push(next);
      return;
    }
    router.push("/auth/verify-pending");
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <PageHeader
          title="Create your account"
          description="You'll create your organization next."
        />
        <Card className="border-white/10 bg-slate-900/50">
          <CardBody className="space-y-4">
            <form data-testid="signup-form" onSubmit={onSubmit} className="space-y-4">
              <Input
                data-testid="signup-full-name"
                placeholder="Full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
              <Input
                data-testid="signup-email"
                placeholder="Work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                data-testid="signup-password"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
              />
              <p className="text-xs text-slate-400">
                At least {PASSWORD_MIN_LENGTH} characters
              </p>
              <Button data-testid="signup-submit" type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Continue"}
              </Button>
              <p className="text-center text-sm text-slate-400">
                Already have an account?{" "}
                <Link href="/login" className="text-[var(--primary)] hover:underline">
                  Sign in
                </Link>
              </p>
              {msg && <p className="text-sm text-slate-400">{msg}</p>}
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
