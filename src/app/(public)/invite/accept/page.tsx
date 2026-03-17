"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, CardBody, PageHeader } from "@/ui";

type LookupState =
  | { status: "loading" }
  | { status: "invalid"; message: string }
  | { status: "valid"; orgName: string; role: string; email: string }
  | { status: "accepted"; orgId: string };

export default function InviteAcceptPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const supabase = createClient();

  const [lookup, setLookup] = useState<LookupState>({ status: "loading" });
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token || token.length < 16) {
      setLookup({ status: "invalid", message: "Invalid or missing invitation link." });
      return;
    }

    fetch(`/api/org/invites/lookup?token=${encodeURIComponent(token)}`)
      .then((res) => {
        if (res.ok) return res.json();
        return res.json().then((j) => Promise.reject(j));
      })
      .then((data) => {
        setLookup({
          status: "valid",
          orgName: data.orgName,
          role: data.role,
          email: data.email,
        });
      })
      .catch((err) => {
        setLookup({
          status: "invalid",
          message: err?.error ?? "This invitation is invalid or has expired.",
        });
      });
  }, [token]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, [supabase.auth]);

  async function accept() {
    if (!token || lookup.status !== "valid") return;
    setAccepting(true);
    const res = await fetch("/api/org/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      setLookup({ status: "accepted", orgId: data.orgId });
      router.push("/dashboard");
      return;
    }

    if (res.status === 403 && (data as { error?: string }).error === "email_mismatch") {
      setLookup({
        status: "invalid",
        message: `This invite was sent to ${(data as { inviteEmail?: string }).inviteEmail ?? "another email"}. Sign in with that email to accept.`,
      });
    } else {
      setLookup({
        status: "invalid",
        message: (data as { error?: string }).error ?? "Failed to accept invitation.",
      });
    }
    setAccepting(false);
  }

  if (lookup.status === "loading") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <p className="text-sm text-[var(--text-muted)]">Loading invitation…</p>
      </div>
    );
  }

  if (lookup.status === "invalid") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <PageHeader
            title="Invitation unavailable"
            description={lookup.message}
          />
          <Card>
            <CardBody className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                The link may have expired or already been used. Ask your admin to send a new invite.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  if (lookup.status === "accepted") {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <PageHeader title="You're in" description="You've joined the organization." />
          <Card>
            <CardBody>
              <Button asChild className="w-full">
                <Link href="/dashboard">Continue to dashboard</Link>
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  const { orgName, role, email } = lookup;
  const roleLabel =
    role === "owner"
      ? "Owner"
      : role === "admin"
        ? "Admin"
        : role === "reviewer"
          ? "Reviewer"
          : role === "submitter"
            ? "Submitter"
            : "Viewer";

  if (!userEmail) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <PageHeader
            title="Join the team"
            description={`You've been invited to join ${orgName} as a ${roleLabel}.`}
          />
          <Card>
            <CardBody className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                Sign in or create an account with <strong>{email}</strong> to accept this invitation.
              </p>
              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link href={`/login?next=${encodeURIComponent(`/invite/accept?token=${encodeURIComponent(token ?? "")}`)}`}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/signup?next=${encodeURIComponent(`/invite/accept?token=${encodeURIComponent(token ?? "")}`)}`}>
                    Create account
                  </Link>
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  const emailMatch = userEmail.toLowerCase() === email.toLowerCase();
  if (!emailMatch) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <PageHeader
            title="Wrong account"
            description="This invitation was sent to a different email."
          />
          <Card>
            <CardBody className="space-y-4">
              <p className="text-sm text-[var(--text-muted)]">
                You&apos;re signed in as <strong>{userEmail}</strong>. This invite was sent to <strong>{email}</strong>. Sign out and sign in with {email} to accept.
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Sign out and use invited email</Link>
              </Button>
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
          title="Accept invitation"
          description={`Join ${orgName} as a ${roleLabel}.`}
        />
        <Card>
          <CardBody className="space-y-4">
            <p className="text-sm text-[var(--text-muted)]">
              You&apos;re signed in as {userEmail}. Click below to join the organization.
            </p>
            <Button className="w-full" onClick={accept} disabled={accepting}>
              {accepting ? "Accepting…" : "Accept invitation"}
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
