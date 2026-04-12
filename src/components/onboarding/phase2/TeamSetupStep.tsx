"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, CardBody, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Stack } from "@/ui";
import { trackAppEvent } from "@/lib/appAnalytics";
import { phase2BasePayload } from "./phase2Analytics";

const ROLE_OPTIONS = [
  { value: "viewer", label: "Executive sponsor (viewer)" },
  { value: "admin", label: "Risk / operations admin" },
  { value: "reviewer", label: "Approver (reviewer)" },
  { value: "submitter", label: "Analyst (submitter)" },
];

export function TeamSetupStep(props: {
  orgId: string;
  phase2Status: string | null | undefined;
  currentStepKey: string | null | undefined;
  acceptedMemberCount: number;
  onRefresh: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [team, setTeam] = useState("");
  const [role, setRole] = useState("viewer");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const prevTeamOk = useRef(false);

  useEffect(() => {
    const teamOk = props.acceptedMemberCount >= 2;
    if (teamOk && !prevTeamOk.current) {
      trackAppEvent("onboarding_phase2_team_step_completed", phase2BasePayload(props.orgId, props.phase2Status, props.currentStepKey));
    }
    prevTeamOk.current = teamOk;
  }, [props.acceptedMemberCount, props.orgId, props.phase2Status, props.currentStepKey]);

  async function sendInvite() {
    setMsg(null);
    setLoading(true);
    try {
      const res = await fetch("/api/onboarding/phase2/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, team, role }),
      });
      const j = (await res.json()) as { error?: string; ok?: boolean };
      if (!res.ok) {
        setMsg(j.error ?? "Invite failed");
        return;
      }
      trackAppEvent("onboarding_phase2_team_invite_sent", {
        ...phase2BasePayload(props.orgId, props.phase2Status, props.currentStepKey),
        role,
      });
      setEmail("");
      setName("");
      setTeam("");
      await props.onRefresh();
    } finally {
      setLoading(false);
    }
  }

  const teamOk = props.acceptedMemberCount >= 2;

  return (
    <Card>
      <CardBody>
        <Stack gap={4}>
          <div>
            <h2 className="text-lg font-semibold">Team setup</h2>
            <p className="text-sm text-[var(--text-muted)]">
              Invite executives for visibility, RevOps and IT for alerts, and managers for approvals. Activation completes when at least two people
              beyond the org owner have accepted their invites.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm">Accepted teammates (excl. owner):</span>
            <Badge variant={teamOk ? "secondary" : "outline"}>{props.acceptedMemberCount} / 2</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="p2-email" className="mb-1 block text-sm font-medium">
                Work email
              </label>
              <Input id="p2-email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" />
            </div>
            <div>
              <label htmlFor="p2-name" className="mb-1 block text-sm font-medium">
                Full name (optional)
              </label>
              <Input id="p2-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label htmlFor="p2-team" className="mb-1 block text-sm font-medium">
                Team (optional)
              </label>
              <Input id="p2-team" value={team} onChange={(e) => setTeam(e.target.value)} placeholder="RevOps" />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium">Role in Solvren</span>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {msg ? <p className="text-sm text-red-600">{msg}</p> : null}
          <Button type="button" onClick={() => void sendInvite()} disabled={loading || !email.trim()}>
            {loading ? "Sending…" : "Send invite"}
          </Button>
        </Stack>
      </CardBody>
    </Card>
  );
}
