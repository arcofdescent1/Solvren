"use client";

import { useState } from "react";
import { Button, Input, Stack } from "@/ui";
import { DEPARTMENTS } from "@/modules/onboarding/phase3/phase3-constants";

export function InviteMoreTeamsStep(props: {
  departmentMemberCounts: Record<string, number>;
  activeDepartmentCount: number;
  onRefresh: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const missing = DEPARTMENTS.filter((d) => (props.departmentMemberCounts[d] ?? 0) === 0);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/onboarding/phase3/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: "viewer", department: department || undefined }),
    });
    const j = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    setBusy(false);
    if (!res.ok) {
      setMsg(j.error ?? "Invite failed");
      return;
    }
    setMsg("Invite sent.");
    setEmail("");
    await props.onRefresh();
  };

  return (
    <Stack gap={4}>
      <p className="text-sm text-[var(--text-muted)]">
        Departments with no members yet: {missing.length ? missing.join(", ") : "none — nice coverage"}. Active departments
        (14d usage): {props.activeDepartmentCount}/3.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label htmlFor="p3-invite-email" className="text-sm font-medium">
            Email
          </label>
          <Input id="p3-invite-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" />
        </div>
        <div className="space-y-1">
          <label htmlFor="p3-invite-dept" className="text-sm font-medium">
            Department
          </label>
          <select
            id="p3-invite-dept"
            className="h-10 w-full rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-3 text-sm"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">Optional</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      {msg ? <p className="text-sm text-[var(--text-muted)]">{msg}</p> : null}
      <Button type="button" disabled={busy || !email.trim()} onClick={() => void submit()}>
        Send invite
      </Button>
    </Stack>
  );
}
