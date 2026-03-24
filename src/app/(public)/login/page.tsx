"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Input, Button, Card, CardBody, PageHeader } from "@/ui";
import { validatePassword, PASSWORD_MIN_LENGTH } from "@/lib/passwordPolicy";
import { getSafeAppRedirect } from "@/lib/auth/redirects";

type SsoOrg = {
  id: string;
  name: string;
  providers: Array<{ providerId: string; providerType: string; displayName?: string }>;
  enforceSso: boolean;
};

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ssoOrgs, setSsoOrgs] = useState<SsoOrg[]>([]);
  const [ssoRequired, setSsoRequired] = useState(false);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  const discoverSso = useCallback(async (e: string) => {
    const trimmed = e?.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setSsoOrgs([]);
      setSsoRequired(false);
      return;
    }
    setDiscoverLoading(true);
    try {
      const res = await fetch(`/api/auth/sso/discover?email=${encodeURIComponent(trimmed)}`);
      const data = await res.json();
      setSsoOrgs(data.organizations ?? []);
      setSsoRequired(data.requiresSso === true);
    } catch {
      setSsoOrgs([]);
      setSsoRequired(false);
    } finally {
      setDiscoverLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => discoverSso(email), 400);
    return () => clearTimeout(t);
  }, [email, discoverSso]);

  useEffect(() => {
    if (searchParams.get("reset") === "success") {
      setMsg("Your password has been reset. You can sign in now.");
      router.replace("/login", { scroll: false });
    }
    if (searchParams.get("mode") === "signup") {
      setMode("signup");
    }
  }, [searchParams, router]);

  async function startSso(organizationId: string, providerId: string, _protocol?: string) {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/sso/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, providerId, email: email.trim() || undefined }),
      });
      const data = await res.json();
      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }
      setMsg(data.error ?? "SSO start failed");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "SSO start failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (mode === "signup") {
      const v = validatePassword(password);
      if (!v.valid) {
        setMsg(v.message ?? "Password too weak");
        return;
      }
    }

    if (mode === "login") {
      const checkRes = await fetch("/api/auth/sso/check-local", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const checkData = await checkRes.json();
      if (checkData.allowed === false && checkData.ssoRequired === true) {
        setSsoRequired(true);
        setMsg("This organization requires sign-in with SSO. Use the option below.");
        if (checkData.organizations?.length && !ssoOrgs.length) {
          discoverSso(email);
        }
        return;
      }
    }

    setLoading(true);

    const emailRedirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

    const { error } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: { emailRedirectTo },
          });

    setLoading(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    const next = searchParams.get("next");
    const target = getSafeAppRedirect(next);

    if (mode === "login") {
      router.push(target);
    } else {
      router.push("/auth/verify-pending");
    }
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <PageHeader
          title={mode === "login" ? "Sign in" : "Create account"}
          description={
            mode === "login" ? "Sign in to Solvren" : "Create a new account"
          }
        />
        <Card className="border-white/10 bg-slate-900/50">
          <CardBody className="space-y-4">
            <form data-testid="login-form" onSubmit={onSubmit} className="space-y-4">
              <Input
                data-testid="login-email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
              <Input
                data-testid="login-password"
                placeholder="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={mode === "signup" ? PASSWORD_MIN_LENGTH : undefined}
              />
              {mode === "signup" && (
                <p className="text-xs text-slate-400">
                  At least {PASSWORD_MIN_LENGTH} characters
                </p>
              )}
              {mode === "login" && (
                <div className="text-right">
                  <Button asChild variant="link" className="p-0 text-sm">
                    <Link href="/auth/forgot-password">Forgot password?</Link>
                  </Button>
                </div>
              )}
              {mode === "login" && (ssoOrgs.length > 0 || ssoRequired) && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">
                    {ssoRequired ? "Your organization requires SSO to sign in." : "Sign in with your organization:"}
                  </p>
                  {discoverLoading && ssoOrgs.length === 0 ? (
                    <p className="text-sm text-slate-500">Loading SSO options…</p>
                  ) : ssoOrgs.length === 1 && ssoOrgs[0].providers.length === 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={loading || discoverLoading}
                      onClick={() =>
                        startSso(ssoOrgs[0].id, ssoOrgs[0].providers[0].providerId)
                      }
                    >
                      {loading ? "Redirecting..." : `Continue with ${ssoOrgs[0].providers[0].displayName ?? "SSO"}`}
                    </Button>
                  ) : (
                    ssoOrgs.map((org) =>
                      org.providers.map((prov) => (
                        <Button
                          key={`${org.id}-${prov.providerId}`}
                          type="button"
                          variant="outline"
                          className="w-full"
                          disabled={loading || discoverLoading}
                          onClick={() => startSso(org.id, prov.providerId)}
                        >
                          {loading ? "Redirecting..." : `${org.name} – ${prov.displayName ?? prov.providerType}`}
                        </Button>
                      ))
                    )
                  )}
                </div>
              )}
              <Button
                data-testid="login-submit"
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? "Working..." : mode === "login" ? "Login" : "Sign up"}
              </Button>
              <Button
                type="button"
                variant="link"
                className="w-full"
                onClick={() => {
                if (mode === "login") router.push("/signup");
                else setMode("login");
              }}
              >
                {mode === "login" ? "Need an account? Sign up" : "Have an account? Login"}
              </Button>
              {msg && <p className="text-sm text-slate-400">{msg}</p>}
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
